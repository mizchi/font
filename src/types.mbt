///|
pub(all) struct GlyphBBox {
  x_min : Int
  y_min : Int
  x_max : Int
  y_max : Int
}

///|
pub(all) struct GlyphMetrics {
  advance_width : Int
  left_side_bearing : Int
  bbox : GlyphBBox
}

///|
pub(all) struct Glyph {
  glyph_id : Int
  metrics : GlyphMetrics
  outline : Array[@svg.PathCommand]
}

///|
pub(all) struct TTFont {
  units_per_em : Int
  index_to_loc_format : Int
  num_glyphs : Int
  ascent : Int
  descent : Int
  line_gap : Int
  num_h_metrics : Int
  glyf_offset : Int
  data : Bytes
  cmap : Map[Int, Int]
  loca : Array[Int]
  advance_widths : Array[Int]
  left_side_bearings : Array[Int]
  cff : CFFData?
}

///|
pub(all) struct CFFIndex {
  data_offset : Int
  offsets : Array[Int]
}

///|
pub(all) struct CFFData {
  charstrings : CFFIndex
  global_subrs : CFFIndex
  local_subrs : CFFIndex
  default_width_x : Int
  nominal_width_x : Int
}

///|
priv struct TableRecord {
  offset : Int
}

///|
priv struct GlyphPoint {
  x : Int
  y : Int
  on_curve : Bool
}
