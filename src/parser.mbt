///|
/// Parse a font from raw bytes, auto-detecting format (TTF, OTF, or WOFF1)
pub fn parse_font(data : Bytes) -> TTFont? {
  // Minimum header: sfnt = 12 bytes, WOFF1 = 44 bytes
  if data.length() < 12 {
    return None
  }
  let magic = (data[0].to_int() << 24) |
    (data[1].to_int() << 16) |
    (data[2].to_int() << 8) |
    data[3].to_int()
  if magic == 0x774F4646 {
    // wOFF (WOFF1)
    parse_woff1(data)
  } else if magic == 0x774F4632 {
    // wOF2 (WOFF2)
    parse_woff2(data)
  } else {
    // 0x00010000 (TrueType), 0x4F54544F (OTTO/CFF), 0x74727565 (true)
    parse_ttf(data)
  }
}

///|
/// Parse a TrueType font from raw bytes
pub fn parse_ttf(data : Bytes) -> TTFont? {
  let reader = BinaryReader::new(data)
  let _sfnt_version = reader.read_uint32()
  let num_tables = reader.read_uint16()
  let _search_range = reader.read_uint16()
  let _entry_selector = reader.read_uint16()
  let _range_shift = reader.read_uint16()
  let tables : Map[String, TableRecord] = {}
  for i = 0; i < num_tables; i = i + 1 {
    let tag = reader.read_tag()
    let _checksum = reader.read_uint32()
    let offset = reader.read_uint32()
    let _length = reader.read_uint32()
    tables[tag] = { offset, }
    ignore(i)
  }
  guard tables.get("head") is Some(head_rec) else { return None }
  guard tables.get("maxp") is Some(maxp_rec) else { return None }
  guard tables.get("hhea") is Some(hhea_rec) else { return None }
  guard tables.get("hmtx") is Some(hmtx_rec) else { return None }
  guard tables.get("loca") is Some(loca_rec) else { return None }
  guard tables.get("cmap") is Some(cmap_rec) else { return None }
  guard tables.get("glyf") is Some(glyf_rec) else { return None }
  let (units_per_em, index_to_loc_format) = parse_head(reader, head_rec.offset)
  let num_glyphs = parse_maxp(reader, maxp_rec.offset)
  let (ascent, descent, line_gap, num_h_metrics) = parse_hhea(
    reader,
    hhea_rec.offset,
  )
  let loca = parse_loca(
    reader,
    loca_rec.offset,
    num_glyphs,
    index_to_loc_format,
  )
  let (advance_widths, left_side_bearings) = parse_hmtx(
    reader,
    hmtx_rec.offset,
    num_glyphs,
    num_h_metrics,
  )
  let cmap = parse_cmap(reader, cmap_rec.offset)
  Some({
    units_per_em,
    index_to_loc_format,
    num_glyphs,
    ascent,
    descent,
    line_gap,
    num_h_metrics,
    glyf_offset: glyf_rec.offset,
    data,
    cmap,
    loca,
    advance_widths,
    left_side_bearings,
  })
}

///|
pub fn TTFont::glyph_index(self : TTFont, codepoint : Int) -> Int {
  match self.cmap.get(codepoint) {
    Some(id) => id
    None => 0
  }
}

///|
pub fn TTFont::glyph_outline(
  self : TTFont,
  glyph_id : Int,
) -> Array[@svg.PathCommand] {
  glyph_outline_by_id(self, glyph_id)
}

///|
pub fn TTFont::char_outline(
  self : TTFont,
  codepoint : Int,
) -> Array[@svg.PathCommand] {
  let gid = self.glyph_index(codepoint)
  self.glyph_outline(gid)
}

///|
pub fn TTFont::glyph_metrics(self : TTFont, glyph_id : Int) -> GlyphMetrics {
  let advance = if glyph_id < self.advance_widths.length() {
    self.advance_widths[glyph_id]
  } else {
    0
  }
  let lsb = if glyph_id < self.left_side_bearings.length() {
    self.left_side_bearings[glyph_id]
  } else {
    0
  }
  let bbox = if glyph_id < self.num_glyphs && glyph_id < self.loca.length() - 1 {
    let glyf_off = self.loca[glyph_id]
    let next_off = self.loca[glyph_id + 1]
    if glyf_off != next_off {
      let offset = self.glyf_offset + glyf_off
      let r = BinaryReader::at(self.data, offset)
      let _num_contours = r.read_int16()
      let x_min = r.read_int16()
      let y_min = r.read_int16()
      let x_max = r.read_int16()
      let y_max = r.read_int16()
      { x_min, y_min, x_max, y_max }
    } else {
      { x_min: 0, y_min: 0, x_max: 0, y_max: 0 }
    }
  } else {
    { x_min: 0, y_min: 0, x_max: 0, y_max: 0 }
  }
  { advance_width: advance, left_side_bearing: lsb, bbox }
}

///|
pub fn TTFont::get_glyph(self : TTFont, codepoint : Int) -> Glyph {
  let gid = self.glyph_index(codepoint)
  let metrics = self.glyph_metrics(gid)
  let outline = self.glyph_outline(gid)
  { glyph_id: gid, metrics, outline }
}

///|
pub fn TTFont::scaled_outline(
  self : TTFont,
  codepoint : Int,
  font_size : Double,
) -> Array[@svg.PathCommand] {
  let outline = self.char_outline(codepoint)
  let s = font_size / self.units_per_em.to_double()
  scale_commands(outline, s, true)
}
