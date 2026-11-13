///|
/// Setup and font loading stay outside timed callbacks. Moon's benchmark
/// harness calibrates batches, collects samples and keeps results observable.
test "font performance" (b : @bench.T) {
  let bytes = load_fixture("fixtures/shaping-reference/serif-bold.ttf")
  let variable_bytes = load_fixture(
    "fixtures/shaping-reference/roboto-variable.ttf",
  )
  guard! parse_font(bytes) is Some(font)
  guard! parse_font(variable_bytes) is Some(variable)
  guard! parse_font(load_fixture("fixtures/shaping-reference/arabic.ttf"))
    is Some(arabic)
  guard! parse_font(
      load_fixture("fixtures/shaping-reference/japanese-variable.ttf"),
    )
    is Some(japanese)
  guard! parse_font(load_fixture("fixtures/shaping.ttf")) is Some(bidi)
  guard! parse_font(load_fixture("fixtures/NotoSans-subset.otf")) is Some(cff)
  let text = "Hello world office AV"
  let long = bench_repeat(text + " ", 32)
  let jp = bench_repeat("日本語のテキスト幅検査", 24)
  let ar = bench_repeat("العربية سلام ", 16)
  let mixed = bench_repeat("A אבג 123 ", 24)
  let repeated = bench_repeat("office AV ", 32)
  assert_true(font.shape_text(long, 24.0).missing_codepoints.is_empty())
  assert_true(arabic.shape_text(ar, 24.0).missing_codepoints.is_empty())
  assert_true(japanese.shape_text(jp, 24.0).missing_codepoints.is_empty())
  assert_true(bidi.shape_text(mixed, 24.0).missing_codepoints.is_empty())
  let outline = font.scaled_outline('A'.to_int(), 32.0)
  let warm = TextRenderer::new(font, 256, 0, 0)
  for ch in text {
    ignore(warm.ensure_glyph(ch.to_int(), 24.0))
  }
  b.bench(name="parse/static-ttf", () => b.keep(parse_font(bytes)))
  b.bench(name="parse/variable-ttf", () => b.keep(parse_font(variable_bytes)))
  b.bench(name="width/basic/latin-short", () => {
    b.keep(font.measure_text(text, 24.0))
  })
  b.bench(name="width/basic/latin-long", () => {
    b.keep(font.measure_text(long, 24.0))
  })
  b.bench(name="width/basic/japanese-long", () => {
    b.keep(japanese.measure_text(jp, 24.0))
  })
  b.bench(name="bounds/basic/latin-long", () => {
    b.keep(font.layout_text_bounds(long, 24.0))
  })
  b.bench(name="bounds/shaped/latin-short", () => {
    b.keep(try! font.shape_text(text, 24.0))
  })
  b.bench(name="bounds/shaped/latin-long", () => {
    b.keep(try! font.shape_text(long, 24.0))
  })
  b.bench(name="bounds/shaped/latin-repeated", () => {
    b.keep(try! font.shape_text(repeated, 24.0))
  })
  b.bench(name="bounds/shaped/arabic-long", () => {
    b.keep(try! arabic.shape_text(ar, 24.0))
  })
  b.bench(name="bounds/shaped/bidi-long", () => {
    b.keep(try! bidi.shape_text(mixed, 24.0))
  })
  b.bench(name="bounds/shaped/japanese-long", () => {
    b.keep(try! japanese.shape_text(jp, 24.0, font_weight=700.0))
  })
  b.bench(name="bounds/shaped/variable-weight", () => {
    b.keep(try! variable.shape_text(long, 24.0, font_weight=700.0))
  })
  b.bench(name="outline/control-bbox", () => b.keep(outline_bbox(outline)))
  b.bench(name="outline/tight-bounds", () => {
    b.keep(compute_path_bounds(outline))
  })
  b.bench(name="outline/svg-serialization", () => {
    b.keep(path_commands_to_svg_d(outline))
  })
  b.bench(name="render/rasterize-ttf-A-32", () => {
    b.keep(rasterize_glyph(font, 'A'.to_int(), 32.0))
  })
  b.bench(name="render/rasterize-cff-A-32", () => {
    b.keep(rasterize_glyph(cff, 'A'.to_int(), 32.0))
  })
  b.bench(name="render/atlas-cold", () => {
    let renderer = TextRenderer::new(font, 256, 0, 0)
    for ch in text {
      ignore(renderer.ensure_glyph(ch.to_int(), 24.0))
    }
    b.keep(renderer)
  })
  b.bench(name="render/atlas-warm", () => {
    for ch in text {
      b.keep(warm.ensure_glyph(ch.to_int(), 24.0))
    }
  })
  b.bench(name="render/atlas-pressure", () => {
    let renderer = TextRenderer::new_with_options(font, 32, 0, 0, 4)
    for ch in text {
      ignore(renderer.ensure_glyph(ch.to_int(), 24.0))
    }
    b.keep(renderer)
  })
  println("FONT_BENCH_JSON " + b.dump_summaries())
}

///|
fn bench_repeat(text : String, count : Int32) -> String {
  let result = StringBuilder()
  for _ in 0..<count {
    result.write_string(text)
  }
  result.to_string()
}
