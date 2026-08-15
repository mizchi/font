///|
/// Text rendering type definitions.

///|
pub(all) struct FontKey {
  family : String
  weight : Int
  italic : Bool
}

///|
pub impl Show for FontKey with fn output(self, logger) {
  logger.write_string("{family: ")
  Show::output(self.family, logger)
  logger.write_string(", weight: ")
  Show::output(self.weight, logger)
  logger.write_string(", italic: ")
  Show::output(self.italic, logger)
  logger.write_string("}")
}

///|
pub(all) struct TextStyle {
  font : FontKey
  size_px : Double
  line_height : Double
  letter_spacing : Double
}

///|
pub impl Show for TextStyle with fn output(self, logger) {
  logger.write_string("{font: ")
  Show::output(self.font, logger)
  logger.write_string(", size_px: ")
  Show::output(self.size_px, logger)
  logger.write_string(", line_height: ")
  Show::output(self.line_height, logger)
  logger.write_string(", letter_spacing: ")
  Show::output(self.letter_spacing, logger)
  logger.write_string("}")
}

///|
pub(all) struct TextMetrics {
  width : Double
  height : Double
  baseline : Double
}

///|
pub impl Show for TextMetrics with fn output(self, logger) {
  logger.write_string("{width: ")
  Show::output(self.width, logger)
  logger.write_string(", height: ")
  Show::output(self.height, logger)
  logger.write_string(", baseline: ")
  Show::output(self.baseline, logger)
  logger.write_string("}")
}

///|
pub(all) struct GlyphQuad {
  glyph_id : Int
  atlas_x : Double
  atlas_y : Double
  atlas_w : Double
  atlas_h : Double
  dst_x : Double
  dst_y : Double
  dst_w : Double
  dst_h : Double
}

///|
pub impl Show for GlyphQuad with fn output(self, logger) {
  logger.write_string("{glyph_id: ")
  Show::output(self.glyph_id, logger)
  logger.write_string(", atlas_x: ")
  Show::output(self.atlas_x, logger)
  logger.write_string(", atlas_y: ")
  Show::output(self.atlas_y, logger)
  logger.write_string(", atlas_w: ")
  Show::output(self.atlas_w, logger)
  logger.write_string(", atlas_h: ")
  Show::output(self.atlas_h, logger)
  logger.write_string(", dst_x: ")
  Show::output(self.dst_x, logger)
  logger.write_string(", dst_y: ")
  Show::output(self.dst_y, logger)
  logger.write_string(", dst_w: ")
  Show::output(self.dst_w, logger)
  logger.write_string(", dst_h: ")
  Show::output(self.dst_h, logger)
  logger.write_string("}")
}

///|
pub(all) struct TextRun {
  text : String
  style : TextStyle
}

///|
pub impl Show for TextRun with fn output(self, logger) {
  logger.write_string("{text: ")
  Show::output(self.text, logger)
  logger.write_string(", style: ")
  Show::output(self.style, logger)
  logger.write_string("}")
}

///|
pub fn new_text_run(text : String, style : TextStyle) -> TextRun {
  { text, style }
}

///|
pub fn default_text_style(family : String, size_px : Double) -> TextStyle {
  {
    font: { family, weight: 400, italic: false },
    size_px,
    line_height: size_px * 1.4,
    letter_spacing: 0.0,
  }
}

///|
pub enum FontFormat {
  TrueType
  OpenType
  Woff1
  Woff2
  TrueTypeCollection
  Unknown
} derive(Eq)

///|
pub impl Show for FontFormat with fn output(self, logger) {
  match self {
    TrueType => logger.write_string("TrueType")
    OpenType => logger.write_string("OpenType")
    Woff1 => logger.write_string("Woff1")
    Woff2 => logger.write_string("Woff2")
    TrueTypeCollection => logger.write_string("TrueTypeCollection")
    Unknown => logger.write_string("Unknown")
  }
}

///|
pub fn detect_font_format(data : Bytes) -> FontFormat {
  if data.length() < 4 {
    return Unknown
  }
  let b0 = data[0]
  let b1 = data[1]
  let b2 = data[2]
  let b3 = data[3]
  if b0 == b'\x00' && b1 == b'\x01' && b2 == b'\x00' && b3 == b'\x00' {
    TrueType
  } else if b0 == b'\x4F' && b1 == b'\x54' && b2 == b'\x54' && b3 == b'\x4F' {
    OpenType
  } else if b0 == b'\x77' && b1 == b'\x4F' && b2 == b'\x46' && b3 == b'\x46' {
    Woff1
  } else if b0 == b'\x77' && b1 == b'\x4F' && b2 == b'\x46' && b3 == b'\x32' {
    Woff2
  } else if b0 == b'\x74' && b1 == b'\x74' && b2 == b'\x63' && b3 == b'\x66' {
    TrueTypeCollection
  } else {
    Unknown
  }
}

///|
pub(all) struct AtlasPageInfo {
  page_id : Int
  width : Int
  height : Int
  dirty : Bool
}

///|
pub impl Show for AtlasPageInfo with fn output(self, logger) {
  logger.write_string("{page_id: ")
  Show::output(self.page_id, logger)
  logger.write_string(", width: ")
  Show::output(self.width, logger)
  logger.write_string(", height: ")
  Show::output(self.height, logger)
  logger.write_string(", dirty: ")
  Show::output(self.dirty, logger)
  logger.write_string("}")
}
