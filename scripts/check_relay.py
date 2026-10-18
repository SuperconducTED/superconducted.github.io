"""Check that the live newsletter relay answers as designed, without subscribing anyone.

Usage:
    python -I scripts/check_relay.py [--relay URL] [--origin ORIGIN]

By default the relay is params.newsletter.relay in hugo.toml and the allowed origin is baseURL
without its trailing slash. With no relay configured the script says so and exits 0. The daily
workflow .github/workflows/relay-health.yml runs it, and GitHub emails the person who last changed
that workflow's schedule when a run fails.

Three requests, each refused by the relay before its rate limiter and before any call to
Buttondown, so a run creates no subscriber and sends no email:
  preflight  OPTIONS /subscribe from the site's origin: 204, Access-Control-Allow-Origin is that
             origin, Access-Control-Allow-Methods includes POST
  invalid    POST /subscribe from the site's origin with a malformed address: 400, JSON
             {"ok": false, "error": "invalid"}, Access-Control-Allow-Origin is the origin,
             Cache-Control no-store
  origin     POST /subscribe from another origin: 403, JSON {"ok": false, "error": "origin"}, no
             Access-Control-Allow-Origin

A transport error or a 5xx answer is retried (ATTEMPTS tries, GAP_S seconds apart), so a brief
hiccup on GitHub's runner or at Cloudflare does not send an alert; a wrong answer is not retried,
because it would come back the same.

What it cannot check: that the Buttondown API key still works, which only a real sign-up shows.
"""
import argparse
import json
import pathlib
import sys
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request

ATTEMPTS = 3
GAP_S = 20
TIMEOUT_S = 20
FOREIGN_ORIGIN = "https://relay-health-check.invalid"
USER_AGENT = "superconducted-relay-health/1 (+https://github.com/SuperconducTED/superconducted.github.io)"


class Answer:
    def __init__(self, status, headers, body):
        self.status = status
        self.headers = headers
        self.body = body

    def header(self, name):
        return self.headers.get(name)

    def json(self):
        try:
            return json.loads(self.body)
        except ValueError:
            return None


def send(url, method, origin, body=None, content_type=None):
    """One request; returns an Answer, or raises OSError on a transport failure."""
    headers = {"User-Agent": USER_AGENT, "Origin": origin}
    if method == "OPTIONS":
        headers["Access-Control-Request-Method"] = "POST"
    data = None
    if body is not None:
        data = body.encode("utf-8")
        headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as r:
            return Answer(r.status, r.headers, r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        # urllib raises for every 4xx and 5xx; the expected 400 and 403 arrive here.
        return Answer(e.code, e.headers, e.read().decode("utf-8", "replace"))


def send_with_retries(*args, **kwargs):
    last = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            answer = send(*args, **kwargs)
            if answer.status < 500:
                return answer, attempt
            last = f"HTTP {answer.status}: {answer.body[:200]}"
        except OSError as e:  # URLError, timeouts and resets are all OSError subclasses
            last = f"{type(e).__name__}: {e}"
        if attempt < ATTEMPTS:
            time.sleep(GAP_S)
    raise RuntimeError(f"no usable answer after {ATTEMPTS} attempts ({last})")


def defaults(repo):
    config = tomllib.loads((repo / "hugo.toml").read_text(encoding="utf-8"))
    relay = config.get("params", {}).get("newsletter", {}).get("relay", "")
    origin = str(config.get("baseURL", "")).rstrip("/")
    return relay, origin


def main():
    repo = pathlib.Path(__file__).resolve().parent.parent
    relay_default, origin_default = defaults(repo)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--relay", default=relay_default, help="the relay's /subscribe URL")
    parser.add_argument("--origin", default=origin_default, help="the origin the relay must accept")
    args = parser.parse_args()

    if not args.relay:
        print("relay      not configured in hugo.toml (params.newsletter.relay is empty); nothing to check")
        return 0
    parts = urllib.parse.urlsplit(args.relay)
    if parts.scheme != "https" and parts.hostname not in ("127.0.0.1", "localhost"):
        print(f"relay      {args.relay} is not https")
        return 1

    form = "application/x-www-form-urlencoded"
    problems = []

    def check(name, expect, answer, attempts, conditions):
        failed = [label for label, ok in conditions if not ok]
        retried = f", after {attempts} attempts" if attempts > 1 else ""
        if failed:
            problems.append(name)
            print(f"{name:<10} FAIL  expected {expect}; got HTTP {answer.status} {answer.body[:200]!r}, "
                  f"Access-Control-Allow-Origin={answer.header('Access-Control-Allow-Origin')!r}; "
                  f"failed: {', '.join(failed)}{retried}")
        else:
            print(f"{name:<10} ok    {expect}{retried}")

    try:
        a, n = send_with_retries(args.relay, "OPTIONS", args.origin)
        check("preflight", f"204 with CORS for {args.origin}", a, n, [
            ("status 204", a.status == 204),
            ("allow-origin", a.header("Access-Control-Allow-Origin") == args.origin),
            ("allow-methods", "POST" in (a.header("Access-Control-Allow-Methods") or "")),
        ])

        a, n = send_with_retries(args.relay, "POST", args.origin, "email=not-an-address&lang=en&website=", form)
        check("invalid", '400 {"ok": false, "error": "invalid"}', a, n, [
            ("status 400", a.status == 400),
            ("body", a.json() == {"ok": False, "error": "invalid"}),
            ("allow-origin", a.header("Access-Control-Allow-Origin") == args.origin),
            ("no-store", "no-store" in (a.header("Cache-Control") or "")),
        ])

        a, n = send_with_retries(args.relay, "POST", FOREIGN_ORIGIN, "email=not-an-address&lang=en&website=", form)
        check("origin", '403 {"ok": false, "error": "origin"} without CORS', a, n, [
            ("status 403", a.status == 403),
            ("body", a.json() == {"ok": False, "error": "origin"}),
            ("no allow-origin", a.header("Access-Control-Allow-Origin") is None),
        ])
    except RuntimeError as e:
        print(f"relay      FAIL  {args.relay}: {e}")
        return 1

    print(f"relay      {args.relay} checked for origin {args.origin}: "
          f"{'all 3 checks ok' if not problems else 'failing: ' + ', '.join(problems)}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
