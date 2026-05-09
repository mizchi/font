///|
pub fn system_font_face_candidates() -> Array[(Array[String], Array[String])] {
  [
    (
      [
        "/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
      ],
      [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
      ],
    ),
    (
      [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
      ],
      [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
      ],
    ),
    (["/System/Library/Fonts/SFNS.ttf"], []),
    (
      [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf", "/Library/Fonts/AppleGothic.ttf",
        "/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", "/usr/local/share/fonts/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf", "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
      ],
      [
        "/System/Library/Fonts/STHeiti Medium.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
        "/usr/local/share/fonts/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Bold.otf",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
      ],
    ),
  ]
}

///|
fn load_first_glyph_provider(
  read_binary_file : (String) -> Bytes,
  paths : Array[String],
) -> @glyph_provider.GlyphProvider? {
  for path in paths {
    let data = read_binary_file(path)
    if data.length() > 100 {
      match @glyph_provider.glyph_provider_from_bytes(data) {
        Some(provider) => return Some(provider)
        None => ()
      }
    }
  }
  None
}

///|
fn provider_for_weight(
  pair : (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  is_bold : Bool,
) -> @glyph_provider.GlyphProvider {
  let (regular, bold) = pair
  if is_bold {
    match bold {
      Some(bold_provider) => bold_provider
      None => regular
    }
  } else {
    regular
  }
}

///|
fn glyph_from_pair(
  pair : (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  codepoint : Int,
  font_size : Double,
  is_bold : Bool,
  font_weight : Double,
) -> (Array[@svg.PathCommand], Double) {
  let provider = provider_for_weight(pair, is_bold)
  match provider.get_glyph_by_weight {
    Some(glyph_by_weight) => glyph_by_weight(codepoint, font_size, font_weight)
    None => (provider.get_glyph)(codepoint, font_size, is_bold)
  }
}

///|
fn kern_from_pair(
  pair : (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  cp1 : Int,
  cp2 : Int,
  font_size : Double,
  is_bold : Bool,
  font_weight : Double,
) -> Double {
  let provider = provider_for_weight(pair, is_bold)
  match provider.get_kern_by_weight {
    Some(kern_by_weight) => kern_by_weight(cp1, cp2, font_size, font_weight)
    None => (provider.get_kern)(cp1, cp2, font_size, is_bold)
  }
}

///|
fn choose_glyph_by_weight(
  providers : Array[
    (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  ],
  codepoint : Int,
  font_size : Double,
  font_weight : Double,
) -> (Array[@svg.PathCommand], Double) {
  let is_bold = font_weight >= 600.0
  let first = glyph_from_pair(
    providers[0],
    codepoint,
    font_size,
    is_bold,
    font_weight,
  )
  let (_, first_advance) = first
  if first_advance > 0.0 {
    return first
  }
  for pair in providers {
    let candidate = glyph_from_pair(
      pair, codepoint, font_size, is_bold, font_weight,
    )
    let (_, advance) = candidate
    if advance > 0.0 {
      return candidate
    }
  }
  first
}

///|
fn max_ascent(
  pair : (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
) -> Double {
  let (regular, bold) = pair
  match bold {
    Some(bold_provider) =>
      if bold_provider.ascent_ratio > regular.ascent_ratio {
        bold_provider.ascent_ratio
      } else {
        regular.ascent_ratio
      }
    None => regular.ascent_ratio
  }
}

///|
fn resolve_ascent_ratio(
  providers : Array[
    (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  ],
) -> Double {
  let mut ascent = max_ascent(providers[0])
  for pair in providers {
    let candidate = max_ascent(pair)
    if candidate > ascent {
      ascent = candidate
    }
  }
  ascent
}

///|
pub fn merge_glyph_provider_pairs(
  providers : Array[
    (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  ],
) -> @glyph_provider.GlyphProvider {
  {
    get_glyph: fn(codepoint, font_size, is_bold) {
      let font_weight = if is_bold { 700.0 } else { 400.0 }
      choose_glyph_by_weight(providers, codepoint, font_size, font_weight)
    },
    get_kern: fn(cp1, cp2, font_size, is_bold) {
      let font_weight = if is_bold { 700.0 } else { 400.0 }
      kern_from_pair(providers[0], cp1, cp2, font_size, is_bold, font_weight)
    },
    get_glyph_by_weight: Some(fn(codepoint, font_size, font_weight) {
      choose_glyph_by_weight(providers, codepoint, font_size, font_weight)
    }),
    get_kern_by_weight: Some(fn(cp1, cp2, font_size, font_weight) {
      kern_from_pair(
        providers[0],
        cp1,
        cp2,
        font_size,
        font_weight >= 600.0,
        font_weight,
      )
    }),
    ascent_ratio: resolve_ascent_ratio(providers),
  }
}

///|
pub fn load_system_glyph_provider(
  read_binary_file : (String) -> Bytes,
) -> @glyph_provider.GlyphProvider? {
  let providers : Array[
    (@glyph_provider.GlyphProvider, @glyph_provider.GlyphProvider?),
  ] = []
  for candidate in system_font_face_candidates() {
    let (regular_paths, bold_paths) = candidate
    match load_first_glyph_provider(read_binary_file, regular_paths) {
      Some(regular_provider) => {
        let bold_provider = if bold_paths.is_empty() {
          None
        } else {
          load_first_glyph_provider(read_binary_file, bold_paths)
        }
        providers.push((regular_provider, bold_provider))
      }
      None => ()
    }
  }
  if providers.is_empty() {
    None
  } else {
    Some(merge_glyph_provider_pairs(providers))
  }
}
