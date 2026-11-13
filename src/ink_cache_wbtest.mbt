///|
test "bounds/cache retains unpositioned bounds including empty glyphs" {
  guard! parse_font(load_fixture("fixtures/shaping-reference/serif-bold.ttf"))
    is Some(font)
  let cache = GlyphInkCache::new(font, Map([]))
  let gid = font.glyph_index('A'.to_int())
  guard! compute_path_bounds(font.glyph_outline(gid)) is Some(raw)
  for (x, y, scale) in [(0.0, 0.0, 1.0), (17.5, -3.25, 0.5), (-4.0, 9.0, 2.0)] {
    guard! cache.positioned(gid, x, y, scale) is Some(actual)
    assert_eq(actual.x, x + raw.x * scale)
    assert_eq(actual.y, y - (raw.y + raw.height) * scale)
    assert_eq(actual.width, raw.width * scale)
    assert_eq(actual.height, raw.height * scale)
  }
  assert_eq(cache.bounds.length(), 1)
  let space = font.glyph_index(' '.to_int())
  for _ in 0..<5 {
    assert_true(cache.positioned(space, 0.0, 0.0, 1.0) is None)
  }
  assert_eq(cache.bounds.length(), 2)
  assert_true(cache.bounds.get(space) is Some(None))
  assert_true(cache.positioned(gid, 0.0, 0.0, 0.0) is None)
}

///|
test "bounds/cache is scoped to one variable instance" {
  guard! parse_font(
      load_fixture("fixtures/shaping-reference/roboto-variable.ttf"),
    )
    is Some(font)
  let gid = font.glyph_index('H'.to_int())
  let light = GlyphInkCache::new(font, { "wght": 100.0 })
  let bold = GlyphInkCache::new(font, { "wght": 900.0 })
  guard! light.positioned(gid, 0.0, 0.0, 1.0) is Some(a)
  guard! bold.positioned(gid, 0.0, 0.0, 1.0) is Some(b)
  assert_true(a.width != b.width)
  guard! light.positioned(gid, 5.0, 0.0, 1.0) is Some(again)
  assert_eq(again.x, a.x + 5.0)
  assert_eq(again.width, a.width)
}
