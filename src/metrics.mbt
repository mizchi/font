///|
/// Parse head table: returns (units_per_em, index_to_loc_format)
pub fn parse_head(reader : BinaryReader, offset : Int) -> (Int, Int) {
  let units_per_em = reader.peek_uint16_at(offset + 18)
  let index_to_loc_format = reader.peek_int16_at(offset + 50)
  (units_per_em, index_to_loc_format)
}

///|
/// Parse maxp table: returns num_glyphs
pub fn parse_maxp(reader : BinaryReader, offset : Int) -> Int {
  reader.peek_uint16_at(offset + 4)
}

///|
/// Parse hhea table: returns (ascent, descent, line_gap, num_h_metrics)
pub fn parse_hhea(reader : BinaryReader, offset : Int) -> (Int, Int, Int, Int) {
  let ascent = reader.peek_int16_at(offset + 4)
  let descent = reader.peek_int16_at(offset + 6)
  let line_gap = reader.peek_int16_at(offset + 8)
  let num_h_metrics = reader.peek_uint16_at(offset + 34)
  (ascent, descent, line_gap, num_h_metrics)
}

///|
/// Parse loca table: returns array of glyph offsets into glyf table
pub fn parse_loca(
  reader : BinaryReader,
  offset : Int,
  num_glyphs : Int,
  format : Int,
) -> Array[Int] {
  let loca = Array::new(capacity=num_glyphs + 1)
  reader.seek(offset)
  for i = 0; i <= num_glyphs; i = i + 1 {
    if format == 0 {
      loca.push(reader.read_uint16() * 2)
    } else {
      loca.push(reader.read_uint32())
    }
  }
  loca
}

///|
/// Parse hmtx table: returns (advance_widths, left_side_bearings)
pub fn parse_hmtx(
  reader : BinaryReader,
  offset : Int,
  num_glyphs : Int,
  num_h_metrics : Int,
) -> (Array[Int], Array[Int]) {
  let advance_widths = Array::new(capacity=num_glyphs)
  let left_side_bearings = Array::new(capacity=num_glyphs)
  reader.seek(offset)
  let mut last_advance = 0
  for i = 0; i < num_glyphs; i = i + 1 {
    if i < num_h_metrics {
      last_advance = reader.read_uint16()
      advance_widths.push(last_advance)
      left_side_bearings.push(reader.read_int16())
    } else {
      advance_widths.push(last_advance)
      left_side_bearings.push(reader.read_int16())
    }
  }
  (advance_widths, left_side_bearings)
}

///|
/// Parse fvar table: returns array of variation axes
pub fn parse_fvar(reader : BinaryReader, offset : Int) -> Array[VarAxis] {
  reader.seek(offset)
  let _major = reader.read_uint16()
  let _minor = reader.read_uint16()
  let axis_array_offset = reader.read_uint16()
  let _reserved = reader.read_uint16()
  let axis_count = reader.read_uint16()
  let _axis_size = reader.read_uint16()
  let axes : Array[VarAxis] = []
  reader.seek(offset + axis_array_offset)
  for i = 0; i < axis_count; i = i + 1 {
    let tag = reader.read_tag()
    let min_value = reader.read_f16dot16()
    let default_value = reader.read_f16dot16()
    let max_value = reader.read_f16dot16()
    let _flags = reader.read_uint16()
    let _name_id = reader.read_uint16()
    axes.push({ tag, min_value, default_value, max_value })
    ignore(i)
  }
  axes
}
