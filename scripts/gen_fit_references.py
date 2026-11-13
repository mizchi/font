#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.68.0"]
# ///
"""Pinned OFL subsets for font weight, italic and Japanese fit tests."""
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parents[1] / "fixtures/shaping-reference"
NOTO = "https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac"
GOOGLE = "https://raw.githubusercontent.com/google/fonts/5dac96833c85ada9384fe3e50b11df08091b9246"
LATIN = "Hello world office AV To WMW iii 0123456789 1/2 a\u0301g"
SAMPLES = [
    ("serif-bold", f"{NOTO}/hinted/ttf/NotoSerif/NotoSerif-Bold.ttf", LATIN),
    ("serif-italic", f"{NOTO}/hinted/ttf/NotoSerif/NotoSerif-Italic.ttf", LATIN),
    ("roboto-variable", f"{GOOGLE}/ofl/roboto/Roboto[wdth,wght].ttf", LATIN),
    ("robotoserif-variable", f"{GOOGLE}/ofl/robotoserif/RobotoSerif[GRAD,opsz,wdth,wght].ttf", LATIN),
    ("japanese-variable", f"{GOOGLE}/ofl/notosansjp/NotoSansJP[wght].ttf", "日本語のテキスト幅検査。折り返しを確認します。英語ABC 123"),
]
OUT.mkdir(parents=True, exist_ok=True)
records = []
for name, source, text in SAMPLES:
    source = quote(source, safe=":/,")
    data = urlopen(source).read()
    font = TTFont(BytesIO(data), recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.glyph_names = True
    sub = subset.Subsetter(options=options)
    sub.populate(text=text)
    sub.subset(font)
    for name_id in [1, 3, 4, 6, 16]:
        font["name"].setName(f"FontFitReference-{name}", name_id, 3, 1, 0x409)
    target = OUT / f"{name}.ttf"
    font.save(target)
    records.append({"file": target.name, "source": source,
                    "source_sha256": sha256(data).hexdigest(),
                    "subset_sha256": sha256(target.read_bytes()).hexdigest(),
                    "sample_text": text})
for family in ["roboto", "robotoserif", "notosansjp"]:
    (OUT / f"{family}-OFL.txt").write_bytes(urlopen(f"{GOOGLE}/ofl/{family}/OFL.txt").read())
(OUT / "fit-sources.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
print("Generated bold, italic, variable-weight and Japanese reference fonts")
