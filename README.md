# mizchi/font

TrueType/OTF(CFF)/WOFF/WOFF2 font parser written in [MoonBit](https://www.moonbitlang.com/).

Parses font binary data and converts glyph outlines to `@svg.PathCommand` (from [mizchi/svg](https://github.com/mizchi/svg)).

## Usage

```moonbit
let data : Bytes = ... // TTF, OTF, WOFF, WOFF2, or TTC file bytes
let font = @font.parse_font(data).unwrap()

// Get glyph outline as SVG path commands
let cmds = font.scaled_outline('A'.to_int(), 48.0)

// Get glyph metrics
let gid = font.glyph_index('A'.to_int())
let metrics = font.glyph_metrics(gid)

// Text layout with kerning
let positions = font.layout_text("Hello", 48.0)
let width = font.measure_text("Hello", 48.0)

// Variable font with axis values
let cmds = font.char_outline_at('A'.to_int(), { "wght": 700.0 })

// Font subsetting (glyf-based TrueType only)
let subset = @font.subset_font(data, [0x41, 0x42, 0x43]) // A, B, C
```

## Supported Specifications

### Font Formats

| Format | | Notes |
|--------|:-:|-------|
| TTF (TrueType) | ✅ | sfnt flavor `0x00010000` and `0x74727565` |
| OTF (OpenType/CFF) | ✅ | sfnt flavor `OTTO` |
| WOFF1 | ✅ | zlib decompression |
| WOFF2 | ✅ | Brotli decompression with glyf/loca/hmtx transforms |
| TTC/OTC (Font Collections) | ✅ | Index-based or first-font access |

### OpenType Tables

| Table | | Description |
|-------|:-:|-------------|
| `head` | ✅ | units_per_em, indexToLocFormat |
| `maxp` | ✅ | numGlyphs |
| `hhea` | ✅ | ascent, descent, lineGap, numOfLongHorMetrics |
| `hmtx` | ✅ | advanceWidth, leftSideBearing per glyph |
| `cmap` | ✅ | Format 4 (BMP) + Format 12 (full Unicode) |
| `loca` | ✅ | Short and long formats |
| `glyf` | ✅ | Simple and compound glyphs |
| `CFF ` | ✅ | Type 2 charstrings with subroutines |
| `CFF2` | ✅ | Variable font support with blend/vsindex |
| `fvar` | ✅ | Axis definitions (wght, wdth, opsz, etc.) |
| `avar` | ✅ | Piecewise linear axis value mapping |
| `gvar` | ✅ | TrueType delta interpolation with IUP |
| `kern` | ✅ | Format 0 horizontal pairs |
| `name` | ✅ | Windows Unicode, Unicode platform, Mac Roman |
| `OS/2` | ✅ | Weight/width class, PANOSE, x-height, cap-height |
| `post` | ✅ | Italic angle, fixed pitch, glyph names (v2.0) |
| `GSUB` | ❌ | Glyph substitution (ligatures, alternates) |
| `GPOS` | ❌ | Glyph positioning (pair adjustment, marks) |
| `GDEF` | ❌ | Glyph definition (classes, mark attachment) |
| `BASE` | ❌ | Baseline alignment data |
| `MATH` | ❌ | Math layout constants and glyph assembly |
| `COLR`/`CPAL` | ❌ | Color font layers and palettes |
| `SVG ` | ❌ | SVG glyph documents |
| `CBDT`/`CBLC` | ❌ | Color bitmap glyphs (emoji) |
| `sbix` | ❌ | Apple-style bitmap glyphs |
| `EBDT`/`EBLC` | ❌ | Monochrome/grayscale bitmaps |
| `DSIG` | ❌ | Digital signature |
| `JSTF` | ❌ | Justification alternatives |
| `morx`/`mort` | ❌ | Apple Advanced Typography |
| `cvt`/`fpgm`/`prep` | ❌ | TrueType hinting programs |
| `vhea`/`vmtx` | ❌ | Vertical layout metrics |
| `cvar` | ❌ | CVT variation |

### CFF / CFF2 Charstring Operators

| Category | | Operators |
|----------|:-:|-----------|
| Move | ✅ | `rmoveto`, `hmoveto`, `vmoveto` |
| Line | ✅ | `rlineto`, `hlineto`, `vlineto` |
| Curve | ✅ | `rrcurveto`, `hhcurveto`, `vvcurveto`, `hvcurveto`, `vhcurveto` |
| Mixed | ✅ | `rcurveline`, `rlinecurve` |
| Flex | ✅ | `flex`, `hflex`, `vflex`, `hflex1`, `flex1` |
| Hint | ✅ | `hstem`, `vstem`, `hstemhm`, `vstemhm`, `hintmask`, `cntrmask` |
| Subroutine | ✅ | `callsubr`, `callgsubr`, `return` |
| Arithmetic | ✅ | `add`, `sub`, `mul`, `div`, `neg`, `abs`, `sqrt`, `eq` |
| Logic | ✅ | `and`, `or`, `not`, `ifelse` |
| Stack | ✅ | `dup`, `exch`, `drop`, `index`, `roll`, `put`, `get` |
| CFF2 Variation | ✅ | `blend`, `vsindex` |
| Control | ✅ | `endchar` |
| Deprecated | ➖ | `seac` (accent composition), `dotsection` |

### Glyph Outlines

| Feature | | Notes |
|---------|:-:|-------|
| Simple glyphs (TrueType) | ✅ | |
| Compound glyphs (TrueType) | ✅ | Scale, 2x2 matrix, XY offset transforms |
| CFF1 charstrings | ✅ | Local/global subroutines |
| CFF2 charstrings | ✅ | Blend interpolation |
| TrueType variations (gvar) | ✅ | Shared tuples, IUP, delta unpacking |
| CFF2 variations (ItemVariationStore) | ✅ | Region scalars, blend deltas |
| Hinting / instruction execution | ❌ | Instructions are preserved but not executed |

### cmap Formats

| Format | | Coverage |
|--------|:-:|----------|
| Format 4 | ✅ | BMP (U+0000–U+FFFF) |
| Format 12 | ✅ | Full Unicode (preferred when available) |
| Format 0 | ❌ | Mac Roman 256-char mapping |
| Format 2 | ❌ | CJK mixed 8/16-bit encoding |
| Format 6 | ❌ | Trimmed table mapping |
| Format 14 | ❌ | Unicode Variation Sequences (UVS) |

### Kerning

| Feature | | Notes |
|---------|:-:|-------|
| `kern` table Format 0 (flat pairs) | ✅ | |
| `kern` table Format 1 (Apple state machine) | ❌ | |
| `GPOS` pair adjustment (PairPos) | ❌ | |
| `GPOS` contextual kerning | ❌ | |

### Font Subsetting

| Feature | | Notes |
|---------|:-:|-------|
| Glyf-based TrueType subsetting | ✅ | |
| Compound glyph dependency resolution | ✅ | |
| Glyph ID remapping | ✅ | |
| cmap Format 12 rebuild | ✅ | |
| Table copy (head, hhea, hmtx, maxp, name, OS/2, post) | ✅ | |
| CFF/CFF2 subsetting | ❌ | |
| WOFF/WOFF2 output | ❌ | Outputs raw sfnt (TTF) |
| Layout table subsetting (GSUB/GPOS) | ❌ | |

### Text Layout

| Feature | | Notes |
|---------|:-:|-------|
| Horizontal advance widths | ✅ | |
| Pair kerning (`kern` table) | ✅ | |
| UTF-16 surrogate pair handling | ✅ | |
| Text width measurement | ✅ | |
| OpenType shaping (GSUB/GPOS) | ❌ | |
| Bidirectional text | ❌ | |
| Vertical layout | ❌ | |
| Line breaking | ❌ | |

### JS Bindings (Wasm)

12 exported functions:

| Function | Returns | Description |
|----------|---------|-------------|
| `loadFont(data)` | JSON string | Parse font, return metrics |
| `getFontInfo()` | JSON string | Get cached font info |
| `glyphToSvgPath(codepoint, fontSize)` | SVG path string | Scaled glyph outline |
| `glyphAdvance(codepoint, fontSize)` | Double | Scaled advance width |
| `fontName(nameId)` | String | Name table lookup |
| `kernAdvance(cp1, cp2, fontSize)` | Double | Scaled kerning value |
| `layoutText(text, fontSize)` | JSON string | Glyph positions with kerning |
| `measureText(text, fontSize)` | Double | Total text width |
| `fontWeightClass()` | Int | OS/2 weight class |
| `isFixedPitch()` | Int (0/1) | Post table fixed-pitch flag |
| `codepointCoverage()` | JSON string | All supported codepoints |
| `tableSizes()` | JSON string | Table tag to byte size |

## Dependencies

- [mizchi/svg](https://github.com/mizchi/svg) — `PathCommand` type for glyph outlines
- [mizchi/zlib](https://github.com/mizchi/zlib) — WOFF1 decompression
- [mizchi/brotli](https://github.com/mizchi/brotli) — WOFF2 decompression

## Test Fonts

`fixtures/NotoSansMono-Regular.ttf` is licensed under the [SIL Open Font License](https://scripts.sil.org/OFL).

## License

Apache-2.0
