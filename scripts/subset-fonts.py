#!/usr/bin/env python3
"""Rebuilds public/fonts/amiri-* and plex-arabic-*, the self-hosted Arabic faces (see styles/fonts.css).

The Latin subsets are Google Fonts' files as served. The Arabic subset is cut down to the core Arabic block,
with every OpenType feature kept so shaping and ligatures are unchanged: that drops the Persian, Urdu and
Quranic extensions and makes the files about a third smaller. The newsreader-* files are Google's as served.

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python scripts/subset-fonts.py

After a change, bump ?v= in styles/fonts.css and lib/fonts.ts: /fonts is cached as immutable.
"""
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.request

# Keep in step with the unicode-range of the *-arabic faces in styles/fonts.css.
UNICODES = "U+0600-06FF,U+200C-200F,U+FE70-FEFF"
FAMILIES = {"amiri": ("Amiri", [400, 700]), "plex-arabic": ("IBM+Plex+Sans+Arabic", [300, 400, 500, 600])}
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "fonts"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA})) as r:
        return r.read()


for slug, (family, weights) in FAMILIES.items():
    css = get(f"https://fonts.googleapis.com/css2?family={family}:wght@{';'.join(map(str, weights))}&display=swap").decode()
    # Google labels each @font-face with a /* subset */ comment.
    for subset, weight, url in re.findall(r"/\* ([a-z-]+) \*/\s*@font-face\s*{[^}]*?font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)", css):
        if subset not in ("arabic", "latin", "latin-ext"):
            continue
        out = OUT / f"{slug}-{weight}-{subset}.woff2"
        if subset != "arabic":
            out.write_bytes(get(url))
        else:
            with tempfile.NamedTemporaryFile(suffix=".woff2") as src:
                src.write(get(url))
                src.flush()
                subprocess.run([sys.executable, "-m", "fontTools.subset", src.name, f"--unicodes={UNICODES}", "--layout-features=*",
                                "--flavor=woff2", f"--output-file={out}"], check=True)
        print(f"{out.name}: {out.stat().st_size // 1024} KB")
