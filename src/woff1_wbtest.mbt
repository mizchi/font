///|
test "log2_floor" {
  @debug.debug_inspect(log2_floor(1), content="0")
  @debug.debug_inspect(log2_floor(2), content="1")
  @debug.debug_inspect(log2_floor(4), content="2")
  @debug.debug_inspect(log2_floor(8), content="3")
  @debug.debug_inspect(log2_floor(15), content="3")
  @debug.debug_inspect(log2_floor(16), content="4")
}

///|
test "pad4" {
  @debug.debug_inspect(pad4(0), content="0")
  @debug.debug_inspect(pad4(1), content="4")
  @debug.debug_inspect(pad4(4), content="4")
  @debug.debug_inspect(pad4(5), content="8")
  @debug.debug_inspect(pad4(7), content="8")
  @debug.debug_inspect(pad4(8), content="8")
}

///|
test "rebuild_sfnt roundtrip" {
  // Create a minimal table set and verify the sfnt structure
  let table1 = Bytes::from_array([b'\x01', b'\x02', b'\x03', b'\x04'])
  let table2 = Bytes::from_array([b'\xAA', b'\xBB', b'\xCC', b'\xDD', b'\xEE'])
  let tables : Array[(String, Bytes)] = [("head", table1), ("maxp", table2)]
  let flavor = 0x00010000
  let sfnt = rebuild_sfnt(flavor, tables)
  let reader = BinaryReader::new(sfnt)
  // Verify offset table
  @debug.debug_inspect(reader.read_uint32(), content="65536") // flavor = 0x00010000
  @debug.debug_inspect(reader.read_uint16(), content="2") // numTables
  // searchRange = (1 << 1) * 16 = 32
  @debug.debug_inspect(reader.read_uint16(), content="32")
  // entrySelector = 1
  @debug.debug_inspect(reader.read_uint16(), content="1")
  // rangeShift = 2 * 16 - 32 = 0
  @debug.debug_inspect(reader.read_uint16(), content="0")
  // First table record: "head"
  @debug.debug_inspect(
    reader.read_tag(),
    content=(
      #|"head"
    ),
  )
  let _checksum1 = reader.read_uint32()
  let offset1 = reader.read_uint32()
  let length1 = reader.read_uint32()
  @debug.debug_inspect(length1, content="4")
  // Second table record: "maxp"
  @debug.debug_inspect(
    reader.read_tag(),
    content=(
      #|"maxp"
    ),
  )
  let _checksum2 = reader.read_uint32()
  let offset2 = reader.read_uint32()
  let length2 = reader.read_uint32()
  @debug.debug_inspect(length2, content="5")
  // Verify table data at correct offsets
  let r1 = BinaryReader::at(sfnt, offset1)
  @debug.debug_inspect(r1.read_uint32(), content="16909060") // 0x01020304
  let r2 = BinaryReader::at(sfnt, offset2)
  @debug.debug_inspect(r2.read_uint8(), content="170") // 0xAA
  @debug.debug_inspect(r2.read_uint8(), content="187") // 0xBB
  @debug.debug_inspect(r2.read_uint8(), content="204") // 0xCC
  @debug.debug_inspect(r2.read_uint8(), content="221") // 0xDD
  @debug.debug_inspect(r2.read_uint8(), content="238") // 0xEE
  // offset2 should be offset1 + pad4(4) = offset1 + 4
  @debug.debug_inspect(offset2 - offset1, content="4")
}

///|
test "parse_font - too short" {
  let data = Bytes::from_array([b'\x00', b'\x01'])
  assert_true(parse_font(data) is None)
  // Also test with 4 bytes (still too short for sfnt header)
  let data2 = Bytes::from_array([b'\x00', b'\x01', b'\x00', b'\x00'])
  assert_true(parse_font(data2) is None)
}

///|
test "parse_woff1 - invalid magic" {
  // Not a WOFF magic → should return None
  let data = Bytes::make(44, b'\x00')
  assert_true(parse_woff1(data) is None)
}

///|
test "calc_table_checksum" {
  // Single 4-byte word: 0x01020304 → checksum = 0x01020304
  let data = Bytes::from_array([b'\x01', b'\x02', b'\x03', b'\x04'])
  @debug.debug_inspect(calc_table_checksum(data), content="16909060")
  // Two words
  let data2 = Bytes::from_array([
    b'\x00', b'\x00', b'\x00', b'\x01', b'\x00', b'\x00', b'\x00', b'\x02',
  ])
  @debug.debug_inspect(calc_table_checksum(data2), content="3") // 1 + 2
}
