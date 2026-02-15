///|
/// Parse cmap table: returns Map[codepoint -> glyph_id]
pub fn parse_cmap(reader : BinaryReader, offset : Int) -> Map[Int, Int] {
  let result : Map[Int, Int] = {}
  reader.seek(offset)
  let _version = reader.read_uint16()
  let num_tables = reader.read_uint16()
  let mut subtable_offset = -1
  for i = 0; i < num_tables; i = i + 1 {
    let platform_id = reader.read_uint16()
    let encoding_id = reader.read_uint16()
    let sub_offset = reader.read_uint32()
    if platform_id == 0 || (platform_id == 3 && encoding_id == 1) {
      subtable_offset = offset + sub_offset
    }
    ignore(i)
  }
  if subtable_offset < 0 {
    return result
  }
  reader.seek(subtable_offset)
  let format = reader.read_uint16()
  if format == 4 {
    parse_cmap_format4(reader, subtable_offset, result)
  }
  result
}

///|
fn parse_cmap_format4(
  reader : BinaryReader,
  subtable_offset : Int,
  result : Map[Int, Int],
) -> Unit {
  reader.seek(subtable_offset + 2)
  let _length = reader.read_uint16()
  let _language = reader.read_uint16()
  let seg_count_x2 = reader.read_uint16()
  let seg_count = seg_count_x2 / 2
  let _search_range = reader.read_uint16()
  let _entry_selector = reader.read_uint16()
  let _range_shift = reader.read_uint16()
  let end_codes = Array::new(capacity=seg_count)
  for i = 0; i < seg_count; i = i + 1 {
    end_codes.push(reader.read_uint16())
    ignore(i)
  }
  let _reserved_pad = reader.read_uint16()
  let start_codes = Array::new(capacity=seg_count)
  for i = 0; i < seg_count; i = i + 1 {
    start_codes.push(reader.read_uint16())
    ignore(i)
  }
  let id_deltas = Array::new(capacity=seg_count)
  for i = 0; i < seg_count; i = i + 1 {
    id_deltas.push(reader.read_int16())
    ignore(i)
  }
  let id_range_offset_base = reader.position()
  let id_range_offsets = Array::new(capacity=seg_count)
  for i = 0; i < seg_count; i = i + 1 {
    id_range_offsets.push(reader.read_uint16())
    ignore(i)
  }
  for seg = 0; seg < seg_count; seg = seg + 1 {
    let start = start_codes[seg]
    let end = end_codes[seg]
    if start == 0xFFFF {
      // skip sentinel segment (avoid `continue seg` - MoonBit JS codegen bug)
    } else {
      for cp = start; cp <= end; cp = cp + 1 {
        let glyph_id = if id_range_offsets[seg] == 0 {
          (cp + id_deltas[seg]) % 65536
        } else {
          let range_offset_addr = id_range_offset_base + seg * 2
          let glyph_data_offset = range_offset_addr +
            id_range_offsets[seg] +
            (cp - start) * 2
          let gid = reader.peek_uint16_at(glyph_data_offset)
          if gid != 0 {
            (gid + id_deltas[seg]) % 65536
          } else {
            0
          }
        }
        if glyph_id != 0 {
          result[cp] = glyph_id
        }
      }
    }
  }
}
