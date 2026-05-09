///|
pub(all) struct GlyphProvider {
  get_glyph : (Int, Double, Bool) -> (Array[@svg.PathCommand], Double)
  get_kern : (Int, Int, Double, Bool) -> Double
  get_glyph_by_weight : ((Int, Double, Double) -> (
    Array[@svg.PathCommand],
    Double,
  ))?
  get_kern_by_weight : ((Int, Int, Double, Double) -> Double)?
  ascent_ratio : Double
}

///|
pub fn axis_values_for_weight(font_weight : Double) -> Map[String, Double] {
  { "wght": font_weight }
}

///|
fn scaled_outline_for_weight(
  font : @font.TTFont,
  codepoint : Int,
  font_size : Double,
  font_weight : Double,
) -> Array[@svg.PathCommand] {
  let outline = font.char_outline_at(
    codepoint,
    axis_values_for_weight(font_weight),
  )
  let scale = font_size / font.units_per_em.to_double()
  @font.scale_commands(outline, scale, true)
}

///|
fn glyph_for_weight(
  font : @font.TTFont,
  units_per_em : Double,
  codepoint : Int,
  font_size : Double,
  font_weight : Double,
) -> (Array[@svg.PathCommand], Double) {
  let commands = scaled_outline_for_weight(
    font, codepoint, font_size, font_weight,
  )
  let glyph_id = font.glyph_index(codepoint)
  let advance = if glyph_id != 0 {
    let metrics = font.glyph_metrics_at(
      glyph_id,
      axis_values_for_weight(font_weight),
    )
    metrics.advance_width.to_double() / units_per_em * font_size
  } else {
    0.0
  }
  (commands, advance)
}

///|
fn kern_for_weight(
  font : @font.TTFont,
  units_per_em : Double,
  cp1 : Int,
  cp2 : Int,
  font_size : Double,
) -> Double {
  let gid1 = font.glyph_index(cp1)
  let gid2 = font.glyph_index(cp2)
  let kern = font.kern_pair(gid1, gid2)
  kern.to_double() * font_size / units_per_em
}

///|
pub fn GlyphProvider::from_font(font : @font.TTFont) -> GlyphProvider {
  let units_per_em = font.units_per_em.to_double()
  let ascent_ratio = font.ascent.to_double() / units_per_em
  {
    get_glyph: fn(codepoint, font_size, is_bold) {
      let font_weight = if is_bold { 700.0 } else { 400.0 }
      glyph_for_weight(font, units_per_em, codepoint, font_size, font_weight)
    },
    get_kern: fn(cp1, cp2, font_size, _is_bold) {
      kern_for_weight(font, units_per_em, cp1, cp2, font_size)
    },
    get_glyph_by_weight: Some(fn(codepoint, font_size, font_weight) {
      glyph_for_weight(font, units_per_em, codepoint, font_size, font_weight)
    }),
    get_kern_by_weight: Some(fn(cp1, cp2, font_size, _font_weight) {
      kern_for_weight(font, units_per_em, cp1, cp2, font_size)
    }),
    ascent_ratio,
  }
}

///|
pub fn glyph_provider_from_font(font : @font.TTFont) -> GlyphProvider {
  GlyphProvider::from_font(font)
}

///|
pub fn glyph_provider_from_bytes(data : Bytes) -> GlyphProvider? {
  match @font.parse_font(data) {
    Some(font) => Some(GlyphProvider::from_font(font))
    None => None
  }
}
