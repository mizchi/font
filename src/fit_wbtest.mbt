///|
test "width check distinguishes underflow, fit and overflow at boundaries" {
  assert_eq(check_text_width(79.0, 80.0, 120.0).status, Underflow)
  assert_eq(check_text_width(80.0, 80.0, 120.0).status, Fits)
  assert_eq(check_text_width(120.0, 80.0, 120.0).status, Fits)
  let overflow = check_text_width(120.25, 80.0, 120.0)
  assert_eq(overflow.status, Overflow)
  assert_eq(overflow.overflow_by, 0.25)
  assert_eq(check_text_width(120.005, 80.0, 120.0, tolerance=0.01).status, Fits)
}

///|
test "shaped width can be checked without a browser" {
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(font)
  let result = font.shape_text("fi", 100.0)
  assert_eq(result.bounds.check_width(80.0, 100.0).status, Fits)
  assert_eq(result.bounds.check_width(0.0, 89.0).status, Overflow)
}

///|
test "width check rejects inconsistent limits" {
  let rejected = try {
    ignore(check_text_width(90.0, 120.0, 80.0))
    false
  } catch {
    InvalidWidthLimits => true
  }
  assert_true(rejected)
  assert_eq(check_text_width(0.0, 0.0, 0.0).status, Fits)
}
