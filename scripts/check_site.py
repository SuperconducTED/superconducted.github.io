"""Check the built website and its sources.

Usage:
    python -I scripts/check_site.py <built site folder> [--register <numerical-claims.md>]

Run it on a production build (`hugo build --gc --minify`, then copy public/en/404.html to
public/404.html as the deploy workflow does). Every check reports how many things it looked at,
so a check that silently matched nothing is visible, and the script exits 1 on any problem.

Checks:
  pages      every English page has a Turkish twin at the same path, and the other way round
  head       every page has lang, a title, a description, a canonical link and hreflang links
             for both languages
  links      every link and asset path that points into the site resolves to a built file
  strings    i18n/en.yaml and i18n/tr.yaml have the same keys, and no Turkish string equals its
             English one unless it is listed in SAME_IN_BOTH
  facts      every fact in data/facts.yaml is pending or cites an NC id and an as-of date; no
             pending fact reaches the production build; with --register, each cited row exists
             and its value column contains the fact's value
  brand      every file listed in data/brand.yaml matches its recorded SHA-256
  drift      data/drift.json names a full commit, has points in time order, and its bands
             contain lo <= hi
  contrast   the CSS colour tokens meet WCAG 2.x: 4.5:1 for text roles on the ground and on
             surfaces, 3:1 for the band edge on the band, in light and dark
  dashes     no em dash (U+2014) in the sources or the built pages (house style)
  root       the root page and the root 404 page exist
"""
import argparse
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://superconducted.github.io"
LANGS = ("en", "tr")
SAME_IN_BOTH = {"github", "demo_axis_y", "footer_tagline"}  # brand line and units stay as they are
EM_DASH = chr(0x2014)  # built from its code point so this file does not contain one

problems = []
counts = {}


def fail(check, message):
    problems.append(f"{check}: {message}")


def count(check, n):
    counts[check] = counts.get(check, 0) + n


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def flat_yaml(text):
    """Read the flat `key: "value"` files in i18n/ (no nesting, one pair per line)."""
    out = {}
    for line in text.splitlines():
        m = re.match(r'^([A-Za-z0-9_]+):\s*"(.*)"\s*$', line)
        if m:
            out[m.group(1)] = m.group(2)
        elif line.strip() and not line.lstrip().startswith("#"):
            raise ValueError(f"unexpected line in i18n file: {line!r}")
    return out


def facts_yaml(text):
    """Read data/facts.yaml: a list of flat mappings under `facts:`."""
    facts, cur = [], None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or line.strip() == "facts:":
            continue
        m = re.match(r"^\s*(-\s+)?([a-z_]+):\s*(.*?)\s*$", line)
        if not m:
            raise ValueError(f"unexpected line in facts.yaml: {line!r}")
        if m.group(1):
            cur = {}
            facts.append(cur)
        value = m.group(3).strip('"')
        cur[m.group(2)] = value
    return facts


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = None
        self.title = False
        self.meta = {}
        self.links = []  # (rel, hreflang, href)
        self.refs = []  # href and src values
        self.text = []
        self.fact_values = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self._in_title = True
        if tag == "meta" and a.get("name"):
            self.meta[a["name"]] = a.get("content", "")
        if tag == "link":
            self.links.append((a.get("rel"), a.get("hreflang"), a.get("href")))
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "p" and "fact-value" in (a.get("class") or "").split():
            self.fact_values += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title and data.strip():
            self.title = True
        self.text.append(data)


def html_files(site):
    for d, _, files in os.walk(site):
        for f in files:
            if f.endswith(".html"):
                yield os.path.join(d, f)


def resolve(site, ref, page_path):
    """Return the built file a site-internal reference points to, or None when it is external."""
    ref = ref.split("#")[0].split("?")[0]
    if not ref or ref.startswith(("mailto:", "data:", "javascript:")):
        return None
    if ref.startswith(SITE):
        ref = ref[len(SITE):] or "/"
    elif re.match(r"^[a-z]+://", ref) or ref.startswith("//"):
        return None
    if ref.startswith("/"):
        path = os.path.join(site, *ref.lstrip("/").split("/"))
    else:
        path = os.path.normpath(os.path.join(os.path.dirname(page_path), *ref.split("/")))
    if ref.endswith("/") or os.path.isdir(path):
        path = os.path.join(path, "index.html")
    return path


def check_pages(site):
    for lang in LANGS:
        other = "tr" if lang == "en" else "en"
        base = os.path.join(site, lang)
        for p in html_files(base):
            rel = os.path.relpath(p, base)
            count("pages", 1)
            if not os.path.exists(os.path.join(site, other, rel)):
                fail("pages", f"{lang}/{rel} has no {other} twin")


def check_head_links_dashes(site):
    pages = list(html_files(site))
    for p in pages:
        rel = os.path.relpath(p, site).replace(os.sep, "/")
        page = Page()
        page.feed(read(p))
        text = "".join(page.text)
        count("dashes", 1)
        if EM_DASH in text:
            fail("dashes", f"em dash in built page {rel}")
        for ref in page.refs:
            target = resolve(site, ref, p)
            if target is None:
                continue
            count("links", 1)
            if not os.path.exists(target):
                fail("links", f"{rel} links to {ref}, which is not in the build")
        if rel in ("index.html", "404.html"):
            continue  # the root language pick and the copied 404 are checked under "root"
        count("head", 1)
        alternates = {h for r, h, _ in page.links if r == "alternate" and h}
        canon = [h for r, _, h in page.links if r == "canonical"]
        missing = [name for name, ok in (
            ("lang", page.lang in LANGS), ("title", page.title),
            ("description", bool(page.meta.get("description"))), ("canonical", bool(canon)),
        ) if not ok]
        if not rel.endswith("404.html") and not {"en", "tr"} <= alternates:
            missing.append("hreflang en and tr")
        if missing:
            fail("head", f"{rel} lacks {', '.join(missing)}")
    return pages


def check_strings():
    en = flat_yaml(read(os.path.join(ROOT, "i18n", "en.yaml")))
    tr = flat_yaml(read(os.path.join(ROOT, "i18n", "tr.yaml")))
    count("strings", len(en))
    for k in sorted(set(en) ^ set(tr)):
        fail("strings", f"key {k} is in only one of en.yaml and tr.yaml")
    for k in sorted(set(en) & set(tr)):
        if en[k] == tr[k] and k not in SAME_IN_BOTH:
            fail("strings", f"{k} is the same in English and Turkish (untranslated?)")


def check_facts(site, register):
    facts = facts_yaml(read(os.path.join(ROOT, "data", "facts.yaml")))
    rows = {}
    if register:
        for line in read(register).splitlines():
            m = re.match(r"^\|\s*(NC-\d{3})\s*\|[^|]*\|([^|]*)\|", line)
            if m:
                rows[m.group(1)] = m.group(2)
    shown = 0
    for f in facts:
        count("facts", 1)
        key = f.get("key", "?")
        if f.get("pending") == "true":
            continue
        shown += 1
        if not re.fullmatch(r"NC-\d{3}", f.get("nc", "")):
            fail("facts", f"{key} has no register id")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", f.get("as_of", "")):
            fail("facts", f"{key} has no as-of date")
        for id_key, value_key in (("nc", "value"), ("of_nc", "of")):
            nc = f.get(id_key)
            if register and nc:
                if nc not in rows:
                    fail("facts", f"{key}: {nc} is not in the register")
                elif f[value_key] not in rows[nc].replace(",", ""):
                    fail("facts", f"{key}: value {f[value_key]} is not in {nc}'s value column")
    home = os.path.join(site, "en", "index.html")
    if os.path.exists(home):
        page = Page()
        page.feed(read(home))
        if page.fact_values != shown:
            fail("facts", f"production home shows {page.fact_values} facts, expected {shown} (pending facts must not ship)")


def check_brand():
    text = read(os.path.join(ROOT, "data", "brand.yaml"))
    entries = re.findall(r"- path: (\S+)\n\s+source: \S+\n\s+sha256: ([0-9a-f]{64})", text)
    count("brand", len(entries))
    if not entries:
        fail("brand", "data/brand.yaml lists no files")
    for path, digest in entries:
        with open(os.path.join(ROOT, "static", *path.split("/")), "rb") as f:
            if hashlib.sha256(f.read()).hexdigest() != digest:
                fail("brand", f"static/{path} differs from the brand kit file recorded in data/brand.yaml")


def check_drift():
    d = json.loads(read(os.path.join(ROOT, "data", "drift.json")))
    pts = d["points"]
    count("drift", len(pts))
    if not re.fullmatch(r"[0-9a-f]{40}", d["source"]["ref"]):
        fail("drift", "source.ref is not a full commit id")
    if len(pts) < 2:
        fail("drift", "fewer than two points")
    if [p[0] for p in pts] != sorted(p[0] for p in pts):
        fail("drift", "points are not in time order")
    for p in pts:
        if (p[2] is None) != (p[3] is None) or (p[2] is not None and p[2] > p[3]):
            fail("drift", f"bad band at {p[0]}")


def luminance(hex_colour):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def check_contrast():
    css = read(os.path.join(ROOT, "assets", "css", "site.css"))
    blocks = {
        "light": re.search(r":root \{(.*?)\}", css, re.S).group(1),
        "dark": re.search(r':root\[data-theme="dark"\] \{(.*?)\}', css, re.S).group(1),
    }
    pairs = [("text", "ground", 4.5), ("text", "surface", 4.5), ("text-2", "ground", 4.5),
             ("text-2", "surface", 4.5), ("accent", "ground", 4.5), ("accent", "surface", 4.5),
             ("accent", "band", 3.0), ("text", "band", 4.5)]
    for mode, block in blocks.items():
        tokens = dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})", block))
        for fg, bg, need in pairs:
            count("contrast", 1)
            if fg not in tokens or bg not in tokens:
                fail("contrast", f"{mode}: token --{fg} or --{bg} is missing")
                continue
            ratio = contrast(tokens[fg], tokens[bg])
            if ratio < need:
                fail("contrast", f"{mode}: --{fg} on --{bg} is {ratio:.2f}:1, needs {need}:1")


def check_source_dashes():
    for folder in ("content", "i18n", "data", "layouts", "assets", "scripts", "docs"):
        for d, _, files in os.walk(os.path.join(ROOT, folder)):
            for f in files:
                if f.endswith((".md", ".yaml", ".html", ".css", ".js", ".py", ".json", ".toml")):
                    count("dashes", 1)
                    if EM_DASH in read(os.path.join(d, f)):
                        fail("dashes", f"em dash in {os.path.relpath(os.path.join(d, f), ROOT)}")


def check_root(site):
    for name in ("index.html", "404.html"):
        count("root", 1)
        if not os.path.exists(os.path.join(site, name)):
            fail("root", f"{name} is missing at the site root")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("site")
    ap.add_argument("--register")
    a = ap.parse_args()
    site = os.path.abspath(a.site)
    check_pages(site)
    check_head_links_dashes(site)
    check_strings()
    check_facts(site, a.register)
    check_brand()
    check_drift()
    check_contrast()
    check_source_dashes()
    check_root(site)
    for name in ("pages", "head", "links", "strings", "facts", "brand", "drift", "contrast", "dashes", "root"):
        n = counts.get(name, 0)
        mine = [p for p in problems if p.startswith(name + ":")]
        status = "ok" if not mine and n else ("NOTHING CHECKED" if not n else f"{len(mine)} problem(s)")
        print(f"{name:9} {n:5} checked  {status}")
        if not n:
            problems.append(f"{name}: checked nothing")
    for p in problems:
        print("  " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
