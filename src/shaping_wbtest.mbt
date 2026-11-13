///|
test "shaping/GSUB ligatures retain source clusters" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("fi", 1000.0)
  assert_eq(result.bounds.glyphs.length(), 1)
  assert_eq(result.bounds.advance_width, 900.0)
  assert_eq(result.bounds.glyphs[0].text_start, 0)
  assert_eq(result.bounds.glyphs[0].text_end, 2)
  let disabled = font.shape_text("fi", 1000.0, ligatures=false)
  assert_eq(disabled.bounds.glyphs.length(), 2)
  assert_eq(disabled.bounds.advance_width, 1160.0)
}

///|
test "shaping/GPOS pair and class kerning" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  assert_eq(font.shape_text("AV", 1000.0).bounds.advance_width, 1120.0)
  assert_eq(
    font.shape_text("AV", 1000.0, kerning=false).bounds.advance_width,
    1200.0,
  )
  assert_eq(font.shape_text("oe", 1000.0).bounds.advance_width, 1160.0)
}

///|
test "shaping/mark attachment has zero advance and shares a cluster" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("A\u{301}", 1000.0)
  assert_eq(result.bounds.advance_width, 600.0)
  assert_eq(result.bounds.glyphs.length(), 2)
  assert_eq(result.bounds.glyphs[1].advance_width, 0.0)
  assert_eq(result.bounds.glyphs[1].x, 300.0)
  assert_eq(result.bounds.glyphs[1].y, -700.0)
  assert_eq(result.bounds.glyphs[1].text_start, 0)
  assert_eq(result.bounds.glyphs[1].text_end, 2)
}

///|
test "shaping/contextual substitutions and Arabic joining" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("oc", 1000.0)
  assert_true(result.bounds.glyphs[0].glyph_id != font.glyph_index(111))
  let arabic = font.shape_text("ببب", 1000.0)
  assert_eq(arabic.direction, "rtl")
  assert_eq(arabic.bounds.glyphs.length(), 3)
  assert_eq(arabic.bounds.glyphs[0].text_start, 2)
  assert_true(arabic.bounds.glyphs[0].glyph_id != font.glyph_index(0x628))
  assert_true(
    arabic.bounds.glyphs[0].glyph_id != arabic.bounds.glyphs[1].glyph_id,
  )
}

///|
test "shaping/BiDi visual ordering retains logical UTF-16 ranges" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("A אבג 123", 1000.0, direction=Ltr)
  let starts = result.bounds.glyphs.map(g => g.text_start)
  assert_eq(starts, [0, 1, 6, 7, 8, 5, 4, 3, 2])
  let unicode = font.shape_text("\u{10780}fi", 1000.0)
  assert_eq(unicode.bounds.glyphs[0].text_end, 2)
  assert_eq(unicode.bounds.glyphs[1].text_start, 2)
  assert_eq(unicode.bounds.glyphs[1].text_end, 4)
}

///|
test "shaping/collection selects the parsed face and compressed fonts work" {
  guard! parse_font_at(load_fixture("fixtures/shaping.ttc"), 1) is Some(font)
  let collection = font.shape_text("AV", 1000.0)
  assert_eq(collection.bounds.advance_width, 1080.0)
  guard! parse_font(load_fixture("fixtures/shaping.woff")) is Some(woff)
  assert_eq(woff.shape_text("fi", 1000.0).bounds.advance_width, 900.0)
}

///|
test "shaping/empty text and explicit RTL base direction" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("", 16.0, direction=Rtl)
  assert_eq(result.direction, "rtl")
  assert_eq(result.bounds.advance_width, 0.0)
  assert_true(result.bounds.ink_bounds is None)
}

///|
test "shaping/reject invalid sizes and multiple paragraphs" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let bad_size = try {
    ignore(font.shape_text("fi", -1.0))
    false
  } catch {
    InvalidFontSize => true
    _ => false
  }
  assert_true(bad_size)
  let bad_paragraph = try {
    ignore(font.shape_text("A\nV", 16.0))
    false
  } catch {
    MultipleParagraphs => true
    _ => false
  }
  assert_true(bad_paragraph)
  let zero = font.shape_text("fi", 0.0)
  assert_eq(zero.bounds.advance_width, 0.0)
  assert_true(zero.bounds.ink_bounds is None)
}

///|
test "shaping/format controls do not become missing glyphs" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text(
    "A \u{2067}אבג\u{2069} V",
    1000.0,
    direction=Ltr,
  )
  assert_eq(result.missing_codepoints.length(), 0)
  assert_eq(result.bounds.glyphs.length(), 7)
  assert_eq(result.bounds.advance_width, 3600.0)
}

///|
test "shaping/variable font weight changes advances and outline bounds" {
  guard! parse_font(
      load_fixture("fixtures/shaping-reference/roboto-variable.ttf"),
    )
    is Some(font)
  let light = font.shape_text("Hello world", 32.0, font_weight=100.0)
  let bold = font.shape_text("Hello world", 32.0, font_weight=900.0)
  assert_true(
    (light.bounds.advance_width - bold.bounds.advance_width).abs() > 1.0,
  )
  assert_eq(bold.variations.get("wght"), Some(900.0))
  guard! light.bounds.ink_bounds is Some(a)
  guard! bold.bounds.ink_bounds is Some(b)
  assert_true((a.width - b.width).abs() > 1.0)
}

///|
test "shaping/static font weight requests must match the loaded face" {
  guard! parse_font(load_fixture("fixtures/shaping-reference/serif-bold.ttf"))
    is Some(font)
  let bold = font.shape_text("office", 32.0, font_weight=700.0)
  assert_true(bold.bounds.advance_width > 0.0)
  let rejected = try {
    ignore(font.shape_text("office", 32.0, font_weight=400.0))
    false
  } catch {
    UnsupportedFontWeight => true
    _ => false
  }
  assert_true(rejected)
}

///|
test "shaping/variable weight applies nonlinear avar mapping to advances" {
  guard! parse_font(
      load_fixture("fixtures/shaping-reference/roboto-variable.ttf"),
    )
    is Some(font)
  let result = font.shape_text("H", 32.0, font_weight=700.0)
  assert_true((result.bounds.advance_width - 22.59521484375).abs() < 0.001)
}

///|
test "shaping/variable outline decoding includes phantom point delta runs" {
  guard! parse_font(
      load_fixture("fixtures/shaping-reference/roboto-variable.ttf"),
    )
    is Some(font)
  for weight in [100.0, 900.0] {
    let result = font.shape_text("w", 2048.0, font_weight=weight)
    guard! result.bounds.ink_bounds is Some(ink)
    assert_eq(ink.y, -1082.0)
  }
}
