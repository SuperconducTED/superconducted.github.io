"""Mutation test for scripts/check_site.py: proves each guard can fail.

Usage:
    python -I scripts/mutate_check_site.py <built site folder> <numerical-claims.md>

Build the site first exactly as for check_site.py (production build, root 404 copied). For each
mutation the script backs up one file's bytes, plants a fault, runs check_site.py, expects the
named check to report a problem, then writes the original bytes back and confirms they match.
It exits 1 if any fault goes unreported, if a mutation no longer applies (the guarded markup
changed, so the mutation needs updating), or if the restored baseline fails.

Some mutations edit source files (assets/js, assets/css, data/claims.yaml) for a moment: run it
on a clean working tree, with no editor saving into the repository and no other build running.
A check that passes here once and was never seen failing is not evidence; rerun this whenever a
check in check_site.py changes.
"""
import subprocess
import sys

import os

repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site, register = sys.argv[1:3]
PY = sys.executable


def run():
    p = subprocess.run([PY, "-I", f"{repo}/scripts/check_site.py", site, "--register", register],
                       capture_output=True, text=True, encoding="utf-8")
    return p.returncode, p.stdout


MUTATIONS = [
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("<main id=main", "<main style=color:red id=main", 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("<main id=main", '<main onclick="x()" id=main', 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("<main id=main", '<a href=https://example.org target=_blank>x</a><main id=main', 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("trusted-types sc-loader", "", 1).replace("require-trusted-types-for 'script';", "", 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("</body>", "<script>alert(1)</script></body>", 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace('t.classList.add("js")', 't.classList.add("jz")', 1)),
    ("csp", f"{site}/en/team/index.html", lambda s: s.replace("script-src 'self' '", "script-src 'self' 'unsafe-inline' '", 1)),
    ("scripts", f"{repo}/assets/js/newsletter.js", lambda s: s + "\nerror.innerHTML = 'x';\n"),
    ("scripts", f"{repo}/assets/js/site.js", lambda s: s + "\nconsole.log('debug');\n"),
    ("scripts", f"{repo}/assets/js/site.js", lambda s: s + "\nwindow.localStorage.setItem(\"auth-token\", t);\n"),
    ("search", f"{site}/tr/search.json", lambda s: s.replace('"u":"/tr/team/"', '"u":"/tr/gone/"', 1)),
    ("feeds", f"{site}/en/updates/atom.xml", lambda s: s.replace("<entry>", "<entry><bogus>", 1)),
    ("release", f"{site}/en/index.html", lambda s: s.replace("</body>", "<script src=/livereload.js></script></body>", 1)),
    ("facts", f"{repo}/data/claims.yaml", lambda s: s.replace("value: 32", "value: 33", 1)),
    ("contrast", f"{repo}/assets/css/site.css", lambda s: s.replace(':root[data-theme="dark"] {\n  --ground: #0A1B24;', ':root[data-theme="dark"] {\n  --ground: #0A1B25;', 1)),
    ("contrast", f"{repo}/assets/css/site.css", lambda s: s.replace("  --accent: #4FD6E6;", "  --accent: #18404C;")),
    ("weight", f"{site}/en/team/index.html", lambda s: s.replace("</body>", "<!--" + "x" * 210_000 + "--></body>", 1)),
    ("aliases", f"{site}/en/updates/page/1/index.html", lambda s: s.replace('content="noindex"', 'content="index"').replace("content=noindex", "content=index")),
]

base_code, base_out = run()
assert base_code == 0, "baseline must pass:\n" + base_out
failures = 0
for check, path, mutate in MUTATIONS:
    with open(path, "rb") as f:
        original = f.read()
    text = original.decode("utf-8")
    mutated = mutate(text)
    if mutated == text:
        print(f"SKIP  {check}: mutation did not apply to {path}")
        failures += 1
        continue
    try:
        with open(path, "wb") as f:
            f.write(mutated.encode("utf-8"))
        code, out = run()
        hit = code == 1 and any(line.startswith(f"  {check}:") for line in out.splitlines())
        print(f"{'KILL' if hit else 'MISS'}  {check}: {path.split('/')[-1]}")
        if not hit:
            failures += 1
            print(out)
    finally:
        with open(path, "wb") as f:
            f.write(original)
        with open(path, "rb") as f:
            assert f.read() == original, f"restore failed for {path}"
code, out = run()
print("restored baseline passes:", code == 0)
sys.exit(1 if failures or code else 0)
