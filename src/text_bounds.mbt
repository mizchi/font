///|
/// A subpixel rectangle. In text layout, units are pixels relative to the
/// baseline origin, with positive y down.
#derive(ToJson)
pub(all) struct TextRect {
  x : Double
  y : Double
  width : Double
  height : Double
}

///|
pub extend TextRect with ToJson::{to_json}

///|
/// A positioned glyph with a half-open UTF-16 range into the source text.
/// Whitespace has an advance but no ink rectangle.
pub(all) struct PositionedGlyphBounds {
  codepoint : Int32
  glyph_id : Int32
  text_start : Int32
  text_end : Int32
  x : Double
  y : Double
  advance_width : Double
  ink_bounds : TextRect?
}

///|
pub impl ToJson for PositionedGlyphBounds with fn to_json(self) {
  {
    "codepoint": self.codepoint,
    "glyph_id": self.glyph_id,
    "text_start": self.text_start,
    "text_end": self.text_end,
    "x": self.x,
    "y": self.y,
    "advance_width": self.advance_width,
    "ink_bounds": rect_to_json(self.ink_bounds),
  }
}

///|
pub extend PositionedGlyphBounds with ToJson::{to_json}

///|
/// Horizontal text metrics. Logical bounds use hhea ascent and descent; ink
/// bounds are the union of positioned glyph bounds, excluding whitespace.
/// For shaped clusters use shape_text; layout_text_bounds is basic LTR layout.
pub(all) struct TextBounds {
  advance_width : Double
  ascent : Double
  descent : Double
  line_gap : Double
  logical_bounds : TextRect
  ink_bounds : TextRect?
  glyphs : Array[PositionedGlyphBounds]
}

///|
pub impl ToJson for TextBounds with fn to_json(self) {
  {
    "advance_width": self.advance_width,
    "ascent": self.ascent,
    "descent": self.descent,
    "line_gap": self.line_gap,
    "logical_bounds": self.logical_bounds,
    "ink_bounds": rect_to_json(self.ink_bounds),
    "glyphs": self.glyphs,
  }
}

///|
pub extend TextBounds with ToJson::{to_json}

///|
fn rect_to_json(rect : TextRect?) -> Json {
  match rect {
    Some(rect) => rect.to_json()
    None => null
  }
}

///|
fn TextRect::union(self : TextRect, other : TextRect) -> TextRect {
  let x = self.x.min(other.x)
  let y = self.y.min(other.y)
  let right = (self.x + self.width).max(other.x + other.width)
  let bottom = (self.y + self.height).max(other.y + other.height)
  { x, y, width: right - x, height: bottom - y, }
}

///|
priv struct GlyphInkCache {
  font : TTFont
  axes : Map[String, Double]
  bounds : Map[Int32, TextRect?]
}

///|
/// Scoped to one font and variation instance, never shared across layout calls.
fn GlyphInkCache::new(
  font : TTFont,
  axes : Map[String, Double],
) -> GlyphInkCache {
  { font, axes, bounds: Map([]), }
}

///|
fn GlyphInkCache::positioned(
  self : GlyphInkCache,
  gid : Int32,
  x : Double,
  y : Double,
  scale : Double,
) -> TextRect? {
  if !(scale > 0.0) {
    return None
  }
  let raw = match self.bounds.get(gid) {
    Some(cached) => cached
    None => {
      let outline = if self.axes.is_empty() {
        self.font.glyph_outline(gid)
      } else {
        self.font.glyph_outline_at(gid, self.axes)
      }
      let bounds = match compute_path_bounds(outline) {
        Some(bounds) if bounds.width > 0.0 && bounds.height > 0.0 =>
          Some(bounds)
        _ => None
      }
      self.bounds[gid] = bounds
      bounds
    }
  }
  match raw {
    Some(bounds) =>
      Some({
        x: x + bounds.x * scale,
        y: y - (bounds.y + bounds.height) * scale,
        width: bounds.width * scale,
        height: bounds.height * scale,
      })
    _ => None
  }
}

///|
fn text_bounds_from_glyphs(
  font : TTFont,
  glyphs : Array[PositionedGlyphBounds],
  advance_width : Double,
  scale : Double,
) -> TextBounds {
  let mut ink_bounds : TextRect? = None
  for glyph in glyphs {
    if glyph.ink_bounds is Some(ink) {
      ink_bounds = Some(
        match ink_bounds {
          None => ink
          Some(previous) => previous.union(ink)
        },
      )
    }
  }
  let ascent = font.ascent.to_double() * scale
  let descent = -font.descent.to_double() * scale
  {
    advance_width,
    ascent,
    descent,
    line_gap: font.line_gap.to_double() * scale,
    logical_bounds: {
      x: 0.0,
      y: -ascent,
      width: advance_width,
      height: ascent + descent,
    },
    ink_bounds,
    glyphs,
  }
}

///|
/// Measure a single run, preserving subpixel precision. `font_size` must be
/// finite and nonnegative. Bounds are baseline-relative, in pixels (y down).
pub fn TTFont::layout_text_bounds(
  self : TTFont,
  text : String,
  font_size : Double,
) -> TextBounds {
  let scale = font_size / self.units_per_em.to_double()
  let ink_cache = GlyphInkCache::new(self, Map([]))
  let glyphs : Array[PositionedGlyphBounds] = []
  let mut text_start = 0
  let mut advance_width = 0.0
  for pos in self.layout_text(text, font_size) {
    let text_end = text_start + (if pos.codepoint > 0xFFFF { 2 } else { 1 })
    glyphs.push({
      codepoint: pos.codepoint,
      glyph_id: pos.glyph_id,
      text_start,
      text_end,
      x: pos.x_offset,
      y: pos.y_offset,
      advance_width: pos.x_advance,
      ink_bounds: ink_cache.positioned(
        pos.glyph_id,
        pos.x_offset,
        pos.y_offset,
        scale,
      ),
    })
    text_start = text_end
    advance_width = pos.x_offset + pos.x_advance
  }
  text_bounds_from_glyphs(self, glyphs, advance_width, scale)
}
