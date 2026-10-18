"""Mutation test for the newsletter relay: proves its unit tests can fail.

Usage:
    python -I scripts/mutate_relay.py

Plants one fault at a time in relay/src/index.js, runs `node --test test/` in relay/, expects a
failure, and writes the original bytes back (checked byte for byte). Exits 1 if any fault goes
unnoticed, if a mutation no longer applies, or if the restored tests fail. Run it on a clean
working tree; it needs Node 20 or later.
"""
import os
import subprocess
import sys

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
original = open(src, "rb").read()
failures = 0
try:
    for name, old, new in MUTATIONS:
        text = original.decode("utf-8")
        if text.count(old) != 1:
            print(f"SKIP  {name}: needle not found once")
            failures += 1
            continue
        open(src, "wb").write(text.replace(old, new).encode("utf-8"))
        p = subprocess.run(["node", "--test", "test/"], cwd=f"{repo}/relay", capture_output=True, text=True)
        killed = p.returncode != 0
        print(f"{'KILL' if killed else 'MISS'}  {name}")
        failures += 0 if killed else 1
        open(src, "wb").write(original)
finally:
    open(src, "wb").write(original)
assert open(src, "rb").read() == original
p = subprocess.run(["node", "--test", "test/"], cwd=f"{repo}/relay", capture_output=True, text=True)
print("restored, tests pass:", p.returncode == 0)
sys.exit(1 if failures or p.returncode else 0)
