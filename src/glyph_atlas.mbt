///|
/// Atlas that combines region tracking (GlyphCache) with pixel storage.

///|
pub struct GlyphAtlas {
  cache : GlyphCache
  width : Int32
  height : Int32
  pixels : Array[Int32]
  mut dirty : Bool
  mut last_used_generation : Int32
}

///|
pub fn GlyphAtlas::new(
  width : Int32,
  height : Int32,
  page_id : Int32,
) -> GlyphAtlas {
  let total = width * height * 4
  let pixels : Array[Int32] = Array::make(total, 0)
  {
    cache: GlyphCache::new(width.to_double(), height.to_double(), page_id),
    width,
    height,
    pixels,
    dirty: false,
    last_used_generation: 0,
  }
}

///|
pub fn GlyphAtlas::get_cache(self : GlyphAtlas) -> GlyphCache {
  self.cache
}

///|
pub fn GlyphAtlas::get_pixels(self : GlyphAtlas) -> Array[Int32] {
  self.pixels
}

///|
/// Rasterize a single glyph and place it into the atlas.
pub fn GlyphAtlas::rasterize_glyph(
  self : GlyphAtlas,
  font : TTFont,
  codepoint : Int32,
  size_px : Double,
) -> GlyphCacheEntry? {
  let glyph_id = font.glyph_index(codepoint)
  let cache_key = make_glyph_cache_key(glyph_id, size_px)
  match self.cache.get(cache_key) {
    Some(entry) => return Some(entry)
    None => ()
  }
  match rasterize_glyph(font, codepoint, size_px) {
    None => None
    Some(bitmap) =>
      match
        self.cache.allocate(
          cache_key,
          bitmap.width.to_double(),
          bitmap.height.to_double(),
        ) {
        None => None
        Some(entry) => {
          blit_to_atlas(
            self.pixels,
            self.width,
            bitmap,
            entry.atlas_x.to_int(),
            entry.atlas_y.to_int(),
          )
          self.dirty = true
          Some(entry)
        }
      }
  }
}
