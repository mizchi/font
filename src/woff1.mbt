///|
/// WOFF1 magic number: "wOFF" = 0x774F4646
let woff1_magic : Int = 0x774F4646

///|
/// Parse a WOFF1 font, decompress tables, rebuild sfnt, and delegate to parse_ttf
pub fn parse_woff1(data : Bytes) -> TTFont? {
  let reader = BinaryReader::new(data)
  // WOFF1 Header (44 bytes)
  let signature = reader.read_uint32()
  if signature != woff1_magic {
    return None
  }
  let flavor = reader.read_uint32()
  let _length = reader.read_uint32()
  let num_tables = reader.read_uint16()
  let _reserved = reader.read_uint16()
  let _total_sfnt_size = reader.read_uint32()
  let _major_version = reader.read_uint16()
  let _minor_version = reader.read_uint16()
  let _meta_offset = reader.read_uint32()
  let _meta_length = reader.read_uint32()
  let _meta_orig_length = reader.read_uint32()
  let _priv_offset = reader.read_uint32()
  let _priv_length = reader.read_uint32()
  // Read table directory entries (20 bytes each)
  let entries : Array[(String, Int, Int, Int)] = [] // (tag, offset, compLength, origLength)
  for i = 0; i < num_tables; i = i + 1 {
    let tag = reader.read_tag()
    let offset = reader.read_uint32()
    let comp_length = reader.read_uint32()
    let orig_length = reader.read_uint32()
    let _orig_checksum = reader.read_uint32()
    entries.push((tag, offset, comp_length, orig_length))
    ignore(i)
  }
  // Decompress each table
  let tables : Array[(String, Bytes)] = []
  for i = 0; i < entries.length(); i = i + 1 {
    let (tag, offset, comp_length, orig_length) = entries[i]
    let table_data = if comp_length < orig_length {
      // Compressed: extract slice and decompress with zlib
      let compressed = bytes_slice(data, offset, comp_length)
      @zlib.zlib_decompress(compressed) catch {
        _ => return None
      }
    } else {
      // Uncompressed: copy as-is
      bytes_slice(data, offset, orig_length)
    }
    tables.push((tag, table_data))
    ignore(i)
  }
  let sfnt = rebuild_sfnt(flavor, tables)
  parse_ttf(sfnt)
}

///|
/// Copy a slice of Bytes
fn bytes_slice(data : Bytes, offset : Int, length : Int) -> Bytes {
  Bytes::makei(length, fn(i) { data[offset + i] })
}

///|
/// Rebuild an sfnt (TrueType/OpenType) binary from individual table data.
/// Produces: Offset Table (12 bytes) + Table Records (16 bytes × n) + Table Data (4-byte aligned)
fn rebuild_sfnt(flavor : Int, tables : Array[(String, Bytes)]) -> Bytes {
  let num_tables = tables.length()
  // Calculate searchRange, entrySelector, rangeShift
  let entry_selector = log2_floor(num_tables)
  let search_range = (1 << entry_selector) * 16
  let range_shift = num_tables * 16 - search_range
  // Header = 12 bytes, each table record = 16 bytes
  let header_size = 12 + num_tables * 16
  // Calculate total size with 4-byte padding
  let mut total_size = header_size
  for i = 0; i < num_tables; i = i + 1 {
    let (_, tdata) = tables[i]
    total_size += pad4(tdata.length())
    ignore(i)
  }
  let out : Array[Byte] = Array::make(total_size, b'\x00')
  // Write Offset Table
  write_be32(out, 0, flavor)
  write_be16(out, 4, num_tables)
  write_be16(out, 6, search_range)
  write_be16(out, 8, entry_selector)
  write_be16(out, 10, range_shift)
  // Write Table Records and Table Data
  let mut data_offset = header_size
  for i = 0; i < num_tables; i = i + 1 {
    let (tag, tdata) = tables[i]
    let record_offset = 12 + i * 16
    // Write tag (4 bytes)
    for j = 0; j < 4; j = j + 1 {
      out[record_offset + j] = tag[j].to_int().to_byte()
    }
    // Write checksum
    let checksum = calc_table_checksum(tdata)
    write_be32(out, record_offset + 4, checksum)
    // Write offset
    write_be32(out, record_offset + 8, data_offset)
    // Write length
    write_be32(out, record_offset + 12, tdata.length())
    // Copy table data
    for j = 0; j < tdata.length(); j = j + 1 {
      out[data_offset + j] = tdata[j]
    }
    data_offset += pad4(tdata.length())
    ignore(i)
  }
  Bytes::from_array(out[:])
}

///|
/// Calculate table checksum per OpenType spec
fn calc_table_checksum(data : Bytes) -> Int {
  let len = pad4(data.length())
  let mut sum = 0
  for i = 0; i < len; i = i + 4 {
    let b0 = if i < data.length() { data[i].to_int() } else { 0 }
    let b1 = if i + 1 < data.length() { data[i + 1].to_int() } else { 0 }
    let b2 = if i + 2 < data.length() { data[i + 2].to_int() } else { 0 }
    let b3 = if i + 3 < data.length() { data[i + 3].to_int() } else { 0 }
    sum = sum + ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3)
  }
  sum
}

///|
/// Floor of log2(n), minimum 0
fn log2_floor(n : Int) -> Int {
  let mut result = 0
  let mut val = n
  while val > 1 {
    val = val >> 1
    result += 1
  }
  result
}

///|
/// Round up to next multiple of 4
fn pad4(n : Int) -> Int {
  (n + 3) & -4
}

///|
/// Write a big-endian uint32 into Array[Byte]
fn write_be32(out : Array[Byte], offset : Int, value : Int) -> Unit {
  out[offset] = ((value >> 24) & 0xFF).to_byte()
  out[offset + 1] = ((value >> 16) & 0xFF).to_byte()
  out[offset + 2] = ((value >> 8) & 0xFF).to_byte()
  out[offset + 3] = (value & 0xFF).to_byte()
}

///|
/// Write a big-endian uint16 into Array[Byte]
fn write_be16(out : Array[Byte], offset : Int, value : Int) -> Unit {
  out[offset] = ((value >> 8) & 0xFF).to_byte()
  out[offset + 1] = (value & 0xFF).to_byte()
}
