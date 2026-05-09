///|
/// Text rendering type definitions.

///|
pub(all) struct FontKey {
  family : String
  weight : Int
  italic : Bool
}

///|
pub impl Show for FontKey with output(self, logger) {
  logger.write_string("{family: ")
  self.family.output(logger)
  logger.write_string(", weight: ")
  self.weight.output(logger)
  logger.write_string(", italic: ")
  self.italic.output(logger)
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
pub impl Show for TextStyle with output(self, logger) {
  logger.write_string("{font: ")
  self.font.output(logger)
  logger.write_string(", size_px: ")
  self.size_px.output(logger)
  logger.write_string(", line_height: ")
  self.line_height.output(logger)
  logger.write_string(", letter_spacing: ")
  self.letter_spacing.output(logger)
  logger.write_string("}")
}

///|
pub(all) struct TextMetrics {
  width : Double
  height : Double
  baseline : Double
}

///|
pub impl Show for TextMetrics with output(self, logger) {
  logger.write_string("{width: ")
  self.width.output(logger)
  logger.write_string(", height: ")
  self.height.output(logger)
  logger.write_string(", baseline: ")
  self.baseline.output(logger)
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
pub impl Show for GlyphQuad with output(self, logger) {
  logger.write_string("{glyph_id: ")
  self.glyph_id.output(logger)
  logger.write_string(", atlas_x: ")
  self.atlas_x.output(logger)
  logger.write_string(", atlas_y: ")
  self.atlas_y.output(logger)
  logger.write_string(", atlas_w: ")
  self.atlas_w.output(logger)
  logger.write_string(", atlas_h: ")
  self.atlas_h.output(logger)
  logger.write_string(", dst_x: ")
  self.dst_x.output(logger)
  logger.write_string(", dst_y: ")
  self.dst_y.output(logger)
  logger.write_string(", dst_w: ")
  self.dst_w.output(logger)
  logger.write_string(", dst_h: ")
  self.dst_h.output(logger)
  logger.write_string("}")
}

///|
pub(all) struct TextRun {
  text : String
  style : TextStyle
}

///|
pub impl Show for TextRun with output(self, logger) {
  logger.write_string("{text: ")
  self.text.output(logger)
  logger.write_string(", style: ")
  self.style.output(logger)
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
pub impl Show for FontFormat with output(self, logger) {
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
pub impl Show for AtlasPageInfo with output(self, logger) {
  logger.write_string("{page_id: ")
  self.page_id.output(logger)
  logger.write_string(", width: ")
  self.width.output(logger)
  logger.write_string(", height: ")
  self.height.output(logger)
  logger.write_string(", dirty: ")
  self.dirty.output(logger)
  logger.write_string("}")
}
