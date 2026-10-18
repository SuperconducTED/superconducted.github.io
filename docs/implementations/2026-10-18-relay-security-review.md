# Security review of the newsletter relay and the code that calls it

Date: 2026-10-18. Branch `site/relay-security-review`, from `main` at `bce39df` (PR #7 merged).

## Problem / Motivation

The redesign's security review ran once, early, and was recorded at `d74acb0` (see
`2026-10-18-site-redesign.md`, "Security review"). Everything merged after it was never reviewed for
security: the stale-search fallback, the instant theme switch, the newsletter banner and pop-up, the
switch to esbuild, and above all the newsletter relay (`relay/`), the one component that holds a
secret (the Buttondown API key) and handles other people's email addresses. The GitHub Action that
should review every pull request (`.github/workflows/security-review.yml`) skipped itself on PR #7
because the repository has no `CLAUDE_API_KEY` secret, so its green tick meant "skipped", not
"reviewed". Mert asked for the local review to be run on that code, with any fixes in a small
follow-up pull request.

## What Changed

| File | Change |
|---|---|
| `relay/wrangler.toml` | `[observability] enabled = false`, so Cloudflare keeps no request logs for the relay. |
| `relay/README.md` | "Only the website can use it" narrowed to "from a browser", with why a script is not stopped; the "no logs" guarantee now names the config switch and that it needs a redeploy. |
| `relay/test/relay.test.js` | New test: `wrangler.toml` must have an `[observability]` table with `enabled = false`, so a later edit cannot silently turn the logs back on. Header comment gives the test command by file. |
| `relay/src/index.js` | Comment only: the hashed address in the rate-limit key is not described as "no personal data" any more. No code change. |
| `i18n/en.yaml`, `i18n/tr.yaml` | The sign-up box's fine print adds that Buttondown receives the visitor's IP address for its spam checks; the footer's privacy line adds that signing up sends the address and IP address to Buttondown. |
| `docs/implementations/2026-10-18-relay-security-review.md` | This record. |
| `docs/implementations/2026-10-18-site-redesign.md` | Appended pointer to this record (the file is append-only). |

## Implementation Approach

**Range.** `git diff d74acb0 bce39df`, without `content/`, `docs/`, Markdown and `static/`: 27 files,
833 lines added and 73 removed, saved as one diff. Test-only files (`relay/test/`,
`scripts/mutate_relay.py`, `scripts/mutate_check_site.py`) were out of scope, as the review method
prescribes.

**Method.** The `/security-review` procedure, run by hand because the skill reads the diff of the
current checkout and the code is already merged:

1. One read-only agent received the skill's full instructions (categories, hard exclusions,
   precedents, severity and confidence rules), the diff, the repository at `bce39df`, and the facts
   it could not see: GitHub Pages can set no response headers, `CF-Connecting-IP` is set by
   Cloudflare's edge, `ALLOWED_ORIGINS` and `BUTTONDOWN_API` are deploy-time variables, the key is a
   Worker secret. It was told to open the unchanged callers (`signup.html`, `newsletter-popup.html`,
   `head.html`, `js.html`, the `csp` and `scripts` checks) rather than infer them.
2. Each finding would then go to its own false-positive filter agent; only findings scoring 8 or
   more out of 10 survive.

**Result.** No findings at high or medium severity, so step 2 had nothing to examine. The agent
listed the data flows it traced and why each is safe: the address is validated on both sides and
never written into HTML; the relay builds Buttondown's payload itself (address, `lang` forced to
`en` or `tr`, fixed `type: "unactivated"`, the edge IP) and never forwards Buttondown's answer; the
page accepts success only on `ok === true` and maps error codes to fixed messages, building the one
link with `createElement`; CORS echoes only the exact allowed origin, without credentials; the key
goes only to the configured API; the CSP's `connect-src` and `form-action` are pinned by
`check_site.py`; local storage holds only the three preference keys.

**Lower observations, checked against the files before acting.** The agent also listed observations
below the reporting bar. Four held up and are fixed here:

| # | Observation | Evidence | Fix |
|---|---|---|---|
| 1 | Cloudflare persists request logs for new Workers by default, so "logs nothing" depended on a dashboard setting nobody chose. | Wrangler's configuration reference: observability `enabled` "Defaults to `true` for all new Workers", sampling "a default value of 1 (100%)"; `wrangler.toml` had no `[observability]` table. Cloudflare's Workers Logs page says invocation logs hold "the Request, Response, and related metadata", kept 3 days on the free plan. | `[observability] enabled = false`. |
| 2 | The fine print said the relay "stores and logs nothing" without saying that Buttondown receives the visitor's IP; the pop-up form, which also sends it, had no privacy note at all. | `i18n/*.yaml` `signup_fine_relay`; `relay/src/index.js` sets `payload.ip_address`. | One clause in the box's fine print, one sentence in the footer's privacy line (every page, so it covers the pop-up). |
| 3 | The README promised "Only the website can use it", but any script can send any `Origin`; the README's own curl check does. | `relay/README.md` line 18; the curl checks run on 2026-10-18. | Narrowed to "from a browser", saying what does stop scripted abuse. |
| 4 | A comment called the hashed address "no personal data". | `relay/src/index.js` lines 81 to 82. | Reworded (see the math below). |

## Mathematical / Statistical Details

The per-address rate-limit key is `k = "mail:" || hex(SHA-256(lower(email)))`. SHA-256 is
preimage-resistant, so `k` does not reveal an unknown address, but nothing secret goes into it: anyone
holding a candidate address `a` computes `SHA-256(lower(a))` once and compares. The key is therefore a
pseudonym, not anonymous data. A keyed hash, `HMAC-SHA-256(s, lower(email))` with a Worker secret
`s`, would remove that, but the only party that ever sees these keys is Cloudflare, which already
carries the plaintext request, so the comment was corrected instead of adding a second secret.

The limits themselves are unchanged: at most 5 attempts per 60 seconds per visitor IP and per hashed
address, counted per Cloudflare location and approximately, by Cloudflare's own description.

## Design Decisions

- **Logs off entirely, not sampled.** `head_sampling_rate = 0` would also keep nothing, but
  `enabled = false` states the intent directly and matches the promise on the page.
- **Disclose the IP rather than stop sending it.** Buttondown's API documentation recommends
  passing the subscriber's IP to its spam firewall, which is one of the relay's three brakes on
  scripted abuse. Telling visitors is cheaper than losing the brake.
- **No secret token between page and relay.** A static page cannot hold a secret: any token in it
  is public. Stopping scripts would need a challenge such as Cloudflare Turnstile, which adds a
  third-party script and CSP entries; recorded below as an option, not adopted.
- **Comment fix, not HMAC** (see the math above).
- **Footer sentence, not pop-up text.** The pop-up card is deliberately short; the footer's privacy
  line is on every page and already the place for privacy facts.

### Accepted risks (recorded, not fixed)

| Risk | Why accepted |
|---|---|
| A script can send any `Origin`, so anyone can make Buttondown send confirmation emails to addresses they do not own, without the CAPTCHA Buttondown's own form can show. Repeated confirmations could hurt the account's sending reputation. | Excluded class (abuse and rate limiting). Brakes in place: double opt-in (nobody is subscribed without clicking), 5 attempts a minute per IP and per address, the honeypot, Buttondown's firewall with the sender's IP. If abuse appears, Turnstile is the next step. |
| `Content-Length` is client-declared, the whole body is read before the length check, and `raw.length` counts UTF-16 units, not bytes. | Denial-of-service class; Cloudflare caps request bodies, and the relay does nothing costly with a large body. |
| `firewall_blocked` gets its own `blocked` answer. | It reveals Buttondown's spam verdict, not whether an address is subscribed. |
| A `busy` answer from the per-address limiter can hint that someone tried the same address in the last minute, in the same Cloudflare location. | Negligible. |
| Any GitHub Pages project site in the organisation (`superconducted.github.io/<repo>/`) shares the origin, so it passes the relay's origin check and shares local storage. | Needs write access to the organisation; true before this change. |
| The site can be framed (Pages cannot send `frame-ancestors`), and the pop-up form is on every page. | Clickjacking a sign-up still ends at double opt-in; the site was frameable before. |

## Verification

```bash
node --test relay/test/relay.test.js
```

15 of 15 pass (Node 24.20.0). The new logging test was checked against two broken copies of
`wrangler.toml`, one with `enabled = true` and one without the `[observability]` table: it
failed on both, and the file was restored byte for byte from a backup.

```bash
python -I scripts/mutate_relay.py
```

All 6 planted faults are caught, and the restored tests pass.

```bash
cd relay && npx --offline wrangler@4.145.0 deploy --dry-run
```

The configuration with the new `[observability]` table is accepted, and the bindings are unchanged.

Production build (`hugo build --gc --minify --printI18nWarnings --panicOnWarning`), then
`python -I scripts/check_site.py public --register register.md`: all 17 checks pass. The new
sentences render in both languages; at 375 px wide the footer fits with nothing overflowing.

**Not done here, and needed:** the live Worker keeps whatever logging setting it has now until Mert
deploys again from `relay/` with `npx wrangler@4.145.0 deploy`. Until then the page's "logs
nothing" is likely untrue on Cloudflare's side. To check without deploying: Cloudflare dashboard,
Workers & Pages, `superconducted-newsletter`, Settings, Observability.

## Related Docs

- `docs/implementations/2026-10-18-site-redesign.md`: the redesign, the relay's plan and as-built
  record, and the earlier security review.
- `relay/README.md`: the relay's guarantees and deploy steps.
- Wrangler configuration reference, observability:
  https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- Review method: `anthropics/claude-code-security-review` and the local `/security-review` command.
