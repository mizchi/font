#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.68.0"]
# ///
"""Generate original, deterministic OpenType shaping fixtures (Apache-2.0).

Run: uv run scripts/gen_shaping.py. No external fonts are used.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTCollection

ROOT = Path(__file__).resolve().parents[1]
CMAP = {
    32: "space", 40: "parenleft", 41: "parenright",
    49: "one", 50: "two", 51: "three",
    65: "A", 86: "V", 99: "c", 101: "e", 102: "f", 105: "i", 111: "o",
    0x301: "acutecomb", 0x5D0: "alef", 0x5D1: "bet", 0x5D2: "gimel",
    0x628: "beh", 0x10780: "nonbmp",
}
EXTRA = ["fi", "o.alt", "beh.init", "beh.medi", "beh.fina"]
ORDER = [".notdef", *CMAP.values(), *EXTRA]
FEATURES = """
languagesystem DFLT dflt;
languagesystem latn dflt;
languagesystem hebr dflt;
languagesystem arab dflt;
markClass acutecomb <anchor 0 0> @TOP;
feature liga { sub f i by fi; } liga;
feature calt { sub o' c by o.alt; } calt;
feature init { script arab; sub beh by beh.init; } init;
feature medi { script arab; sub beh by beh.medi; } medi;
feature fina { script arab; sub beh by beh.fina; } fina;
feature kern {
  pos A V -80;
  pos [f o] [i e] -40;
} kern;
feature mark {
  pos base A <anchor 300 700> mark @TOP;
  pos base alef <anchor 300 700> mark @TOP;
} mark;
"""

def make_font(pair_adjustment=-80):
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(ORDER)
    builder.setupCharacterMap(CMAP)
    glyphs = {}
    metrics = {}
    for index, name in enumerate(ORDER):
        pen = TTGlyphPen(None)
        width = 900 if name == "fi" else 600
        if name == "space": width = 300
        if name == "acutecomb": width = 0
        if name not in ["space", ".notdef"]:
            left = 0 if name == "acutecomb" else 20
            right = 100 if name == "acutecomb" else width - 20
            top = 100 if name == "acutecomb" else 600 + index
            pen.moveTo((left, 0)); pen.lineTo((right, 0))
            pen.lineTo((right, top)); pen.lineTo((left, top)); pen.closePath()
        glyphs[name] = pen.glyph()
        metrics[name] = (width, 0 if name == "acutecomb" else 20)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "FontShapingTest", "styleName": "Regular"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=900, usWinDescent=200)
    builder.setupPost()
    addOpenTypeFeaturesFromString(builder.font, FEATURES.replace("-80", str(pair_adjustment)))
    builder.font["head"].created = builder.font["head"].modified = 2082844800
    return builder.font

font = make_font()
font.save(ROOT / "fixtures/shaping.ttf")
font.flavor = "woff"
font.save(ROOT / "fixtures/shaping.woff")
font.flavor = None
collection = TTCollection()
collection.fonts = [font, make_font(-120)]
collection.save(ROOT / "fixtures/shaping.ttc", shareTables=True)
print("Generated shaping.ttf, shaping.woff and shaping.ttc")
