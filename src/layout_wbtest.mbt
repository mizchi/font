///|
test "layout/empty_string" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  let positions = font.layout_text("", 100.0)
  @debug.debug_inspect(positions.length(), content="0")
}

///|
test "layout/single_char" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  let positions = font.layout_text("A", 100.0)
  @debug.debug_inspect(positions.length(), content="1")
  @debug.debug_inspect(positions[0].x_offset, content="0")
  @debug.debug_inspect(positions[0].codepoint, content="65")
}

///|
test "layout/av_kerning" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  // A=gid1, V=gid2, kern=-80, units_per_em=1000
  let positions = font.layout_text("AV", 1000.0)
  @debug.debug_inspect(positions.length(), content="2")
  // First glyph at x=0
  @debug.debug_inspect(positions[0].x_offset, content="0")
  // Second glyph: advance of A (600) + kern (-80) = 520
  let v_offset = positions[1].x_offset
  // advance_width for A is 600 in minimal_kern_ttf
  assert_true(v_offset < 600.0)
  assert_true(v_offset > 500.0)
}

///|
test "layout/measure_empty" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  let w = font.measure_text("", 100.0)
  @debug.debug_inspect(w, content="0")
}

///|
test "layout/streaming width agrees exactly with positioned advances" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  for
    text in [
      "", " ", "  AV  ", "AVAV", "office", "A\u{10780}V", "A\u{301}", "A אבג 123",
      "\u{1f600}\u{200d}\u{1f600}",
    ] {
    for size in [0.0, 13.25, 24.0, 1000.0] {
      let positions = font.layout_text(text, size)
      let expected = if positions.is_empty() {
        0.0
      } else {
        let last = positions[positions.length() - 1]
        last.x_offset + last.x_advance
      }
      assert_eq(font.measure_text(text, size), expected)
    }
  }
}

///|
test "layout/streaming width preserves lone UTF-16 surrogate behavior" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  font.cmap[0xD800] = font.glyph_index(' '.to_int())
  let high = (0xD800).unsafe_to_char()
  let low = (0xDC00).unsafe_to_char()
  assert_eq(font.measure_text(String::from_array([high]), 1000.0), 300.0)
  for
    text in [
      String::from_array([high, 'A', low]),
      String::from_array([high, low, 'A']),
      String::from_array([low, high]),
    ] {
    let positions = font.layout_text(text, 13.25)
    let last = positions[positions.length() - 1]
    assert_eq(font.measure_text(text, 13.25), last.x_offset + last.x_advance)
  }
}

///|
test "layout/measure_single" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  let w = font.measure_text("A", 1000.0)
  // advance_width for A is 600
  @debug.debug_inspect(w, content="600")
}

///|
test "layout/measure_av_with_kern" {
  let data = Bytes::from_array(minimal_kern_ttf[:])
  guard! parse_font(data) is Some(font)
  let w = font.measure_text("AV", 1000.0)
  // A(600) + kern(-80) + V(600) = 1120
  @debug.debug_inspect(w, content="1120")
}

///|
test "layout/noto_monospace_equal_advances" {
  let data = load_fixture("fixtures/NotoSansMono-Regular.ttf")
  guard! parse_font(data) is Some(font)
  let positions = font.layout_text("ABC", 100.0)
  // Monospace font: all advances should be equal
  assert_true(positions.length() == 3)
  let adv0 = positions[0].x_advance
  let adv1 = positions[1].x_advance
  let adv2 = positions[2].x_advance
  @debug.debug_inspect(adv0 == adv1, content="true")
  @debug.debug_inspect(adv1 == adv2, content="true")
}

///|
test "layout/noto_measure_hello" {
  let data = load_fixture("fixtures/NotoSansMono-Regular.ttf")
  guard! parse_font(data) is Some(font)
  let width = font.measure_text("Hello", 100.0)
  // 5 chars, each with equal advance in monospace
  assert_true(width > 0.0)
  // Each glyph should contribute equally
  let single = font.measure_text("H", 100.0)
  // Total should be ~5x single for monospace
  let ratio = width / single
  assert_true(ratio > 4.9 && ratio < 5.1)
}
