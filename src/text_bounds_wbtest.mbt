///|
test "text bounds measure real CFF outlines" {
  guard! parse_font(load_fixture("fixtures/NotoSans-subset.otf")) is Some(font)
  let result = font.layout_text_bounds("Ag", 100.0)
  guard! result.ink_bounds is Some(ink)
  assert_true(ink.width > 100.0)
  assert_true(ink.y < -70.0)
  assert_true(ink.y + ink.height > 20.0)
  assert_true(result.glyphs[0].ink_bounds is Some(_))
  assert_true(result.glyphs[1].ink_bounds is Some(_))
}

///|
test "text bounds keep whitespace advance without ink" {
  guard! parse_font(load_fixture("fixtures/NotoSansMono-Regular.ttf"))
    is Some(font)
  let empty = font.layout_text_bounds("", 16.0)
  assert_eq(empty.advance_width, 0.0)
  assert_eq(empty.glyphs.length(), 0)
  assert_true(empty.ink_bounds is None)
  assert_true(empty.to_json().stringify().contains("\"ink_bounds\":null"))
  let spaces = font.layout_text_bounds("  ", 16.0)
  assert_eq(spaces.advance_width, font.measure_text("  ", 16.0))
  assert_true(spaces.advance_width > 0.0)
  assert_true(spaces.ink_bounds is None)
  assert_eq(spaces.logical_bounds.width, spaces.advance_width)
  assert_true(spaces.logical_bounds.y < 0.0)
}

///|
test "text bounds use baseline coordinates and preserve fractional precision" {
  guard! parse_font(load_fixture("fixtures/NotoSansMono-Regular.ttf"))
    is Some(font)
  let result = font.layout_text_bounds("Ag", 13.25)
  assert_eq(result.advance_width, font.measure_text("Ag", 13.25))
  assert_eq(result.glyphs.length(), 2)
  guard! result.ink_bounds is Some(ink)
  assert_true(ink.y < 0.0)
  assert_true(ink.y + ink.height > 0.0)
  assert_true(ink.width > 0.0)
  let bbox = font.glyph_metrics(font.glyph_index(0x41)).bbox
  guard! result.glyphs[0].ink_bounds is Some(a)
  assert_true((a.x - bbox.x_min.to_double() * 13.25 / 1000.0).abs() < 1.0e-10)
}

///|
test "text bounds include kerning and UTF-16 source ranges" {
  guard! parse_font(Bytes::from_array(minimal_kern_ttf[:])) is Some(font)
  let result = font.layout_text_bounds("AV", 1000.0)
  assert_eq(result.advance_width, 1120.0)
  assert_eq(result.glyphs[1].x, 520.0)
  guard! parse_font(load_fixture("fixtures/NotoSansMono-Regular.ttf"))
    is Some(noto)
  let unicode = noto.layout_text_bounds("A\u{10780}V", 16.0)
  assert_eq(unicode.glyphs.length(), 3)
  assert_eq(unicode.glyphs[1].text_start, 1)
  assert_eq(unicode.glyphs[1].text_end, 3)
  assert_eq(unicode.glyphs[2].text_start, 3)
  assert_eq(unicode.glyphs[2].text_end, 4)
}

///|
test "text bounds exclude leading and trailing spaces from ink" {
  guard! parse_font(load_fixture("fixtures/NotoSansMono-Regular.ttf"))
    is Some(font)
  let plain = font.layout_text_bounds("A", 20.0)
  let padded = font.layout_text_bounds(" A ", 20.0)
  guard! plain.ink_bounds is Some(a)
  guard! padded.ink_bounds is Some(b)
  assert_eq(b.width, a.width)
  assert_eq(b.x, a.x + font.measure_text(" ", 20.0))
  assert_true(padded.glyphs[0].ink_bounds is None)
  assert_true(padded.glyphs[2].ink_bounds is None)
}
