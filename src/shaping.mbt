///|
/// Shape a single paragraph using OpenType GSUB/GPOS and Unicode BiDi.
/// Optional weight/axis coordinates select a variable font instance. Static
/// weights must match the loaded face. No synthesis or font fallback is performed.
/// Kerning and standard/contextual ligatures are enabled by default.
pub fn TTFont::shape_text(
  self : TTFont,
  text : String,
  font_size : Double,
  direction~ : TextDirection = Auto,
  language~ : String = "und",
  kerning~ : Bool = true,
  ligatures~ : Bool = true,
  font_weight? : Double,
  axis_values~ : Map[String, Double] = Map([]),
) -> ShapedText raise ShapingError {
  if !font_size.is_finite() || font_size < 0.0 {
    raise InvalidFontSize
  }
  if self.units_per_em <= 0 || self.data.length() < 12 {
    raise InvalidFont
  }
  let variations = axis_values.copy()
  if font_weight is Some(weight) {
    if !weight.is_finite() || weight < 1.0 || weight > 1000.0 {
      raise InvalidFontWeight
    }
    if self.var_axes.any(axis => axis.tag == "wght") {
      if !variations.contains("wght") {
        variations["wght"] = weight
      }
    } else if weight != self.weight_class().to_double() {
      raise UnsupportedFontWeight
    }
  }
  let settings : Array[@swash.Setting[Double]] = []
  for tag, value in variations {
    let mut selected : VarAxis? = None
    let mut index = 0
    for candidate_index, axis in self.var_axes {
      if axis.tag == tag {
        selected = Some(axis)
        index = candidate_index
      }
    }
    guard selected is Some(axis) else { raise InvalidVariationAxis(tag) }
    if !value.is_finite() {
      raise InvalidVariationAxis(tag)
    }
    let clamped = value.max(axis.min_value).min(axis.max_value)
    variations[tag] = clamped
    let packed = (tag[0].to_int().reinterpret_as_uint() << 24) |
      (tag[1].to_int().reinterpret_as_uint() << 16) |
      (tag[2].to_int().reinterpret_as_uint() << 8) |
      tag[3].to_int().reinterpret_as_uint()
    // moon_swash 0.1.15 reads the avar v1 axis count from the reserved field,
    // so its normalize() omits the segment map. Pre-map the coordinate and
    // express it in linear design units for this pinned backend. Keep the
    // original design coordinate in `variations` for outlines and reporting.
    let normalized = normalize_axis_coord(clamped, axis)
    let mapped = if index < self.avar_segments.length() {
      apply_avar(normalized, self.avar_segments[index])
    } else {
      normalized
    }
    let design = if mapped >= 0.0 {
      axis.default_value + mapped * (axis.max_value - axis.default_value)
    } else {
      axis.default_value + mapped * (axis.default_value - axis.min_value)
    }
    settings.push(@swash.Setting::Setting(packed, design))
  }
  for ch in text {
    if ch == '\n' || ch == '\r' || ch == '\u{2028}' || ch == '\u{2029}' {
      raise MultipleParagraphs
    }
  }
  let para = match direction {
    Auto => @bidi.process(text)
    Ltr => @bidi.process(text, direction=@bidi.LTR)
    Rtl => @bidi.process(text, direction=@bidi.RTL)
  }
  let offsets : Array[Int32] = [0]
  let original : Map[Int32, Int32] = Map([])
  let mut offset = 0
  let missing_codepoints : Array[Int32] = []
  for ch in para.chars {
    original[offset] = ch.to_int()
    if self.glyph_index(ch.to_int()) == 0 &&
      !@swash.CharInfo::from_char(ch).is_ignorable() &&
      !missing_codepoints.contains(ch.to_int()) {
      missing_codepoints.push(ch.to_int())
    }
    offset += if ch.to_int() > 0xFFFF { 2 } else { 1 }
    offsets.push(offset)
  }
  let scripts = resolve_shape_scripts(para.chars)
  let logical : Array[LogicalShapeRun] = []
  let run_for_char = Array::make(para.chars.length(), 0)
  let mut start = 0
  while start < para.chars.length() {
    let mut end = start + 1
    while end < para.chars.length() &&
          para.levels[end] == para.levels[start] &&
          scripts[end].to_opentype() == scripts[start].to_opentype() {
      end += 1
    }
    for i in start..<end {
      run_for_char[i] = logical.length()
    }
    logical.push({
      start,
      end,
      level: para.levels[start],
      script: scripts[start],
    })
    start = end
  }
  let visual : Array[Int32] = []
  let seen = Array::make(logical.length(), false)
  for i in @bidi.reorder(para) {
    let run_id = run_for_char[i]
    if !seen[run_id] {
      visual.push(run_id)
      seen[run_id] = true
    }
  }
  guard @swash.FontRef::from_offset(self.data, self.sfnt_offset) is Some(face) else {
    raise InvalidFont
  }
  let context = @swash_shape.ShapeContext::ShapeContext()
  let scale = font_size / self.units_per_em.to_double()
  let glyphs : Array[PositionedGlyphBounds] = []
  let runs : Array[ShapedRun] = []
  let mut pen_x = 0.0
  for id in visual {
    let run = logical[id]
    let rtl = run.level % 2 == 1
    let features : Array[@swash.Setting[UInt16]] = []
    if !kerning {
      features.push(@swash.Setting::Setting(0x6B65726EU, (0).to_uint16()))
    }
    if !ligatures {
      features.push(@swash.Setting::Setting(0x6C696761U, (0).to_uint16()))
      features.push(@swash.Setting::Setting(0x636C6967U, (0).to_uint16()))
    }
    let shaper = context
      .builder(face)
      .size(self.units_per_em.to_double())
      .script(run.script)
      .direction(
        if rtl {
          @swash_shape.RightToLeft
        } else {
          @swash_shape.LeftToRight
        },
      )
      .language(@swash.Language::parse(language))
      .features(features.iter())
      .variations(settings.iter())
      .build()
    let tokens : Array[@swash.Token] = []
    for i in run.start..<run.end {
      let ch = @bidi.get_mirrored(para.chars[i], run.level)
      tokens.push(
        @swash.Token::Token(
          ch,
          offsets[i].reinterpret_as_uint(),
          (offsets[i + 1] - offsets[i]).reinterpret_as_uint(),
          @swash.CharInfo::from_char(ch),
          0U,
        ),
      )
    }
    let parser = @swash.Parser::Parser(run.script, tokens.iter())
    let cluster = @swash.CharCluster::CharCluster()
    let charmap = @swash.Charmap::from_font(face)
    while parser.next(cluster) {
      ignore(cluster.map(ch => charmap.map(ch.to_uint())))
      shaper.add_cluster(cluster)
    }
    let clusters : Array[ShapeCluster] = []
    shaper.shape_with(cluster => {
      clusters.push({
        text_start: cluster.source().start().reinterpret_as_int(),
        text_end: cluster.source().end().reinterpret_as_int(),
        glyphs: cluster.glyphs().to_owned(),
      })
    })
    let glyph_start = glyphs.length()
    let run_x = pen_x
    // Swash emits logical clusters. Reverse clusters for RTL while retaining
    // the base/mark order and attachment offsets within each cluster.
    for cluster_index in 0..<clusters.length() {
      let cluster = clusters[if rtl {
          clusters.length() - 1 - cluster_index
        } else {
          cluster_index
        }]
      for glyph in cluster.glyphs {
        let gid = glyph.id().to_int()
        let x = pen_x + glyph.x() * scale
        let y = -glyph.y() * scale
        glyphs.push({
          codepoint: original.get(cluster.text_start).unwrap_or(0),
          glyph_id: gid,
          text_start: cluster.text_start,
          text_end: cluster.text_end,
          x,
          y,
          advance_width: glyph.advance() * scale,
          ink_bounds: positioned_ink_bounds_at(
            self, gid, x, y, scale, variations,
          ),
        })
        pen_x += glyph.advance() * scale
      }
    }
    runs.push({
      text_start: offsets[run.start],
      text_end: offsets[run.end],
      glyph_start,
      glyph_end: glyphs.length(),
      level: run.level,
      direction: if rtl {
        "rtl"
      } else {
        "ltr"
      },
      script: script_tag_string(run.script),
      x: run_x,
      advance_width: pen_x - run_x,
    })
  }
  {
    direction: if para.base_level == 1 {
      "rtl"
    } else {
      "ltr"
    },
    bounds: text_bounds_from_glyphs(self, glyphs, pen_x, scale),
    runs,
    missing_codepoints,
    variations,
  }
}

///|
fn resolve_shape_scripts(chars : Array[Char]) -> Array[@swash.Script] {
  let scripts : Array[@swash.Script] = []
  let mut previous = @swash.Common
  for ch in chars {
    let script = @swash.CharInfo::from_char(ch).properties().script()
    let tag = script.to_opentype()
    if tag != @swash.Common.to_opentype() &&
      tag != @swash.Inherited.to_opentype() &&
      tag != @swash.Unknown.to_opentype() {
      previous = script
    }
    scripts.push(previous)
  }
  let mut next = @swash.Common
  for i = scripts.length() - 1; i >= 0; i = i - 1 {
    if scripts[i].to_opentype() == @swash.Common.to_opentype() {
      scripts[i] = next
    } else {
      next = scripts[i]
    }
  }
  scripts
}

///|
fn script_tag_string(script : @swash.Script) -> String {
  let tag = script.to_opentype()
  String::from_array([
    (tag >> 24).reinterpret_as_int().unsafe_to_char(),
    ((tag >> 16) & 255U).reinterpret_as_int().unsafe_to_char(),
    ((tag >> 8) & 255U).reinterpret_as_int().unsafe_to_char(),
    (tag & 255U).reinterpret_as_int().unsafe_to_char(),
  ])
}
