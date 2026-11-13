///|
pub(all) struct GlyphBBox {
  x_min : Int32
  y_min : Int32
  x_max : Int32
  y_max : Int32
}

///|
pub(all) struct GlyphMetrics {
  advance_width : Int32
  left_side_bearing : Int32
  bbox : GlyphBBox
}

///|
pub(all) struct Glyph {
  glyph_id : Int32
  metrics : GlyphMetrics
  outline : Array[@svg.PathCommand]
}

///|
pub(all) struct TTFont {
  units_per_em : Int32
  index_to_loc_format : Int32
  num_glyphs : Int32
  ascent : Int32
  descent : Int32
  line_gap : Int32
  num_h_metrics : Int32
  glyf_offset : Int32
  data : Bytes
  /// sfnt header offset within data (nonzero for a face in a collection).
  sfnt_offset : Int32
  cmap : Map[Int32, Int32]
  loca : Array[Int32]
  advance_widths : Array[Int32]
  left_side_bearings : Array[Int32]
  cff : CFFData?
  gvar : GvarData?
  var_axes : Array[VarAxis]
  kern_pairs : Map[Int32, Int32]
  avar_segments : Array[Array[(Double, Double)]]
  name_records : Map[Int32, String]
  os2 : OS2Table?
  post : PostTable?
  vertical : VerticalMetrics?
  gasp : Array[GaspRange]
  vorg : VorgData?
}

///|
pub(all) struct VarAxis {
  tag : String
  min_value : Double
  default_value : Double
  max_value : Double
}

///|
pub(all) struct VarRegionAxis {
  start_coord : Double
  peak_coord : Double
  end_coord : Double
}

///|
pub(all) struct VarRegion {
  axes : Array[VarRegionAxis]
}

///|
pub(all) struct ItemVariationData {
  region_indices : Array[Int32]
  delta_sets : Array[Array[Int32]]
}

///|
pub(all) struct ItemVariationStore {
  regions : Array[VarRegion]
  data : Array[ItemVariationData]
}

///|
pub(all) struct CFFIndex {
  data_offset : Int32
  offsets : Array[Int32]
}

///|
pub(all) struct CFFData {
  charstrings : CFFIndex
  global_subrs : CFFIndex
  local_subrs : CFFIndex
  default_width_x : Int32
  nominal_width_x : Int32
  is_cff2 : Bool
  ivs : ItemVariationStore?
}

///|
pub(all) struct GvarData {
  axis_count : Int32
  shared_tuples : Array[Array[Double]]
  gvar_offset : Int32
  glyph_var_data_offset : Int32
  glyph_offsets : Array[Int32]
}

///|
pub(all) struct OS2Table {
  version : Int32
  us_weight_class : Int32
  us_width_class : Int32
  fs_type : Int32
  panose : FixedArray[Int32]
  ul_unicode_range1 : Int32
  ul_unicode_range2 : Int32
  ul_unicode_range3 : Int32
  ul_unicode_range4 : Int32
  fs_selection : Int32
  s_typo_ascender : Int32
  s_typo_descender : Int32
  s_typo_line_gap : Int32
  us_win_ascent : Int32
  us_win_descent : Int32
  sx_height : Int32
  s_cap_height : Int32
}

///|
pub(all) struct VerticalMetrics {
  v_ascent : Int32
  v_descent : Int32
  advance_heights : Array[Int32]
  top_side_bearings : Array[Int32]
}

///|
pub(all) struct GaspRange {
  max_ppem : Int32
  behavior : Int32
}

///|
pub(all) struct VorgData {
  default_vert_origin_y : Int32
  vert_origins : Map[Int32, Int32]
}

///|
pub(all) struct PostTable {
  italic_angle : Double
  underline_position : Int32
  underline_thickness : Int32
  is_fixed_pitch : Bool
  glyph_names : Array[String]
}

///|
pub(all) struct GlyphPosition {
  codepoint : Int32
  glyph_id : Int32
  x_offset : Double
  y_offset : Double
  x_advance : Double
}

///|
priv struct TableRecord {
  offset : Int32
}

///|
priv struct GlyphPoint {
  x : Int32
  y : Int32
  on_curve : Bool
}
