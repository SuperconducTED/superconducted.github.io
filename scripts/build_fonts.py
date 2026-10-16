"""Convert the brand typefaces to subset WOFF2 files for the website.

Usage:
    python -I scripts/build_fonts.py <folder with the TTFs> [--check]

The TTFs are the brand's own files (see the brand guide, SuperconducTED/.github brand/README.md,
"Typography"), both under the SIL Open Font License 1.1:
  * Space Grotesk: SpaceGrotesk-Regular.ttf, -Medium.ttf and -Bold.ttf, from fonts/ttf/static in
    https://github.com/floriankarsten/space-grotesk
  * Space Mono: SpaceMono-Regular.ttf and SpaceMono-Bold.ttf, from ofl/spacemono in
    https://github.com/google/fonts

Each face is subset to the characters the site can use (Latin, Latin-1, Latin Extended-A for
Turkish, general punctuation, arrows, sub- and superscripts, and mathematical operators) and
written to static/fonts/ as WOFF2. Needs fontTools and brotli (pip install fonttools brotli).

--check only reports, for each face, its version string and whether it covers the Turkish
letters; it writes nothing.
"""
import hashlib
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

FACES = {
    "SpaceGrotesk-Regular.ttf": "space-grotesk-400.woff2",
    "SpaceGrotesk-Medium.ttf": "space-grotesk-500.woff2",
    "SpaceGrotesk-Bold.ttf": "space-grotesk-700.woff2",
    "SpaceMono-Regular.ttf": "space-mono-400.woff2",
    "SpaceMono-Bold.ttf": "space-mono-700.woff2",
}

# Basic Latin, Latin-1 and Latin Extended-A (Turkish needs U+011E/F, U+0130/1, U+015E/F), general
# punctuation, superscripts and subscripts, arrows, mathematical operators.
UNICODES = "U+0020-007E,U+00A0-017F,U+2000-206F,U+2070-209F,U+2190-21FF,U+2200-22FF"
TURKISH = "çÇğĞıİöÖşŞüÜ"

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "fonts")


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    src, check = args[0], "--check" in sys.argv
    missing_any = False
    for ttf, woff2 in FACES.items():
        path = os.path.join(src, ttf)
        font = TTFont(path)
        cmap = font.getBestCmap()
        missing = [c for c in TURKISH if ord(c) not in cmap]
        missing_any |= bool(missing)
        version = font["name"].getDebugName(5)
        print(f"{ttf}: {version}; sha256 {sha256(path)[:16]}; Turkish {'missing ' + ''.join(missing) if missing else 'complete'}")
        if check:
            continue
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.drop_tables += ["DSIG"]
        sub = subset.Subsetter(options)
        sub.populate(unicodes=subset.parse_unicodes(UNICODES))
        sub.subset(font)
        os.makedirs(OUT, exist_ok=True)
        dest = os.path.join(OUT, woff2)
        font.flavor = "woff2"
        font.save(dest)
        print(f"  -> static/fonts/{woff2}: {os.path.getsize(dest)} bytes")
    sys.exit(1 if missing_any else 0)


if __name__ == "__main__":
    main()
