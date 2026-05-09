///|
fn static_test_ttfont() -> @font.TTFont {
  let cmap : Map[Int, Int] = {}
  cmap['A'.to_int()] = 1
  {
    units_per_em: 1000,
    index_to_loc_format: 0,
    num_glyphs: 2,
    ascent: 800,
    descent: -200,
    line_gap: 0,
    num_h_metrics: 2,
    glyf_offset: 0,
    data: Bytes::new(0),
    cmap,
    loca: [0, 0, 0],
    advance_widths: [0, 500],
    left_side_bearings: [0, 0],
    cff: None,
    gvar: None,
    var_axes: [],
    kern_pairs: {},
    avar_segments: [],
    name_records: {},
    os2: None,
    post: None,
    vertical: None,
    gasp: [],
    vorg: None,
  }
}

///|
test "glyph_provider_from_font exposes weight-aware delegate" {
  let provider = glyph_provider_from_font(static_test_ttfont())
  match provider.get_glyph_by_weight {
    Some(glyph_by_weight) => {
      let (_, advance) = glyph_by_weight('A'.to_int(), 100.0, 500.0)
      inspect(advance, content="50")
    }
    None => fail("weight-aware font delegate is missing")
  }
}

///|
test "axis_values_for_weight maps CSS font-weight to OpenType wght" {
  let axes = axis_values_for_weight(650.0)
  inspect(axes.get("wght"), content="Some(650)")
}
