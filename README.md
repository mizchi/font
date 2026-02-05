# mizchi/font

TrueType font parser written in [MoonBit](https://www.moonbitlang.com/).

Parses TTF binary data and converts glyph outlines to `@svg.PathCommand` (from [mizchi/svg](https://github.com/mizchi/svg)).

## Features

- TTF table parsing: `head`, `maxp`, `hhea`, `hmtx`, `loca`, `cmap`, `glyf`
- cmap Format 4 (Unicode BMP mapping)
- Simple and compound glyph outlines
- Quadratic bezier to SVG path command conversion
- Scaled outline generation for arbitrary font sizes

## Usage

```moonbit
let data : Bytes = ... // TTF file bytes
let font = @font.parse_ttf(data).unwrap()

// Get glyph outline as SVG path commands
let cmds = font.scaled_outline('A'.to_int(), 48.0)

// Get glyph metrics
let gid = font.glyph_index('A'.to_int())
let metrics = font.glyph_metrics(gid)
```

## Dependencies

- [mizchi/svg](https://github.com/mizchi/svg) - `PathCommand` type

## Test fonts

`fixtures/NotoSansMono-Regular.ttf` is licensed under the [SIL Open Font License](https://scripts.sil.org/OFL).

## License

Apache-2.0
