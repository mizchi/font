# mizchi/font

TrueType/OTF(CFF)/WOFF/WOFF2 font parser written in [MoonBit](https://www.moonbitlang.com/).

Parses font binary data and converts glyph outlines to `@svg.PathCommand` (from [mizchi/svg](https://github.com/mizchi/svg)).

Current release: **0.8.0**. See [CHANGELOG.md](CHANGELOG.md) for changes and migration notes.

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

// Baseline-relative logical/ink rectangles and per-glyph UTF-16 ranges
let bounds = font.layout_text_bounds("Hello", 48.0)
let ink = bounds.ink_bounds // None for empty text or spaces

// OpenType shaping and mixed LTR/RTL layout, with source cluster ranges
let shaped = font.shape_text("office AV אבג", 48.0, direction=@font.Auto)
let width = shaped.bounds.advance_width
let runs = shaped.runs // Visual order, script, embedding level and glyph ranges

// Variable font with axis values
let cmds = font.char_outline_at('A'.to_int(), { "wght": 700.0 })

// Vertical text layout
let vpositions = font.layout_text_vertical("縦書き", 48.0)
let vheight = font.measure_text_vertical("縦書き", 48.0)

// Font subsetting (glyf-based TrueType only)
let subset = @font.subset_font(data, [0x41, 0x42, 0x43]) // A, B, C
```

## Supported Specifications

This library covers **glyph rendering, metrics, variable fonts, OpenType shaping and bidirectional layout**. `shape_text` connects the pure MoonBit [Swash port](https://github.com/moonbit-community/moon_swash) for GSUB/GPOS/GDEF to [Unicode BiDi](https://github.com/moonbit-community/tonyfettes-unicode). It returns positioned glyphs, cluster source ranges and visual runs. `layout_text`, `measure_text` and `layout_text_bounds` retain their basic codepoint-to-glyph LTR behavior with legacy `kern` adjustment.

### Font Formats

| Format | | Notes |
|--------|:-:|-------|
| TTF (TrueType) | ✅ | sfnt flavor `0x00010000` and `0x74727565` |
| OTF (OpenType/CFF) | ✅ | sfnt flavor `OTTO` |
| WOFF1 | ✅ | zlib decompression |
| WOFF2 | ✅ | Brotli decompression with glyf/loca/hmtx transforms |
| TTC/OTC (Font Collections) | ✅ | Index-based or first-font access |

### OpenType Tables

#### ✅ Parsed

| Table | Description |
|-------|-------------|
| `head` | units_per_em, indexToLocFormat |
| `maxp` | numGlyphs |
| `hhea` | ascent, descent, lineGap, numOfLongHorMetrics |
| `hmtx` | advanceWidth, leftSideBearing per glyph |
| `cmap` | Format 0, 4 (BMP), 6, and 12 (full Unicode) |
| `loca` | Short and long formats |
| `glyf` | Simple and compound glyphs |
| `CFF ` | Type 2 charstrings with subroutines |
| `CFF2` | Variable font support with blend/vsindex |
| `fvar` | Axis definitions (wght, wdth, opsz, etc.) |
| `avar` | Piecewise linear axis value mapping |
| `gvar` | TrueType delta interpolation with IUP |
| `kern` | Format 0 horizontal pairs |
| `name` | Windows Unicode, Unicode platform, Mac Roman |
| `OS/2` | Weight/width class, PANOSE, x-height, cap-height |
| `post` | Italic angle, fixed pitch, glyph names (v2.0) |
| `vhea`/`vmtx` | Vertical metrics — advance heights and top side bearings |
| `gasp` | Grid-fitting and scan-conversion ranges |
| `VORG` | Vertical origin Y coordinates for CFF glyphs |

`shape_text` additionally processes `GSUB` (substitution), `GPOS` (positioning) and `GDEF` (glyph classes and lookup filtering) through Swash. These tables are not exposed as fields on `TTFont`.

#### ❌ Not Parsed

The tables below are **not** parsed. Most of them are only needed for advanced use cases.

**📐 Additional Layout Tables**

| Table | Description |
|-------|-------------|
| `BASE` | Baseline offsets for mixing scripts (e.g. Latin + CJK in one line) |
| `JSTF` | Justification alternatives for full-justified text |

**🎨 Color & Emoji** — Required for rendering color emoji and multi-color glyphs. Not needed for monochrome text rendering.

| Table | Description |
|-------|-------------|
| `COLR`/`CPAL` | Color layers with palettes (COLRv0/v1 color fonts) |
| `SVG ` | SVG glyph documents (SVG-in-OpenType color fonts) |
| `CBDT`/`CBLC` | Color bitmap glyphs (Google/Android emoji) |
| `sbix` | Apple bitmap glyphs (Apple emoji) |
| `EBDT`/`EBLC` | Monochrome/grayscale embedded bitmaps (legacy low-res screens) |

**📐 Specialized Rendering** — Needed only for specific rendering scenarios.

| Table | Description |
|-------|-------------|
| `MATH` | Math layout constants and glyph assembly — only for TeX-like math typesetting engines |
| `cvt`/`fpgm`/`prep` | TrueType hinting programs — grid-fitting instructions for low-DPI rasterization. Irrelevant for SVG/vector output |
| `hdmx` | Pre-computed device widths for specific PPEMs — legacy optimization for bitmap rendering |

**🍎 Apple AAT** — Apple-proprietary layout system. Most modern fonts use OpenType (GSUB/GPOS) instead. Only found in macOS system fonts and some legacy fonts.

| Table | Description |
|-------|-------------|
| `morx`/`mort` | Apple Advanced Typography — state-machine-based shaping |

**🔒 Other** — Rarely needed for rendering or layout.

| Table | Description |
|-------|-------------|
| `DSIG` | Digital signature — font authenticity verification, does not affect rendering |
| `cvar` | CVT variations — hinting value adjustments in variable fonts, only relevant if hinting is executed |

### CFF / CFF2 Charstring Operators

All standard operators for outline extraction are supported:

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
| Deprecated | ➖ | `seac`, `dotsection` — removed from modern specs |

### Glyph Outlines

| Feature | | Notes |
|---------|:-:|-------|
| Simple glyphs (TrueType) | ✅ | |
| Compound glyphs (TrueType) | ✅ | Scale, 2x2 matrix, XY offset transforms |
| CFF1 charstrings | ✅ | Local/global subroutines |
| CFF2 charstrings | ✅ | Blend interpolation |
| TrueType variations (gvar) | ✅ | Shared tuples, IUP, delta unpacking |
| CFF2 variations (ItemVariationStore) | ✅ | Region scalars, blend deltas |
| Hinting / instruction execution | ❌ | Not needed for vector/SVG output |

### cmap Formats

Formats 0, 4, 6, and 12 cover virtually all modern fonts. The unsupported formats are legacy or niche:

| Format | | Coverage |
|--------|:-:|----------|
| Format 0 | ✅ | Mac Roman 256-char |
| Format 4 | ✅ | BMP (U+0000–U+FFFF) |
| Format 6 | ✅ | Trimmed table |
| Format 12 | ✅ | Full Unicode (preferred when available) |
| Format 2 | ❌ | CJK mixed 8/16-bit — obsolete encoding, replaced by Format 12 |
| Format 14 | ❌ | Unicode Variation Sequences — needed for CJK glyph variants (e.g. JP vs CN forms) |

### Kerning

Basic layout uses the legacy `kern` table. `shape_text` applies GPOS kerning through Swash:

| Feature | | Notes |
|---------|:-:|-------|
| `kern` table Format 0 (flat pairs) | ✅ | Covers most Latin fonts |
| `kern` table Format 1 (Apple state machine) | ❌ | Apple-only, rare in cross-platform fonts |
| `GPOS` pair adjustment (PairPos) | ✅ | Pair and class adjustments through `shape_text` |
| `GPOS` contextual positioning | ✅ | Handled by the shaping backend |

### Font Subsetting

Subsetting extracts only the glyphs you need, reducing file size for web delivery:

| Feature | | Notes |
|---------|:-:|-------|
| Glyf-based TrueType subsetting | ✅ | |
| Compound glyph dependency resolution | ✅ | |
| Glyph ID remapping | ✅ | |
| cmap Format 12 rebuild | ✅ | |
| Table copy (head, hhea, hmtx, maxp, name, OS/2, post) | ✅ | |
| CFF/CFF2 subsetting | ❌ | CFF charstring rewriting is complex |
| WOFF/WOFF2 output | ❌ | Outputs raw sfnt — wrap with external compressor |
| Layout table subsetting (GSUB/GPOS) | ❌ | Requires lookup/coverage rewriting |

### Text Layout

Basic LTR/vertical APIs and the shaped horizontal paragraph API serve different layout needs:

| Feature | | Notes |
|---------|:-:|-------|
| Horizontal advance widths | ✅ | |
| Pair kerning (`kern` table) | ✅ | |
| UTF-16 surrogate pair handling | ✅ | |
| Text width measurement | ✅ | |
| OpenType shaping (GSUB/GPOS) | ✅ | `shape_text`: ligatures, contextual forms, kerning and mark positioning |
| Bidirectional text | ✅ | Resolved levels, isolates, mirroring and visual runs through Unicode BiDi |
| Vertical layout | ✅ | Top-to-bottom CJK typesetting (vhea/vmtx/VORG) |
| Line breaking | ❌ | Text wrapping — typically handled by the application layer |

### Shaped paragraphs

```moonbit
let shaped = font.shape_text(
  "fi AV אבג 123",
  32.0,
  direction=@font.Auto, // Also Ltr and Rtl
  language="und",      // BCP 47, e.g. "ar", "he", "tr"
  kerning=true,
  ligatures=true,
  font_weight=700.0, // Optional: select wght on a variable font
  axis_values={ "wdth": 90.0 }, // Optional: explicit axes override font_weight
)
let fit = shaped.bounds.check_width(80.0, 240.0)
// fit.status: Underflow, Fits or Overflow; inclusive limits in CSS pixels
```

`ShapedText.bounds` contains advance/logical/ink bounds and glyphs in visual order. Each glyph's `text_start`/`text_end` is a half-open UTF-16 cluster range into the original string. A ligature spans several characters; bases and combining marks can share one range. `codepoint` is the first original code point of that cluster, not a reverse mapping of the substituted glyph. `runs` adds source/glyph ranges, script, BiDi level, direction, x and advance. `missing_codepoints` reports unsupported input characters, excluding default-ignorable formatting controls.

The API shapes one paragraph. It uses the default variation instance unless `font_weight` or `axis_values` is supplied; selected axes are reported in `ShapedText.variations`. Weight must be finite and between 1 and 1000. A static face accepts only its own OS/2 weight: load the appropriate face instead of expecting synthetic bold. Unknown or non-finite axes raise `ShapingError`; valid axis values are clamped to the font's range. The pinned Swash 0.1.15 adapter compensates for its `avar` reader, so non-linear axis mapping affects both shaped advances and outlines.

It also raises `ShapingError` for an invalid size/font or paragraph separators. Font fallback, CSS spacing, wrapping, shaped vertical layout and caret positions inside ligatures are outside this API. The browser can supply fallback glyphs for missing code points, so such results are diagnostic comparisons rather than parity guarantees. Variable compound-glyph outlines still fall back to their default outlines; use browser layout for fit inspection rather than treating every MoonBit ink rectangle as a browser paint bound. Consumers constructing `TTFont` records manually must initialize the new `sfnt_offset` field to zero for standalone sfnt data; parsed TTC faces retain their actual header offset.

`check_text_width(width, min, max, tolerance=0.01)` and `TextBounds.check_width` perform finite, nonnegative interval checks without wrapping. Results include the measured width and the amount below or above the limits. Classification uses tolerance; reported deviations retain their original fractional values.

### JS Bindings

The bindings in `src/js` build to a JavaScript ESM module with `moon build --target js --release`. MoonBit also generates TypeScript declarations next to the module.

18 exported functions:

| Function | Returns | Description |
|----------|---------|-------------|
| `loadFont(data)` | JSON string | Parse font, return metrics |
| `getFontInfo()` | JSON string | Get cached font info |
| `glyphToSvgPath(codepoint, fontSize)` | SVG path string | Scaled glyph outline |
| `glyphOutlineCommands(codepoint, fontSize)` | JSON string | Scaled path commands |
| `glyphAdvance(codepoint, fontSize)` | Double | Scaled advance width |
| `fontName(nameId)` | String | Name table lookup |
| `kernAdvance(cp1, cp2, fontSize)` | Double | Scaled kerning value |
| `layoutText(text, fontSize)` | JSON string | Glyph positions with kerning |
| `measureText(text, fontSize)` | Double | Total text width |
| `layoutTextBounds(text, fontSize)` | JSON string | Advance, logical/ink bounds and positioned glyph bounds; `null` if unloaded or size is invalid |
| `shapeText(text, fontSize, direction, language, kerning, ligatures)` | JSON string | `{ok:true,result:ShapedText}` or `{ok:false,error:{code,message}}` |
| `shapeTextWithWeight(text, fontSize, direction, language, kerning, ligatures, weight)` | JSON string | Same shaped contract, selecting the requested weight |
| `shapeTextWithAxes(text, fontSize, direction, language, kerning, ligatures, weight, axesJson)` | JSON string | Same contract with explicit numeric variation axes; malformed input returns an error |
| `fontWeightClass()` | Int | OS/2 weight class |
| `isFixedPitch()` | Int (0/1) | Post table fixed-pitch flag |
| `codepointCoverage()` | JSON string | All supported codepoints |
| `glyphIds()` | JSON string | All glyph IDs (0 to numGlyphs-1) |
| `tableSizes()` | JSON string | Table tag to byte size |

Font info includes `weight_class`, `italic` and variable `axes` (`tag`, `min`, `default`, `max`), in addition to the existing metrics.

### Checking whether text fits

Use `browser/fit.js` for checks against actual browser layout. It waits for web fonts and returns both modes in one report:

```js
import { checkTextFit, inspectTextFit } from '/browser/fit.js';

const result = await checkTextFit('Hello world Hello world', {
  minWidth: 40,
  maxWidth: 120,
  maxHeight: 96, // Omit for an unconstrained height
  requiredFonts: ['YourLoadedFont'], // Optional: require a registered web font
  allowTruncation: false, // Default: require the full text
  style: {
    fontFamily: 'YourLoadedFont, sans-serif',
    fontSize: '20px', fontWeight: '700', lineHeight: '28px',
    whiteSpace: 'normal', overflowWrap: 'anywhere',
  },
});
console.log(result.unwrapped.status); // Natural max-content width vs [40, 120]
console.log(result.layout.status);    // Actual wrapping and height at 120 x 96
console.log(result.layout.overflowX, result.layout.overflowY);
console.log(result.accepted);          // Wrapped-layout acceptance, including fonts/clipping
console.log(result.presentation);      // Full / truncated / clipped / scrollable / overflow

// Inspect an existing element using its actual fonts, inline spans and CSS.
// This does not resize or modify the source element.
const existing = await inspectTextFit(document.querySelector('.label'), {
  minWidth: 40, maxWidth: 120,
});
```

`unwrapped` compares natural `max-content` width with the requested inclusive interval, returning `underflow`, `fits` or `overflow`. Explicit newlines and `white-space` remain meaningful: this is the width without optional soft wraps, not removal of hard line breaks. `intrinsic.minContentWidth` and `maxContentWidth` separately report CSS intrinsic sizes; they are not the caller's minimum/maximum limits.

`layout` checks horizontal overflow of actual Range fragments, atomic inline boxes and scroll geometry, and compares the required line-box height with the current content-box height. Range em rectangles can exceed CSS line-height even when a line fits, so they are reported separately from required height. `layout.status` is `overflow` if either axis or the parent Flex/Grid allocation overflows; otherwise it compares the occupied text span with the width interval. `placement` separately reports Flex/Grid container boundaries, including siblings pushed outside by an unshrinkable label. With auto height, wrapping may grow vertically without causing overflow.

Ordinary inline labels share their parent's line boxes and cannot independently constrain height. For these roots, required height uses their native occupied span; ancestor clipping is still checked. A synthetic block's line-height is not compared with the inline element's em rectangle.

`presentation.status` distinguishes `full`, deliberate `truncated` text, unintended `clipped` text, `scrollable` overflow and visible `overflow`. `clippedBy` records target/ancestor clipping boundaries. `accepted` checks wrapped layout and presentation together: a label can fit its own box while being cut by an ancestor. `allowTruncation: true` accepts ellipsis or line clamp, while keeping `layout.status: 'overflow'` accurate. The constrained text span must still be within the requested width interval; ancestor clipping still rejects the result. Unknown results have `accepted: null`. Temporary `checkTextFit` boxes inspect their own clipping, independently of the host page's clipping.

`requiredFonts` names registered web-font families that must be requested and load successfully. Missing, unused or failed required families return `font-error`; selected web-font loading errors are also reported. `fonts.faces` records registered faces and loading states. This is not a per-glyph font audit: standard DOM APIs do not expose the face used for every glyph, so `fonts.glyphCoverage` remains `unverified`. System fallback, mixed-script fallback and synthetic weight are measured natively without claiming that every glyph came from the requested face.

`checkTextFit` lays out a temporary content box at `maxWidth` and optional `maxHeight`. `inspectTextFit` uses the existing element's content box: supplied limits do not resize it. Results include computed typography, content/text rectangles, fragments and overflow distances. Font fallback, synthetic weight, variable axes, spacing, Japanese line breaking and inline style selection are delegated to the target browser. SVG/image icons, inline blocks, badges and quoted-string/empty pseudo-elements participate in measurement. Images reuse their decoded dimensions; measurement clones never copy their resource URLs. Measurement nodes are removed afterward.

Text/email/url/tel inputs and textareas inspect the current value, or the placeholder when empty, including placeholder typography. Textarea trailing newlines and `wrap=off` are supported. `control` identifies the source and length without returning the value itself. Inspection preserves the value, selection and scroll position. Native scroll geometry complements the text probe; internal control rectangles are inferred, not DOM Range rectangles from browser-private shadow content.

Positive axis-aligned scale/translate and CSS zoom on the inspected element or its ancestors are supported. `coordinates.space: 'normalized-viewport'` means all rectangles use viewport coordinates divided by the inspected element's total `scaleX` / `scaleY`. Multiply coordinates/dimensions by those factors to recover viewport CSS pixels. Width limits, intrinsic sizes and required height remain unscaled CSS pixels. Zoomed border widths are measured in the target engine instead of guessing its pixel-snapping rules.

The contract is `basis: 'layout'`: it checks text layout, not every painted pixel, italic overhang, shadows or decorations. Detached or `display:none` elements return `unmeasurable`. Rotation/skew/reflection/3D, transformed or positioned descendants, standalone non-inline flows, video/canvas/iframe/select, password/search/other decorated inputs, shadow content, counter/URL/positioned pseudo-elements, vertical writing and multicolumn layouts return `unsupported` with reasons. These results never silently become `fits`. This is a supported text-layout scope, not a guarantee for arbitrary CSS or all font formats. The completed priority list and deferred features are recorded in [TODO.md](TODO.md).

```bash
# Report both results; --mode selects which result --assert-fit checks
just check-fit --text 'Hello world Hello world' --weight 700 \
  --min-width 40 --max-width 120 --height 96 --assert-fit

# Single-line check; returns exit code 1 for overflow/underflow/unknown
just check-fit --text 'Hello world' --max-width 80 \
  --mode single-line --assert-fit

# Inspect a real page in the selected headless engine
just check-fit --url http://localhost:3000 --selector '.label' \
  --browser firefox --min-width 40 --max-width 120 \
  --require-font 'YourLoadedFont' --allow-truncation --assert-fit
```

The default fit font is the committed variable Roboto subset. `--font` selects another local font; `--white-space`, `--word-break`, `--overflow-wrap`, `--letter-spacing`, `--line-height`, `--overflow`, `--text-overflow`, `--line-clamp`, `--stretch` (e.g. `75%`), `--optical-sizing` and `--variation-settings` configure its CSS. With `--url`, the page's existing CSS is used. `--assert-fit` checks `unwrapped.status` in single-line mode and `accepted` in wrapped mode. Fit reports use schema version 2 and default to `_build/measurements/fit.json`.

### Headless browser measurements

Requires Node.js 24+, pnpm and the latest stable MoonBit toolchain. Run `moon upgrade` to update the toolchain. This migration was verified with `moon 0.1.20261104` and `moonc v0.10.20+65efd5b93` (2026-11-05).

```bash
just setup-browser
just test-browser

# Save six default samples as _build/measurements/font-metrics.json
just measure-browser

# Measure a local font, with optional DOM wrapping; --text can be repeated
just measure-browser --font fixtures/NotoSansMono-Regular.ttf \
  --text "Hello world" --text "Ag" --size 20 --width 70 \
  --line-height 30 --output _build/measurements/wrapped.json

# GSUB/GPOS and mixed-direction samples
just measure-shaping
just measure-browser --font fixtures/shaping-reference/arabic.ttf \
  --text "العربية" --direction rtl --language ar --size 32
just measure-browser --font fixtures/shaping-reference/roboto-variable.ttf \
  --text "Hello world" --weight 700 --size 24
just measure-browser --font fixtures/shaping-reference/robotoserif-variable.ttf \
  --text "Hello world" --axis wdth=75 --axis opsz=8 --size 32
# Optional feature switches: --no-kerning --no-ligatures
```

The metric comparisons load identical font bytes into MoonBit and headless Chromium, wait for `FontFace.load()`, and compare TTF, WOFF, WOFF2, CFF and legacy kerning. Shaping cases cover GSUB ligatures/contextual forms, GPOS pair/class kerning and marks, Arabic joining, Hebrew marks, mixed directions, brackets, isolates, and feature switches. Pinned Noto subsets exercise real layout tables as well as original synthetic fixtures. Advances allow 0.02 CSS pixels, or 0.05 for variable-font cases; ink comparisons allow 2 CSS pixels. Roboto is tested at weights 100/400/700/900 and sizes 13.25/24/32; static bold and italic faces are also compared. Tests cover spaces, non-BMP UTF-16 offsets, missing glyphs and independent font handles.

The DOM fit contract is tested in Chromium, Firefox and WebKit. Cases cover interval boundaries, wrapped/unwrapped width, fixed-height/ancestor clipping, ellipsis policy, line clamp, white-space, Japanese punctuation, URLs/NBSP/ZWSP/soft hyphens, Flex/Grid allocation, icons/badges/pseudo-elements, inputs/textareas, real 400/700 face selection, font failures, mixed-script fallback, variable width/optical sizing, spacing, fractional sizes, zoom and explicit unsupported results. Canvas ink bounds differ across engines, particularly for mixed BiDi text; cross-engine MoonBit/Canvas ink parity is not asserted. CI installs all three engines and uploads reports/test attachments.

Each exported report records the font SHA-256, toolchain/browser versions and:

| Data | Coordinates and meaning |
|------|-------------------------|
| `moonbit.advance_width` | Shaped paragraph advance, including spaces and kerning |
| `moonbit.logical_bounds` | hhea ascent/descent box, baseline origin, y down; line gap reported separately |
| `moonbit.ink_bounds` | Union of tight outline bounds computed from curve extrema; `null` when no ink |
| `moonbit.glyphs` | Visual glyph positions, advances, ink bounds and half-open UTF-16 cluster ranges |
| `shaping` | Full MoonBit shaped result, including direction, runs and missing code points |
| `canvas` | Unwrapped browser-shaped advance and baseline-relative ink bounds |
| `dom` | Element/text bounds, Range fragments and grapheme rectangles, relative to the element's top-left |
| `missingCodepoints` | Code points missing from the selected font; the browser may use fallback fonts |
| `widthDelta` | MoonBit advance minus Canvas advance, in CSS pixels |

The browser helper can also be used from a page served by `node scripts/browser-server.ts`, after `just build-browser`:

```js
import { loadFont } from '/browser/font.js';

const font = await loadFont('/fixtures/NotoSansMono-Regular.ttf');
try {
  const metrics = font.measure('Hello world', 20, { maxWidth: 70, lineHeight: 30 });
  console.log(metrics.canvas.advanceWidth, metrics.dom.lineRects);
} finally {
  font.dispose();
}

// Explicit variation instances load asynchronously and are cached until dispose().
const variable = await loadFont('/fixtures/shaping-reference/robotoserif-variable.ttf');
try {
  const metrics = await variable.measureWithAxes('Hello world', 32, {
    fontWeight: 400, axisValues: { wdth: 75, opsz: 8 },
  });
  console.log(metrics.shaping.variations);
} finally {
  variable.dispose();
}
```

Font sizes and optional DOM dimensions must be finite and positive. The raw MoonBit binding additionally supports a zero font size. Measurement options include `direction` (`auto`, `ltr`, `rtl`), `language`, `kerning`, `ligatures` and `fontWeight`; these apply to both MoonBit and the browser. `measureWithAxes` adds `axisValues` and numeric `fontStretch` (mapped to `wdth` unless explicitly overridden). Unknown/non-finite axes reject; values are clamped to the font range. The comparison helper disables font synthesis and automatic optical sizing, and pins the default `opsz` in Canvas when needed. Native automatic optical sizing remains available through `font.family` and the fit inspector. `maxWidth` affects DOM wrapping only: MoonBit and Canvas remain unwrapped paragraph measurements. DOM rectangles describe graphemes and text fragments, not glyph outlines; BiDi can produce multiple fragments on one line. Measurement JSON reports use schema version 4, including explicit axis options and selected variation metadata.

This separation follows [Parley's text stack](https://github.com/linebender/parley#the-parley-text-stack), which separates font discovery, shaping, outline metrics and layout. Its [line metrics](https://github.com/linebender/parley/blob/main/parley/src/layout/line.rs) also distinguish advance, baseline and line/content bounds. This project keeps parsing/bounds and shaped layout in MoonBit, browser observation in `browser/font.js`, the measurement contract in `browser/types.ts`, and collection in the CLI. It does not depend on Parley.

## Development

```bash
# Download test fixtures and run tests
just test

# Or manually
bash scripts/download-fixtures.sh
moon test

# Type check
just check

# Format code
just fmt

# Default-backend tests and headless browser checks
just ci
```

NotoSans font files are not committed to the repository. They are downloaded from [GitHub Releases](https://github.com/mizchi/font/releases/tag/fixtures-v1) on first run.

## Dependencies

- [mizchi/svg](https://github.com/mizchi/svg) — `PathCommand` type for glyph outlines
- [mizchi/zlib](https://github.com/mizchi/zlib) — WOFF1 decompression
- [mizchi/brotli](https://github.com/mizchi/brotli) — WOFF2 decompression
- [Milky2018/moon_swash](https://github.com/moonbit-community/moon_swash) — pure MoonBit OpenType shaping
- [moonbit-community/unicode-bidi](https://github.com/moonbit-community/tonyfettes-unicode) — Unicode bidirectional analysis and reordering

## Test Fonts

`fixtures/NotoSansMono-Regular.ttf` is licensed under the [SIL Open Font License](https://scripts.sil.org/OFL).

`fixtures/shaping.{ttf,woff,ttc}` are original geometric test fonts under Apache-2.0; regenerate with `just gen-shaping-fixtures`. `fixtures/shaping-reference/` contains small, renamed Noto/Roboto subsets under the included OFL files. `sources.json` and `fit-sources.json` record pinned upstream URLs and source/subset hashes. Regenerate with `just gen-shaping-references` and `just gen-fit-references`; CI consumes the committed binaries without requiring Python or another network download.

## License

Apache-2.0
