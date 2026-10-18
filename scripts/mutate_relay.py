"""Mutation test for the newsletter relay: proves its unit tests can fail.

Usage:
    python -I scripts/mutate_relay.py

Plants one fault at a time in relay/src/index.js, runs `node --test test/relay.test.js` in relay/,
expects a failure, and writes the original bytes back (checked byte for byte). Exits 1 if the
unmutated tests fail (checked first, so a broken runner cannot pass for a caught fault), if any
fault goes unnoticed, if a mutation no longer applies, or if the restored tests fail. Run it on a
clean working tree; it needs Node 20 or later.

The test file is named, not its folder: Node 21 and later read a folder argument to --test as a
script to run and crash, which under this script would look like every fault being caught.
"""
import os
import shutil
import subprocess
import sys

if not shutil.which("node"):
    sys.exit("mutate_relay.py needs Node 20 or later on PATH (the relay tests run with node --test).")

repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = f"{repo}/relay/src/index.js"
MUTATIONS = [
    ("origin check removed", '  if (!trusted) return reply(403, { ok: false, error: "origin" });\n\n  const type', "\n  const type"),
    ("honeypot ignored", 'if ((form.get("website") || "") !== "") return reply(200, { ok: true });', ""),
    ("upsert header added", '"Content-Type": "application/json" },', '"Content-Type": "application/json", "X-Buttondown-Collision-Behavior": "add" },'),
    ("logs the address", 'const lang = form.get("lang")', 'console.log(email); const lang = form.get("lang")'),
    ("raw address as limiter key", '"mail:" + (await sha256(email.toLowerCase()))', '"mail:" + email'),
    ("existing address revealed", 'code === "email_already_exists" || ', ""),
]
TESTS = ["node", "--test", "test/relay.test.js"]
original = open(src, "rb").read()
baseline = subprocess.run(TESTS, cwd=f"{repo}/relay", capture_output=True, text=True)
if baseline.returncode != 0:
    sys.exit("the unmutated relay tests fail, so no mutation result would mean anything:\n" + baseline.stdout[-2000:] + baseline.stderr[-2000:])
failures = 0
try:
    for name, old, new in MUTATIONS:
        text = original.decode("utf-8")
        if text.count(old) != 1:
            print(f"SKIP  {name}: needle not found once")
            failures += 1
            continue
        open(src, "wb").write(text.replace(old, new).encode("utf-8"))
        p = subprocess.run(TESTS, cwd=f"{repo}/relay", capture_output=True, text=True)
        killed = p.returncode != 0
        print(f"{'KILL' if killed else 'MISS'}  {name}")
        failures += 0 if killed else 1
        open(src, "wb").write(original)
finally:
    open(src, "wb").write(original)
assert open(src, "rb").read() == original
p = subprocess.run(TESTS, cwd=f"{repo}/relay", capture_output=True, text=True)
print("restored, tests pass:", p.returncode == 0)
sys.exit(1 if failures or p.returncode else 0)
