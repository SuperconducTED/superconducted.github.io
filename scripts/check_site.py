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
  aliases    every redirect page (Hugo aliases, such as /en/updates/page/1/) is noindex and
             points at a built page
  links      every link and asset path that points into the site resolves to a built file
  strings    i18n/en.yaml and i18n/tr.yaml have the same keys, and no Turkish string equals its
             English one unless it is listed in SAME_IN_BOTH
  facts      every fact in data/facts.yaml and every claim in data/claims.yaml is pending or
             cites an NC id and an as-of date; no pending fact reaches the production build;
             with --register, each cited row exists and its value column contains the value
  brand      every file listed in data/brand.yaml matches its recorded SHA-256
  drift      data/drift.json names a full commit, has points in time order, and its bands
             contain lo <= hi
  contrast   the CSS colour tokens meet WCAG 2.x: 4.5:1 for text roles on the ground, surface
             and raised roles, 3:1 for the band edge on the band, in light and dark; the two dark
             token blocks are identical
  csp        every page carries a CSP with script-src 'self' (no 'unsafe-inline' or
             'unsafe-eval'), object-src 'none', base-uri 'self' and Trusted Types; a page whose
             style-src lacks 'unsafe-inline' has no style attribute or <style> element; no page
             has an inline event handler or an inline executable script; target="_blank" links
             and forms carry rel="noopener"
  scripts    the shipped scripts (assets/js) use no HTML-string sinks (innerHTML, outerHTML,
             insertAdjacentHTML, document.write, eval, new Function), no console logging, and
             write only the two preference keys to local storage
  search     each language's search.json parses and lists exactly the language's built pages
             (404 and redirects excepted)
  feeds      each language's updates/atom.xml parses as an Atom feed with one complete entry
             per built update
  weight     each page plus the stylesheets and scripts it loads stays under its byte budget
  release    no live-reload script, development marker or source map in the build
  dashes     no em dash (U+2014) in the sources or the built pages (house style)
  root       the root page and the root 404 page exist
"""
import argparse
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://superconducted.github.io"
LANGS = ("en", "tr")
SAME_IN_BOTH = {"demo_axis_y", "footer_tagline"}  # brand line and units stay as they are
EM_DASH = chr(0x2014)  # built from its code point so this file does not contain one
STORAGE_KEYS = {"superconducted-theme", "superconducted-lang"}
# Uncompressed bytes of a page plus the CSS and JS it references. Math pages also load KaTeX's
# stylesheet. Fonts and images are not counted (they are cached across pages and lazy).
BUDGET = 200_000
BUDGET_MATH = 400_000
ATOM = "{http://www.w3.org/2005/Atom}"

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


def list_yaml(text, top):
    """Read data/facts.yaml or data/claims.yaml: a list of flat mappings under `<top>:`."""
    items, cur = [], None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or line.strip() == f"{top}:":
            continue
        m = re.match(r"^\s*(-\s+)?([a-z_]+):\s*(.*?)\s*$", line)
        if not m:
            raise ValueError(f"unexpected line under {top}: {line!r}")
        if m.group(1):
            cur = {}
            items.append(cur)
        cur[m.group(2)] = m.group(3).strip('"')
    return items


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = None
        self.title = False
        self.meta = {}
        self.csp = None
        self.refresh = None
        self.links = []  # (rel, hreflang, href)
        self.refs = []  # href and src values
        self.styles = []  # (tag) for <link rel=stylesheet href>
        self.scripts = []  # script src values
        self.text = []
        self.fact_values = 0
        self.style_attrs = 0
        self.style_elements = 0
        self.inline_scripts = 0
        self.handlers = []
        self.blank_without_noopener = []
        self._in_title = False
        self._in_script = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            if a.get("name"):
                self.meta[a["name"]] = a.get("content", "")
            equiv = (a.get("http-equiv") or "").lower()
            if equiv == "content-security-policy":
                self.csp = a.get("content", "")
            if equiv == "refresh":
                self.refresh = a.get("content", "")
        if tag == "link":
            self.links.append((a.get("rel"), a.get("hreflang"), a.get("href")))
            if a.get("rel") == "stylesheet" and a.get("href"):
                self.styles.append(a["href"])
        if tag == "script":
            if a.get("src"):
                self.scripts.append(a["src"])
            elif (a.get("type") or "").lower() not in ("application/json", "application/ld+json"):
                self.inline_scripts += 1
        if tag == "style":
            self.style_elements += 1
        if "style" in a:
            self.style_attrs += 1
        for name in a:
            if name.startswith("on"):
                self.handlers.append(f"<{tag} {name}>")
        if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or "").split():
            self.blank_without_noopener.append(f"<{tag} {a.get('href') or a.get('action')}>")
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "dialog" and a.get("data-src"):
            self.refs.append(a["data-src"])
            self.scripts.append(a["data-src"])
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


def parse(path):
    page = Page()
    page.feed(read(path))
    return page


def resolve(site, ref, page_path):
    """Return the built file a site-internal reference points to, or None when it is external."""
    ref = ref.split("#")[0].split("?")[0]
    if not ref or ref.startswith(("mailto:", "data:", "javascript:")):
        return None
    m = re.match(r"^https?://[^/]+", ref)
    if ref.startswith(SITE) or (m and re.match(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$", m.group(0))):
        ref = ref[len(m.group(0)) if m else len(SITE):] or "/"
    elif re.match(r"^[a-z]+://", ref) or ref.startswith("//"):
        return None
    if ref.startswith("/"):
        path = os.path.join(site, *ref.lstrip("/").split("/"))
    else:
        path = os.path.normpath(os.path.join(os.path.dirname(page_path), *ref.split("/")))
    if ref.endswith("/") or os.path.isdir(path):
        path = os.path.join(path, "index.html")
    return path


def is_alias(page):
    return page.refresh is not None


def check_pages(site):
    for lang in LANGS:
        other = "tr" if lang == "en" else "en"
        base = os.path.join(site, lang)
        for p in html_files(base):
            rel = os.path.relpath(p, base)
            count("pages", 1)
            if not os.path.exists(os.path.join(site, other, rel)):
                fail("pages", f"{lang}/{rel} has no {other} twin")


def check_built_pages(site, production):
    """head, aliases, links, csp, weight and the dash check on built pages."""
    weights = []
    for p in html_files(site):
        rel = os.path.relpath(p, site).replace(os.sep, "/")
        page = parse(p)
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
        if rel == "index.html":
            continue  # the root language pick is checked under "root"
        if is_alias(page):
            count("aliases", 1)
            if page.meta.get("robots") != "noindex":
                fail("aliases", f"{rel} redirects but is not noindex")
            m = re.search(r"url=(\S+)", page.refresh)
            target = resolve(site, m.group(1), p) if m else None
            if not target or not os.path.exists(target):
                fail("aliases", f"{rel} redirects to something that is not built")
            continue
        if rel != "404.html":
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
        check_csp(rel, page, production)
        weights.append(page_weight(site, p, rel, page))
    if weights:
        heaviest = max(weights)
        print(f"weight    heaviest page {heaviest[1]}: {heaviest[0]:,} bytes (budget {BUDGET:,}, math {BUDGET_MATH:,})")


def directives(csp):
    out = {}
    for part in csp.split(";"):
        bits = part.split()
        if bits:
            out[bits[0]] = bits[1:]
    return out


def check_csp(rel, page, production):
    count("csp", 1)
    if not page.csp:
        fail("csp", f"{rel} has no Content-Security-Policy")
        return
    d = directives(page.csp)
    script = d.get("script-src", [])
    if script != ["'self'"]:
        fail("csp", f"{rel}: script-src is {' '.join(script)!r}, expected 'self' only")
    if d.get("object-src") != ["'none'"]:
        fail("csp", f"{rel}: object-src is not 'none'")
    if d.get("base-uri") != ["'self'"]:
        fail("csp", f"{rel}: base-uri is not 'self'")
    if "'unsafe-eval'" in page.csp:
        fail("csp", f"{rel}: CSP allows 'unsafe-eval'")
    if production and d.get("require-trusted-types-for") != ["'script'"]:
        fail("csp", f"{rel}: production CSP lacks require-trusted-types-for 'script'")
    if "'unsafe-inline'" not in d.get("style-src", []):
        if page.style_attrs:
            fail("csp", f"{rel}: {page.style_attrs} style attribute(s) that its CSP blocks")
        if page.style_elements:
            fail("csp", f"{rel}: {page.style_elements} <style> element(s) that its CSP blocks")
    if page.inline_scripts:
        fail("csp", f"{rel}: {page.inline_scripts} inline executable script(s)")
    if page.handlers:
        fail("csp", f"{rel}: inline event handlers {', '.join(page.handlers[:3])}")
    if page.blank_without_noopener:
        fail("csp", f"{rel}: target=_blank without rel=noopener: {', '.join(page.blank_without_noopener[:3])}")


def page_weight(site, path, rel, page):
    total = os.path.getsize(path)
    for ref in page.styles + page.scripts:
        target = resolve(site, ref, path)
        if target and os.path.exists(target):
            total += os.path.getsize(target)
    math = any("katex" in s for s in page.styles)
    count("weight", 1)
    budget = BUDGET_MATH if math else BUDGET
    if total > budget:
        fail("weight", f"{rel} weighs {total:,} bytes with its CSS and JS, over the {budget:,} budget")
    return (total, rel)


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
    facts = list_yaml(read(os.path.join(ROOT, "data", "facts.yaml")), "facts")
    claims = list_yaml(read(os.path.join(ROOT, "data", "claims.yaml")), "claims")
    rows = {}
    if register:
        for line in read(register).splitlines():
            m = re.match(r"^\|\s*(NC-\d{3})\s*\|[^|]*\|([^|]*)\|", line)
            if m:
                rows[m.group(1)] = m.group(2)
    shown = 0
    keys = set()
    for source, items in (("facts.yaml", facts), ("claims.yaml", claims)):
        for f in items:
            count("facts", 1)
            key = f.get("key", "?")
            if key in keys:
                fail("facts", f"{key} is defined twice across facts.yaml and claims.yaml")
            keys.add(key)
            if f.get("pending") == "true":
                if source == "claims.yaml":
                    fail("facts", f"{key}: claims cannot be pending (they render inside text)")
                continue
            if source == "facts.yaml":
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
        page = parse(home)
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


def tokens_of(block):
    return dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})", block))


def check_contrast():
    css = read(os.path.join(ROOT, "assets", "css", "site.css"))
    # Selectors are matched at the start of a line, so a comment that quotes one cannot be
    # mistaken for the block itself.
    dark_media = re.search(r'^\s*:root:not\(\[data-theme="light"\]\) \{(.*?)\}', css, re.S | re.M)
    blocks = {
        "light": re.search(r"^:root \{(.*?)\}", css, re.S | re.M).group(1),
        "dark": re.search(r'^:root\[data-theme="dark"\] \{(.*?)\}', css, re.S | re.M).group(1),
    }
    count("contrast", 1)
    if not dark_media or tokens_of(dark_media.group(1)) != tokens_of(blocks["dark"]):
        fail("contrast", "the prefers-color-scheme dark block and the [data-theme=dark] block differ")
    pairs = [("text", "ground", 4.5), ("text", "surface", 4.5), ("text", "raised", 4.5),
             ("text-2", "ground", 4.5), ("text-2", "surface", 4.5), ("text-2", "raised", 4.5),
             ("accent", "ground", 4.5), ("accent", "surface", 4.5), ("accent", "raised", 4.5),
             ("ground", "accent", 4.5), ("ground", "text", 4.5),
             ("accent", "band", 3.0), ("text", "band", 4.5)]
    for mode, block in blocks.items():
        tokens = tokens_of(block)
        for fg, bg, need in pairs:
            count("contrast", 1)
            if fg not in tokens or bg not in tokens:
                fail("contrast", f"{mode}: token --{fg} or --{bg} is missing")
                continue
            ratio = contrast(tokens[fg], tokens[bg])
            if ratio < need:
                fail("contrast", f"{mode}: --{fg} on --{bg} is {ratio:.2f}:1, needs {need}:1")


SINKS = re.compile(r"\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\s*\(")
CONSOLE = re.compile(r"\bconsole\.(log|debug|info|trace|dir)\s*\(")
STORAGE_WRITE = re.compile(r"""localStorage\.setItem\(\s*["']([^"']+)["']|store\(\s*["']([^"']+)["']""")


def check_scripts():
    folder = os.path.join(ROOT, "assets", "js")
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".js"):
            continue
        src = read(os.path.join(folder, name))
        code = re.sub(r"//[^\n]*", "", src)  # comments may name the sinks they avoid
        count("scripts", 1)
        for m in SINKS.finditer(code):
            fail("scripts", f"assets/js/{name} uses the HTML-string sink {m.group(0)!r}")
        for m in CONSOLE.finditer(code):
            fail("scripts", f"assets/js/{name} logs to the console ({m.group(0)})")
        for m in STORAGE_WRITE.finditer(code):
            key = m.group(1) or m.group(2)
            if key not in STORAGE_KEYS:
                fail("scripts", f"assets/js/{name} writes local-storage key {key!r}, not a preference key")


def built_pages(site, lang):
    """URLs of the language's real pages (no 404, no redirect pages)."""
    out = set()
    for p in html_files(os.path.join(site, lang)):
        rel = os.path.relpath(p, site).replace(os.sep, "/")
        if rel.endswith("404.html") or is_alias(parse(p)):
            continue
        out.add("/" + rel[: -len("index.html")])
    return out


def check_search(site):
    for lang in LANGS:
        path = os.path.join(site, lang, "search.json")
        count("search", 1)
        if not os.path.exists(path):
            fail("search", f"{lang}/search.json is missing")
            continue
        try:
            records = json.loads(read(path))
        except ValueError as e:
            fail("search", f"{lang}/search.json does not parse: {e}")
            continue
        urls = set()
        for r in records:
            count("search", 1)
            if not r.get("t") or not r.get("u"):
                fail("search", f"{lang}/search.json has a record without title or URL")
            urls.add(re.sub(r"^https?://[^/]+", "", r.get("u", "")))
        pages = built_pages(site, lang)
        for missing in sorted(pages - urls):
            fail("search", f"{lang}/search.json does not list {missing}")
        for extra in sorted(urls - pages):
            fail("search", f"{lang}/search.json lists {extra}, which is not a built page")


def check_feeds(site):
    for lang in LANGS:
        path = os.path.join(site, lang, "updates", "atom.xml")
        count("feeds", 1)
        if not os.path.exists(path):
            fail("feeds", f"{lang}/updates/atom.xml is missing")
            continue
        try:
            feed = ET.parse(path).getroot()
        except ET.ParseError as e:
            fail("feeds", f"{lang}/updates/atom.xml is not well-formed XML: {e}")
            continue
        if feed.tag != ATOM + "feed":
            fail("feeds", f"{lang}/updates/atom.xml is not an Atom feed")
            continue
        for tag in ("title", "id", "updated"):
            if feed.find(ATOM + tag) is None:
                fail("feeds", f"{lang} feed lacks <{tag}>")
        entries = feed.findall(ATOM + "entry")
        posts = {u for u in built_pages(site, lang) if re.match(rf"^/{lang}/updates/[^/]+/$", u)}
        count("feeds", len(entries))
        if len(entries) != min(len(posts), 20):
            fail("feeds", f"{lang} feed has {len(entries)} entries for {len(posts)} built updates")
        for e in entries:
            for tag in ("title", "id", "updated", "content"):
                if e.find(ATOM + tag) is None or not (e.find(ATOM + tag).text or "").strip():
                    fail("feeds", f"{lang} feed entry lacks <{tag}>")


def check_release(site):
    for d, _, files in os.walk(site):
        for f in files:
            path = os.path.join(d, f)
            rel = os.path.relpath(path, site).replace(os.sep, "/")
            if f.endswith(".map"):
                fail("release", f"source map {rel} in the build")
            if f.endswith((".html", ".js", ".css", ".json", ".xml")):
                count("release", 1)
                text = read(path)
                if "livereload" in text:
                    fail("release", f"{rel} contains a live-reload reference (development build?)")
                if "[dev]" in text:
                    fail("release", f"{rel} contains a development marker")


def check_source_dashes():
    for folder in ("content", "i18n", "data", "layouts", "assets", "scripts", "docs", "archetypes"):
        for d, _, files in os.walk(os.path.join(ROOT, folder)):
            for f in files:
                if f.endswith((".md", ".yaml", ".html", ".css", ".js", ".py", ".json", ".toml", ".xml")):
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
    ap.add_argument("--development", action="store_true",
                    help="the build came from `hugo server` or --environment development: skip the "
                         "production-only Trusted Types and release checks")
    a = ap.parse_args()
    site = os.path.abspath(a.site)
    production = not a.development
    check_pages(site)
    check_built_pages(site, production)
    check_strings()
    check_facts(site, a.register)
    check_brand()
    check_drift()
    check_contrast()
    check_scripts()
    check_search(site)
    check_feeds(site)
    if production:
        check_release(site)
    check_source_dashes()
    check_root(site)
    names = ["pages", "head", "aliases", "links", "strings", "facts", "brand", "drift", "contrast",
             "csp", "scripts", "search", "feeds", "weight", "release", "dashes", "root"]
    if not production:
        names.remove("release")
    for name in names:
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
