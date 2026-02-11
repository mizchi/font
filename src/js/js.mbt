///|
/// Global font storage
let global_font : Ref[@font.TTFont?] = { val: None }

///|
/// Load font from bytes and return info JSON, or empty string on failure
pub fn loadFont(data : Bytes) -> String {
  match @font.parse_ttf(data) {
    Some(font) => {
      global_font.val = Some(font)
      let buf = StringBuilder::new()
      buf.write_string("{\"units_per_em\":")
      buf.write_string(font.units_per_em.to_string())
      buf.write_string(",\"num_glyphs\":")
      buf.write_string(font.num_glyphs.to_string())
      buf.write_string(",\"ascent\":")
      buf.write_string(font.ascent.to_string())
      buf.write_string(",\"descent\":")
      buf.write_string(font.descent.to_string())
      buf.write_string("}")
      buf.to_string()
    }
    None => ""
  }
}

///|
/// Get font metrics as JSON
pub fn getFontInfo() -> String {
  match global_font.val {
    Some(font) => {
      let buf = StringBuilder::new()
      buf.write_string("{\"units_per_em\":")
      buf.write_string(font.units_per_em.to_string())
      buf.write_string(",\"num_glyphs\":")
      buf.write_string(font.num_glyphs.to_string())
      buf.write_string(",\"ascent\":")
      buf.write_string(font.ascent.to_string())
      buf.write_string(",\"descent\":")
      buf.write_string(font.descent.to_string())
      buf.write_string("}")
      buf.to_string()
    }
    None => ""
  }
}

///|
/// Get glyph outline as SVG path data string
/// Returns SVG path d attribute for the given codepoint at the given font size
pub fn glyphToSvgPath(codepoint : Int, font_size : Double) -> String {
  match global_font.val {
    Some(font) => {
      let cmds = font.scaled_outline(codepoint, font_size)
      commands_to_svg_path(cmds)
    }
    None => ""
  }
}

///|
/// Get glyph advance width scaled to font size
pub fn glyphAdvance(codepoint : Int, font_size : Double) -> Double {
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
/// Convert PathCommand array to SVG path data string
fn commands_to_svg_path(cmds : Array[@svg.PathCommand]) -> String {
  let buf = StringBuilder::new()
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
/// Write a number rounded to 2 decimal places
fn write_num(buf : StringBuilder, n : Double) -> Unit {
  let rounded = (n * 100.0).to_int().to_double() / 100.0
  buf.write_string(rounded.to_string())
}
