///|
test "renderer/empty glyphs do not allocate or evict atlas pages" {
  guard! parse_font(load_fixture("fixtures/shaping-reference/serif-bold.ttf"))
    is Some(font)
  let renderer = TextRenderer::new_with_options(font, 32, 10, 0, 2)
  guard! renderer.ensure_glyph('A'.to_int(), 24.0) is Some((page_id, entry))
  let before = renderer.get_page(page_id).get_pixels().copy()
  ignore(renderer.flush_dirty_pages())
  for _ in 0..<20 {
    assert_true(renderer.ensure_glyph(' '.to_int(), 24.0) is None)
  }
  assert_eq(renderer.page_count(), 1)
  assert_eq(renderer.glyph_count(), 1)
  assert_eq(renderer.flush_dirty_pages().length(), 0)
  guard! renderer.ensure_glyph('A'.to_int(), 24.0) is Some((after_id, after))
  assert_eq(page_id, after_id)
  assert_eq(entry.atlas_x, after.atlas_x)
  assert_eq(entry.atlas_y, after.atlas_y)
  assert_eq(before, renderer.get_page(after_id).get_pixels())
}

///|
test "renderer/page pressure retains exact raster pixels after eviction" {
  guard! parse_font(load_fixture("fixtures/shaping-reference/serif-bold.ttf"))
    is Some(font)
  let renderer = TextRenderer::new_with_options(font, 32, 20, 0, 2)
  for ch in "AVHelloAV" {
    guard! rasterize_glyph(font, ch.to_int(), 24.0) is Some(bitmap)
    guard! renderer.ensure_glyph(ch.to_int(), 24.0) is Some((page_id, entry))
    let page = renderer.get_page(page_id)
    assert_true(page_id < 2)
    assert_eq(entry.atlas_w, bitmap.width.to_double())
    assert_eq(entry.atlas_h, bitmap.height.to_double())
    for y in 0..<bitmap.height {
      for x in 0..<bitmap.width {
        for component in 0..<4 {
          assert_eq(
            page.pixels[(
              (entry.atlas_y.to_int() + y) * page.width +
              entry.atlas_x.to_int() +
              x
            ) *
            4 +
            component],
            bitmap.pixels[(y * bitmap.width + x) * 4 + component],
          )
        }
      }
    }
  }
  assert_eq(renderer.page_count(), 2)
}
