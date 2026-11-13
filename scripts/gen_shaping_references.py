#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.68.0"]
# ///
"""Regenerate small OFL reference fonts from a pinned Noto revision.

Run: uv run scripts/gen_shaping_references.py. CI uses the committed subsets.
"""
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont

REVISION = "ffebf8c1ee449e544955a7e813c54f9b73848eac"
BASE = f"https://raw.githubusercontent.com/notofonts/noto-fonts/{REVISION}"
OUT = Path(__file__).resolve().parents[1] / "fixtures/shaping-reference"
SAMPLES = {
    "serif": ("NotoSerif", "office AV To 1/2 a\u0301g"),
    "hebrew": ("NotoSansHebrew", "שלום שָׁלוֹם"),
    "arabic": ("NotoSansArabic", "سلام العربية بِسْمِ ببب"),
}
OUT.mkdir(parents=True, exist_ok=True)
records = []
for name, (family, text) in SAMPLES.items():
    source = f"{BASE}/hinted/ttf/{family}/{family}-Regular.ttf"
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
    # Distinguish modified test subsets from the upstream families.
    for name_id in [1, 3, 4, 6, 16]:
        font["name"].setName(f"FontReference-{family}", name_id, 3, 1, 0x409)
    target = OUT / f"{name}.ttf"
    font.save(target)
    records.append({"file": target.name, "source": source,
                    "source_sha256": sha256(data).hexdigest(),
                    "subset_sha256": sha256(target.read_bytes()).hexdigest(),
                    "sample_text": text})
(OUT / "OFL.txt").write_bytes(urlopen(f"{BASE}/LICENSE").read())
(OUT / "sources.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
print("Generated serif, Hebrew and Arabic reference subsets")
