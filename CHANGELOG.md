# Changelog

## 0.8.0 — 2026-11-13

### Added

- OpenType paragraph shaping with GSUB/GPOS/GDEF, Unicode BiDi, visual runs and UTF-16 cluster ranges.
- Baseline-relative logical/ink rectangles and per-glyph bounds, including tight curve extrema.
- Numeric minimum/maximum width checks, variable weight and explicit variation axes.
- Headless browser inspection of single-line width and wrapped layout, with font diagnostics, Flex/Grid allocation, inline icons/badges/pseudo-elements, ancestor clipping, truncation policy, Japanese breaking, text inputs/textareas, and positive axis-aligned scale/zoom.
- `shapeText`, `shapeTextWithWeight` and `shapeTextWithAxes` JS bindings, `measureWithAxes`, browser helpers, and measurement/fit CLIs.
- Pinned, licensed shaping/variable-font fixtures, regeneration scripts, and Chromium/Firefox/WebKit regression tests.

### Fixed

- CFF DICT numeric operands, negative/fractional outline bounds and preservation of JS subpixel precision.
- TTC face offsets during shaping, non-linear `avar` mapping in the pinned shaping adapter, and `gvar` phantom-point delta decoding.
- Measurement clone isolation, unitless line-height rounding, inline-label geometry and zoomed border snapping.
- Fractional metric comparisons use geometric precision consistently on Linux and macOS; fit inspection retains the target's actual text-rendering mode.

### Updated

- MoonBit syntax and dependencies for moon 0.1.20261104 / moonc v0.10.20+65efd5b93.
- Browser CI, diagnostic artifacts and the completed practical-support roadmap in `TODO.md`.

### Migration and scope

- Existing basic LTR layout APIs remain available; use `shape_text` for GSUB/GPOS/BiDi.
- Manually constructed `TTFont` records need `sfnt_offset: 0` for standalone fonts. Parsed collection faces retain their actual offsets.
- Static font weight requests must match the loaded face. Variable fonts accept explicit axes; unknown/non-finite axes reject.
- Browser measurement reports use schema version 4; fit reports use schema version 2. Use `accepted` for wrapped-layout policy checks, including font failures and ancestor clipping.
- Fit inspection measures layout geometry. Painted-pixel bounds, rotation/3D, shadow contents, decorated/secret controls and other deferred cases are documented explicitly in `README.md` and `TODO.md`.

### Validation

- 220 MoonBit tests on each of the default and JS targets.
- 180 Playwright checks: 50 DOM cases on each of Chromium/Firefox/WebKit and 30 Chromium metric comparisons.
- Type, format, CLI exit-code and packaged-publication validation.
