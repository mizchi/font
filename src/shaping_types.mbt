///|
/// Base paragraph direction. Auto uses the first strong Unicode character.
#derive(Eq)
pub(all) enum TextDirection {
  Auto
  Ltr
  Rtl
}

///|
pub extend TextDirection with Eq::{equal, not_equal}

///|
pub suberror ShapingError {
  InvalidFontSize
  InvalidFont
  MultipleParagraphs
  InvalidFontWeight
  UnsupportedFontWeight
  InvalidVariationAxis(String)
}

///|
pub fn ShapingError::message(self : ShapingError) -> String {
  match self {
    InvalidFontSize => "Font size must be finite and nonnegative"
    InvalidFont => "The font has no usable sfnt data"
    MultipleParagraphs => "Shape one paragraph at a time"
    InvalidFontWeight => "Font weight must be finite and between 1 and 1000"
    UnsupportedFontWeight =>
      "Load the matching static font face, or use a variable font with a wght axis"
    InvalidVariationAxis(tag) =>
      "Unsupported or non-finite variation axis: " + tag
  }
}

///|
/// A visual run of one script and resolved BiDi embedding level. Text ranges
/// are half-open UTF-16 offsets; glyph ranges index ShapedText.bounds.glyphs.
#derive(ToJson)
pub(all) struct ShapedRun {
  text_start : Int32
  text_end : Int32
  glyph_start : Int32
  glyph_end : Int32
  level : Int32
  direction : String
  script : String
  x : Double
  advance_width : Double
}

///|
pub extend ShapedRun with ToJson::{to_json}

///|
/// A single shaped paragraph, with runs and glyph clusters in visual order.
/// Glyphs sharing a cluster have the same source range; ligatures can cover
/// several characters. Coordinates use a left baseline origin with y down.
#derive(ToJson)
pub(all) struct ShapedText {
  direction : String
  bounds : TextBounds
  runs : Array[ShapedRun]
  missing_codepoints : Array[Int32]
  variations : Map[String, Double]
}

///|
pub extend ShapedText with ToJson::{to_json}

///|
priv struct LogicalShapeRun {
  start : Int32
  end : Int32
  level : Int32
  script : @swash.Script
}

///|
priv struct ShapeCluster {
  text_start : Int32
  text_end : Int32
  glyphs : Array[@swash_shape.Glyph]
}
