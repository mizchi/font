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

| Format | Status | Notes |
|--------|--------|-------|
| TTF (TrueType) | Supported | sfnt flavor `0x00010000` and `0x74727565` |
| OTF (OpenType/CFF) | Supported | sfnt flavor `OTTO` |
| WOFF1 | Supported | zlib decompression |
| WOFF2 | Supported | Brotli decompression with glyf/loca/hmtx transforms |
| TTC/OTC (Font Collections) | Supported | Index-based or first-font access |

### OpenType Tables

#### Parsed Tables

| Table | Description | Details |
|-------|-------------|---------|
| `head` | Font header | units_per_em, indexToLocFormat |
| `maxp` | Maximum profile | numGlyphs |
| `hhea` | Horizontal header | ascent, descent, lineGap, numOfLongHorMetrics |
| `hmtx` | Horizontal metrics | advanceWidth, leftSideBearing per glyph |
| `cmap` | Character mapping | Format 4 (BMP), Format 12 (full Unicode) |
| `loca` | Glyph locations | Short and long formats |
| `glyf` | Glyph outlines | Simple and compound glyphs |
| `CFF ` | CFF1 outlines | Type 2 charstrings with subroutines |
| `CFF2` | CFF2 outlines | Variable font support with blend/vsindex |
| `fvar` | Font variations | Axis definitions (wght, wdth, opsz, etc.) |
| `avar` | Axis variations | Piecewise linear axis value mapping |
| `gvar` | Glyph variations | TrueType delta interpolation with IUP |
| `kern` | Kerning | Format 0 horizontal pairs |
| `name` | Naming | Windows Unicode, Unicode platform, Mac Roman |
| `OS/2` | OS/2 metrics | Weight class, width class, PANOSE, x-height, cap-height |
| `post` | PostScript | Italic angle, fixed pitch, glyph names (v2.0) |

#### Not Parsed

| Table | Description | Notes |
|-------|-------------|-------|
| `GSUB` | Glyph substitution | Ligatures, contextual alternates, etc. |
| `GPOS` | Glyph positioning | Pair adjustment, mark attachment, etc. |
| `GDEF` | Glyph definition | Glyph classes, mark attachment |
| `BASE` | Baseline | Baseline alignment data |
| `MATH` | Math typesetting | Math layout constants and glyph assembly |
| `COLR`/`CPAL` | Color fonts | Color layers and palettes |
| `SVG ` | SVG outlines | SVG glyph documents |
| `CBDT`/`CBLC` | Color bitmaps | Emoji bitmaps |
| `sbix` | Apple bitmaps | Apple-style bitmap glyphs |
| `EBDT`/`EBLC` | Embedded bitmaps | Monochrome/grayscale bitmaps |
| `DSIG` | Digital signature | Font signing |
| `JSTF` | Justification | Justification alternatives |
| `morx`/`mort` | Apple AAT | Apple Advanced Typography |
| `cvt`/`fpgm`/`prep` | Hinting | TrueType instruction programs |
| `gasp` | Grid-fitting | Grid-fitting and scan conversion |
| `hdmx` | Horizontal device metrics | Pre-computed widths |
| `vhea`/`vmtx` | Vertical metrics | Vertical layout metrics |
| `VORG` | Vertical origin | CFF vertical origin |
| `cvar` | CVT variation | Variation of CVT values |

### CFF / CFF2 Charstring Operators

#### Supported

| Category | Operators |
|----------|-----------|
| Move | `rmoveto`, `hmoveto`, `vmoveto` |
| Line | `rlineto`, `hlineto`, `vlineto` |
| Curve | `rrcurveto`, `hhcurveto`, `vvcurveto`, `hvcurveto`, `vhcurveto` |
| Mixed | `rcurveline`, `rlinecurve` |
| Flex | `flex`, `hflex`, `vflex`, `hflex1`, `flex1` |
| Hint | `hstem`, `vstem`, `hstemhm`, `vstemhm`, `hintmask`, `cntrmask` |
| Subroutine | `callsubr`, `callgsubr`, `return` |
| Arithmetic | `add`, `sub`, `mul`, `div`, `neg`, `abs`, `sqrt`, `eq` |
| Logic | `and`, `or`, `not`, `ifelse` |
| Stack | `dup`, `exch`, `drop`, `index`, `roll`, `put`, `get` |
| CFF2 | `blend`, `vsindex` |
| Control | `endchar` |

#### Not Supported

| Operator | Notes |
|----------|-------|
| `seac` | Deprecated accent composition |
| `dotsection` | Deprecated hint operator |

### Glyph Outlines

| Feature | Status |
|---------|--------|
| Simple glyphs (TrueType) | Supported |
| Compound glyphs (TrueType) | Supported — component transforms (scale, 2x2 matrix, XY offset) |
| CFF1 charstrings | Supported — local/global subroutines |
| CFF2 charstrings | Supported — blend interpolation |
| TrueType variations (gvar) | Supported — shared tuples, IUP, delta unpacking |
| CFF2 variations (ItemVariationStore) | Supported — region scalars, blend deltas |
| Hinting / instruction execution | Not supported — instructions are skipped |

### cmap Formats

| Format | Status | Coverage |
|--------|--------|----------|
| Format 4 | Supported | BMP (U+0000–U+FFFF) |
| Format 12 | Supported | Full Unicode (preferred over Format 4) |
| Format 0 | Not supported | Mac Roman 256-char mapping |
| Format 2 | Not supported | CJK mixed 8/16-bit encoding |
| Format 6 | Not supported | Trimmed table mapping |
| Format 14 | Not supported | Unicode Variation Sequences (UVS) |

### Kerning

| Feature | Status |
|---------|--------|
| `kern` table Format 0 (flat pairs) | Supported |
| `kern` table Format 1 (Apple state machine) | Not supported |
| `GPOS` pair adjustment (PairPos) | Not supported |
| `GPOS` contextual kerning | Not supported |

### Font Subsetting

| Feature | Status |
|---------|--------|
| Glyf-based TrueType subsetting | Supported |
| Compound glyph dependency resolution | Supported |
| Glyph ID remapping | Supported |
| cmap Format 12 rebuild | Supported |
| Table copy (head, hhea, hmtx, maxp, name, OS/2, post) | Supported |
| CFF/CFF2 subsetting | Not supported |
| WOFF/WOFF2 output | Not supported — outputs raw sfnt (TTF) |
| Layout table subsetting (GSUB/GPOS) | Not supported |

### Text Layout

| Feature | Status |
|---------|--------|
| Horizontal advance widths | Supported |
| Pair kerning (`kern` table) | Supported |
| UTF-16 surrogate pair handling | Supported |
| Text width measurement | Supported |
| OpenType layout (GSUB/GPOS shaping) | Not supported |
| Bidirectional text | Not supported |
| Vertical layout | Not supported |
| Line breaking | Not supported |

### JS Bindings

12 exported functions for the JavaScript/Wasm target:

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
| `tableSizes()` | JSON string | Table tag → byte size |

## Dependencies

- [mizchi/svg](https://github.com/mizchi/svg) — `PathCommand` type for glyph outlines
- [mizchi/zlib](https://github.com/mizchi/zlib) — WOFF1 decompression
- [mizchi/brotli](https://github.com/mizchi/brotli) — WOFF2 decompression

## Test Fonts

`fixtures/NotoSansMono-Regular.ttf` is licensed under the [SIL Open Font License](https://scripts.sil.org/OFL).

## License

Apache-2.0
