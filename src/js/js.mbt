///|
/// Global font storage
let global_font : Ref[@font.TTFont?] = { val: None, }

///|
/// Load font from bytes and return info JSON, or empty string on failure
pub fn loadFont(data : Bytes) -> String {
  match @font.parse_font(data) {
    Some(font) => {
      global_font.val = Some(font)
      font_info_json(font)
    }
    None => {
      global_font.val = None
      ""
    }
  }
}

///|
pub fn getFontInfo() -> String {
  match global_font.val {
    Some(font) => font_info_json(font)
    None => ""
  }
}

///|
fn font_info_json(font : @font.TTFont) -> String {
  let axes : Array[Json] = font.var_axes.map(axis => {
    "tag": axis.tag,
    "min": axis.min_value,
    "default": axis.default_value,
    "max": axis.max_value,
  })
  let italic = match font.post {
    Some(post) => post.italic_angle != 0.0
    None => false
  }
  let json : Json = {
    "units_per_em": font.units_per_em,
    "num_glyphs": font.num_glyphs,
    "ascent": font.ascent,
    "descent": font.descent,
    "weight_class": font.weight_class(),
    "italic": italic,
    "axes": axes,
  }
  json.stringify()
}

///|
/// Get glyph outline as SVG path data string
/// Returns SVG path d attribute for the given codepoint at the given font size
pub fn glyphToSvgPath(codepoint : Int32, font_size : Double) -> String {
  match global_font.val {
    Some(font) => {
      let cmds = font.scaled_outline(codepoint, font_size)
      commands_to_svg_path(cmds)
    }
    None => ""
  }
}

///|
/// Get glyph outline as JSON array of commands: [[type, ...args], ...]
/// where type is "M", "L", "Q", "C", "Z"
pub fn glyphOutlineCommands(codepoint : Int32, font_size : Double) -> String {
  match global_font.val {
    Some(font) => {
      let cmds = font.scaled_outline(codepoint, font_size)
      commands_to_json_array(cmds)
    }
    None => "[]"
  }
}

///|
/// Get glyph advance width scaled to font size
pub fn glyphAdvance(codepoint : Int32, font_size : Double) -> Double {
  match global_font.val {
    Some(font) => {
      let gid = font.glyph_index(codepoint)
      let metrics = font.glyph_metrics(gid)
      metrics.advance_width.to_double() *
      font_size /
      font.units_per_em.to_double()
    }
    None => 0.0
  }
}

///|
/// Get font name by nameID
pub fn fontName(name_id : Int32) -> String {
  match global_font.val {
    Some(font) => font.font_name(name_id).unwrap_or("")
    None => ""
  }
}

///|
/// Get kerning advance for two codepoints at given font size
pub fn kernAdvance(cp1 : Int32, cp2 : Int32, font_size : Double) -> Double {
  match global_font.val {
    Some(font) => {
      let gid1 = font.glyph_index(cp1)
      let gid2 = font.glyph_index(cp2)
      let kern = font.kern_pair(gid1, gid2)
      kern.to_double() * font_size / font.units_per_em.to_double()
    }
    None => 0.0
  }
}

///|
/// Layout text and return JSON array of glyph positions
pub fn layoutText(text : String, font_size : Double) -> String {
  match global_font.val {
    Some(font) => {
      let positions = font.layout_text(text, font_size)
      let buf = StringBuilder()
      buf.write_char('[')
      for i, pos in positions {
        if i > 0 {
          buf.write_char(',')
        }
        buf.write_string("{\"codepoint\":")
        buf.write_string(pos.codepoint.to_string())
        buf.write_string(",\"glyph_id\":")
        buf.write_string(pos.glyph_id.to_string())
        buf.write_string(",\"x_offset\":")
        write_num(buf, pos.x_offset)
        buf.write_string(",\"y_offset\":")
        write_num(buf, pos.y_offset)
        buf.write_string(",\"x_advance\":")
        write_num(buf, pos.x_advance)
        buf.write_char('}')
      }
      buf.write_char(']')
      buf.to_string()
    }
    None => "[]"
  }
}

///|
/// Measure text width at given font size
pub fn measureText(text : String, font_size : Double) -> Double {
  match global_font.val {
    Some(font) => font.measure_text(text, font_size)
    None => 0.0
  }
}

///|
/// Single-run advance, logical/ink rectangles and per-glyph UTF-16 ranges.
/// Returns JSON null if no font is loaded or the size is invalid.
pub fn layoutTextBounds(text : String, font_size : Double) -> String {
  if font_size < 0.0 || !font_size.is_finite() {
    return "null"
  }
  match global_font.val {
    Some(font) => font.layout_text_bounds(text, font_size).to_json().stringify()
    None => "null"
  }
}

///|
/// Shape a paragraph. Returns {ok:true,result:ShapedText} or
/// {ok:false,error:{code,message}}; never silently falls back to simple layout.
pub fn shapeText(
  text : String,
  font_size : Double,
  direction : String,
  language : String,
  kerning : Bool,
  ligatures : Bool,
) -> String {
  shape_text_json(
    text,
    font_size,
    direction,
    language,
    kerning,
    ligatures,
    None,
  )
}

///|
pub fn shapeTextWithWeight(
  text : String,
  font_size : Double,
  direction : String,
  language : String,
  kerning : Bool,
  ligatures : Bool,
  weight : Double,
) -> String {
  shape_text_json(
    text,
    font_size,
    direction,
    language,
    kerning,
    ligatures,
    Some(weight),
  )
}

///|
pub fn shapeTextWithAxes(
  text : String,
  font_size : Double,
  direction : String,
  language : String,
  kerning : Bool,
  ligatures : Bool,
  weight : Double,
  axes_json : String,
) -> String {
  let parsed = @json.parse(axes_json) catch {
    _ =>
      return shaping_error_json(
        "invalid_axes", "Axes must be a JSON object of finite numbers",
      )
  }
  guard parsed is Object(object) else {
    return shaping_error_json("invalid_axes", "Axes must be a JSON object")
  }
  let axes : Map[String, Double] = Map([])
  for tag, value in object {
    guard value is Number(number, ..) && number.is_finite() else {
      return shaping_error_json(
        "invalid_axes", "Axis values must be finite numbers",
      )
    }
    axes[tag] = number
  }
  shape_text_json(
    text,
    font_size,
    direction,
    language,
    kerning,
    ligatures,
    Some(weight),
    axis_values=axes,
  )
}

///|
fn shape_text_json(
  text : String,
  font_size : Double,
  direction : String,
  language : String,
  kerning : Bool,
  ligatures : Bool,
  weight : Double?,
  axis_values~ : Map[String, Double] = Map([]),
) -> String {
  if !font_size.is_finite() || font_size < 0.0 {
    return shaping_error_json(
      "invalid_font_size", "Font size must be finite and nonnegative",
    )
  }
  let text_direction : @font.TextDirection = match direction {
    "auto" => @font.Auto
    "ltr" => @font.Ltr
    "rtl" => @font.Rtl
    _ =>
      return shaping_error_json(
        "invalid_direction", "Direction must be auto, ltr or rtl",
      )
  }
  guard global_font.val is Some(font) else {
    return shaping_error_json("font_not_loaded", "No font is loaded")
  }
  let result = try {
    match weight {
      Some(weight) =>
        font.shape_text(
          text,
          font_size,
          direction=text_direction,
          language~,
          kerning~,
          ligatures~,
          font_weight=weight,
          axis_values~,
        )
      None =>
        font.shape_text(
          text,
          font_size,
          direction=text_direction,
          language~,
          kerning~,
          ligatures~,
          axis_values~,
        )
    }
  } catch {
    err => return shaping_error_json("shaping_failed", err.message())
  }
  let json : Json = { "ok": true, "result": result }
  json.stringify()
}

///|
fn shaping_error_json(code : String, message : String) -> String {
  let json : Json = {
    "ok": false,
    "error": { "code": code, "message": message },
  }
  json.stringify()
}

///|
/// Get font weight class from OS/2 table
pub fn fontWeightClass() -> Int32 {
  match global_font.val {
    Some(font) => font.weight_class()
    None => 0
  }
}

///|
/// Check if font is fixed pitch (returns 0 or 1)
pub fn isFixedPitch() -> Int32 {
  match global_font.val {
    Some(font) => if font.is_fixed_pitch() { 1 } else { 0 }
    None => 0
  }
}

///|
/// Get codepoint coverage as JSON array
pub fn codepointCoverage() -> String {
  match global_font.val {
    Some(font) => {
      let cps = font.codepoint_coverage()
      let buf = StringBuilder()
      buf.write_char('[')
      for i, cp in cps {
        if i > 0 {
          buf.write_char(',')
        }
        buf.write_string(cp.to_string())
      }
      buf.write_char(']')
      buf.to_string()
    }
    None => "[]"
  }
}

///|
/// Get all glyph IDs as JSON array
pub fn glyphIds() -> String {
  match global_font.val {
    Some(font) => {
      let ids = font.glyph_ids()
      let buf = StringBuilder()
      buf.write_char('[')
      for i, id in ids {
        if i > 0 {
          buf.write_char(',')
        }
        buf.write_string(id.to_string())
      }
      buf.write_char(']')
      buf.to_string()
    }
    None => "[]"
  }
}

///|
/// Get table sizes as JSON object
pub fn tableSizes() -> String {
  match global_font.val {
    Some(font) =>
      match @font.analyze_tables(font.data) {
        Some(tables) => {
          let buf = StringBuilder()
          buf.write_char('{')
          for i, tbl in tables {
            if i > 0 {
              buf.write_char(',')
            }
            buf.write_char('"')
            buf.write_string(tbl.tag)
            buf.write_string("\":")
            buf.write_string(tbl.length.to_string())
          }
          buf.write_char('}')
          buf.to_string()
        }
        None => "{}"
      }
    None => "{}"
  }
}

///|
/// Convert PathCommand array to SVG path data string
fn commands_to_svg_path(cmds : Array[@svg.PathCommand]) -> String {
  let buf = StringBuilder()
  for cmd in cmds {
    if buf.to_string().length() > 0 {
      buf.write_char(' ')
    }
    match cmd {
      @svg.MoveTo(x, y) => {
        buf.write_char('M')
        write_num(buf, x)
        buf.write_char(' ')
        write_num(buf, y)
      }
      @svg.LineTo(x, y) => {
        buf.write_char('L')
        write_num(buf, x)
        buf.write_char(' ')
        write_num(buf, y)
      }
      @svg.QuadraticCurveTo(cx, cy, x, y) => {
        buf.write_char('Q')
        write_num(buf, cx)
        buf.write_char(' ')
        write_num(buf, cy)
        buf.write_char(' ')
        write_num(buf, x)
        buf.write_char(' ')
        write_num(buf, y)
      }
      @svg.CurveTo(cx1, cy1, cx2, cy2, x, y) => {
        buf.write_char('C')
        write_num(buf, cx1)
        buf.write_char(' ')
        write_num(buf, cy1)
        buf.write_char(' ')
        write_num(buf, cx2)
        buf.write_char(' ')
        write_num(buf, cy2)
        buf.write_char(' ')
        write_num(buf, x)
        buf.write_char(' ')
        write_num(buf, y)
      }
      @svg.ClosePath => buf.write_char('Z')
      _ => ()
    }
  }
  buf.to_string()
}

///|
/// Preserve subpixel precision in paths and layout JSON.
fn write_num(buf : StringBuilder, n : Double) -> Unit {
  buf.write_string(n.to_string())
}

///|
/// Convert PathCommand array to JSON array: [[type, ...args], ...]
fn commands_to_json_array(cmds : Array[@svg.PathCommand]) -> String {
  let buf = StringBuilder()
  buf.write_char('[')
  for i, cmd in cmds {
    if i > 0 {
      buf.write_char(',')
    }
    match cmd {
      @svg.MoveTo(x, y) => {
        buf.write_string("[\"M\",")
        write_num(buf, x)
        buf.write_char(',')
        write_num(buf, y)
        buf.write_char(']')
      }
      @svg.LineTo(x, y) => {
        buf.write_string("[\"L\",")
        write_num(buf, x)
        buf.write_char(',')
        write_num(buf, y)
        buf.write_char(']')
      }
      @svg.QuadraticCurveTo(cx, cy, x, y) => {
        buf.write_string("[\"Q\",")
        write_num(buf, cx)
        buf.write_char(',')
        write_num(buf, cy)
        buf.write_char(',')
        write_num(buf, x)
        buf.write_char(',')
        write_num(buf, y)
        buf.write_char(']')
      }
      @svg.CurveTo(cx1, cy1, cx2, cy2, x, y) => {
        buf.write_string("[\"C\",")
        write_num(buf, cx1)
        buf.write_char(',')
        write_num(buf, cy1)
        buf.write_char(',')
        write_num(buf, cx2)
        buf.write_char(',')
        write_num(buf, cy2)
        buf.write_char(',')
        write_num(buf, x)
        buf.write_char(',')
        write_num(buf, y)
        buf.write_char(']')
      }
      @svg.ClosePath => buf.write_string("[\"Z\"]")
      _ => ()
    }
  }
  buf.write_char(']')
  buf.to_string()
}
