# One-click Buttondown fallback and a daily relay health check

Date: 2026-10-18. Branch `site/relay-fallback-health`, from `main` at `3264eee` (PR #8 merged).

## Problem / Motivation

A sign-up on the live site, made from Mert's machine, showed "The sign-up service isn't answering
right now." The relay was fine. The line the machine was on has Türk Telekom's opt-in
"Güvenli İnternet Hizmeti, Aile Profili" (Safe Internet, family profile), which resets every
connection to a `*.workers.dev` address during the TLS handshake. The measurements, all from that
line:

- the relay's address and the bare `workers.dev` reset within about 0.14 s, while the same
  Cloudflare IP addresses answered normally when the connection named `www.cloudflare.com`
  (filtering by server name, not by address);
- DNS answered correctly, and github.io, buttondown.com and api.cloudflare.com were reachable;
- plain HTTP to the relay was redirected to
  `guvenliinternet.turktelekom.com.tr/mobil/a?u=...`, a notice that the address is blocked "by
  content" under the Safe Internet service the line holder chose;
- an external checker (check-host.net) reached the relay from Frankfurt, Istanbul and Los Angeles
  at the same time, each getting the relay's own 404 for `GET /`.

Two gaps followed. A visitor on such a line saw a misleading message and had to retype the
address on Buttondown's page; and nothing would tell anyone if the relay broke, since its failures
are only visible to the visitor who meets them. Mert asked for both to be fixed in one small PR.

## What Changed

| File | Change |
|---|---|
| `assets/js/newsletter.js` | A fetch that gets no answer at all is now its own case, `network`, with its own message; for `network`, `unavailable` and `blocked` the message carries a button that submits the form natively to Buttondown's embed endpoint in a new tab, with the honeypot disabled, and switches the done text to the "finish in the tab" version. |
| `layouts/_partials/signup.html`, `layouts/_partials/newsletter-popup.html` | `data-error-network`, `data-fallback-text` and `data-done-tab` added; `data-page` and `data-page-text` removed; the done text wrapped in `span.signup-done-text`. |
| `i18n/en.yaml`, `i18n/tr.yaml` | `signup_error_network` added; `signup_page_link` replaced by `signup_fallback` (the button label). |
| `assets/css/site.css` | One rule placing the fallback button on its own line under the message (replaces the unused `.field-error a` rule). |
| `scripts/check_relay.py` | New: three requests to the live relay that it refuses before any call to Buttondown, each answer checked; retries transport errors and 5xx. |
| `.github/workflows/relay-health.yml` | New: runs the checker daily at 06:17 UTC, on request, and on pull requests that change the workflow or the checker. |
| `README.md`, `relay/README.md` | The fallback, filtered networks and how to tell them from an outage, and the health check. |
| `docs/implementations/2026-10-18-site-redesign.md` | Appended pointer to this record (append-only). |

## Implementation Approach

**Telling "no answer" apart from "a bad answer".** `fetch` rejects only when no HTTP answer
arrives: a reset or refused connection (a network filter), a request the browser blocks, or the
script's own 12-second abort. That rejection now maps to `network`. An answer that is not the
relay's JSON (a platform error page) still maps to `unavailable`, and the relay's own codes are
unchanged.

**The fallback is the plain form, on request.** Both forms already carry Buttondown's embed
endpoint as their `action`, with `method="post"`, `target="_blank"` and `rel="noopener"`: the path
visitors without script use. The button's click handler calls `form.submit()`, which posts the
form without firing the script's own submit handler; because it runs inside the click, the browser
treats the new tab as user-initiated and does not block it. Buttondown's page can then ask for a
CAPTCHA, which also makes the button the right answer to `blocked` (Buttondown's firewall refusing
the address through the API). The honeypot input is disabled for the duration of the call, so the
browser does not serialize it and Buttondown never receives the relay's private field. The done
state then shows `signup_done_text` ("Finish in the Buttondown tab that just opened..."), not the
relay's text, because the visitor finishes on Buttondown's page.

**The health check uses only refusals.** The checker sends (1) a CORS preflight from the site's
origin, (2) a POST from the site's origin with a malformed address, (3) a POST from another origin.
The relay answers all three before its rate limiter and before calling Buttondown, so a run adds
no subscriber and sends no email; the local run below proves it with a stubbed Buttondown that
received no call. The relay URL and the origin come from `hugo.toml` (`params.newsletter.relay`,
`baseURL`), so the check follows the site's configuration.

## Mathematical / Statistical Details

Retry policy for the checker: at most `ATTEMPTS = 3` tries per request, `GAP_S = 20` seconds apart,
each with a `TIMEOUT_S = 20` second limit, retried only on a transport error or a 5xx answer. The
worst case for one request is 3 x 20 + 2 x 20 = 100 seconds, so three requests take at most five
minutes, inside the job's ten-minute limit. A failure therefore means the relay gave no usable
answer three times, spread over at least 40 seconds, or gave a wrong answer once (wrong answers
are deterministic and are not retried). These numbers were chosen, not measured: GitHub-hosted runners
and Cloudflare are usually reachable, and the point of the retries is only that one dropped
connection does not send an alert. If the check turns out noisy, its run history is the record to
measure the false-alarm rate on before changing them.

## Design Decisions

- **A button, not an automatic switch to Buttondown.** Opening a tab after an asynchronous
  failure is not user-initiated, so browsers would block it; and silently moving a visitor to
  another site contradicts the on-page sign-up Mert asked for. One click, with the address kept,
  is the least that still works everywhere.
- **The button for `blocked` too.** Buttondown's own page can show a CAPTCHA that the API cannot,
  so a real person refused by the firewall can still subscribe.
- **No button for `invalid` or `busy`.** Both are fixed by the visitor (a typo, a minute's wait);
  sending a malformed address to Buttondown would only fail there.
- **Health check from GitHub, not Cloudflare.** A scheduled check on the relay's own platform
  would not notice the relay being unreachable from outside; GitHub already emails on failed
  scheduled runs, and the workflow needs no secret.
- **No check of the Buttondown key.** Only a real sign-up proves the key, and a daily real
  sign-up would put a test address on the list, or require storing the key a second time, in
  GitHub. A broken key still surfaces as `unavailable` to the next visitor, who now gets the
  one-click fallback.
- **No live-site check.** `check_site.py` already pins the CSP and the relay address at build time;
  a daily cross-check would be a second alert for the same cause.

GitHub's documented limits, which the workflow comment repeats: notifications for scheduled
workflows "are sent to the user who last modified the cron syntax in the workflow file"; schedules
run on the default branch only, "can be delayed during periods of high loads", and, in a public
repository, "are automatically disabled when no repository activity has occurred in 60 days".

## Verification

Local end to end (headless Chrome; the site built with `relay` pointing at the real relay code run
by a local adapter with Buttondown stubbed; buttondown.com resolved to a closed port): 15 of 15.
The new and changed cases:

- relay unreachable (connection reset, as the filter does): the network message and the button;
- Buttondown unavailable and firewall-blocked: their messages and the button; invalid and busy:
  no button; no error message contains a link any more;
- clicking the button, in the English box and the Turkish pop-up: a new tab opens on
  `https://buttondown.com/api/emails/embed-subscribe/superconducted`; the posted fields are exactly
  `email=fallback@example.org` and `embed=1` (the typed `  fallback@example.org ` trimmed, no
  `website`); the done state keeps its title and shows the tab text; the honeypot is enabled
  again; the browser remembers the sign-up.

That test was checked against a broken copy of `newsletter.js` that no longer disables the
honeypot: both fallback cases failed, and the file was restored from a backup.

Screenshots at 375 px (Turkish pop-up) and 1280 px (English box): the message and the button fit
inside the card, with no sideways scroll.

The checker, against the real relay code run locally with origin `http://127.0.0.1:8139`:

```bash
python -I scripts/check_relay.py --relay http://127.0.0.1:8141/subscribe --origin http://127.0.0.1:8139
```

All three checks passed, and the stubbed Buttondown recorded no call. Against five broken relays it
exited 1 each time: the POST origin check removed (the foreign request got 400 instead of 403), the
CORS header dropped, a malformed address answered 200, every answer 502 (retried, then failed), and
nothing listening (retried, then failed). `relay/src/index.js` was restored from a backup and git
shows no change to it.

Run against the live relay from the filtered line, the checker fails as it should ("An existing
connection was forcibly closed by the remote host", three attempts). The pull request's own run of
the workflow, on a GitHub runner, is the check from an unfiltered network.

Unchanged and still passing: production build, all 17 site checks; the site checker's mutation
test, 20 of 20 faults caught; relay unit tests 15 of 15; the relay mutation test, 6 of 6.

From an unfiltered network: the workflow's own run on PR #9 (run 39124976843, GitHub-hosted
runner, head `bd126b6`) checked the live relay for origin `https://superconducted.github.io` and
reported `preflight ok` (204 with CORS), `invalid ok` (400 invalid), `origin ok` (403 without
CORS) and "all 3 checks ok". The Pages run on the same head passed all 17 site checks and the relay
tests, 15 of 15.

## Related Docs

- `docs/implementations/2026-10-18-site-redesign.md`: the redesign and the relay's plan and
  as-built record.
- `docs/implementations/2026-10-18-relay-security-review.md`: the relay's security review.
- `relay/README.md`: deploy steps, filtered networks, the health check.
- GitHub, events that trigger workflows (`schedule`):
  https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

## Correction (later on 2026-10-18)

Two statements above went further than the evidence. The filter resets `curl`, Node and Wrangler,
but after this PR merged a Chromium browser on the same filtered line reached the relay (the
relay's own `400 invalid` for a malformed address), probably because Encrypted Client Hello hid
the name from the filter. So "The relay was fine" and the filter as the cause of the first failed
sign-up were not proven: that sign-up came from a browser too. A test sign-up from that browser
with an address Buttondown's firewall refuses got `unavailable`, because Buttondown answers a
firewall refusal with code `subscriber_blocked` and the relay only knew `firewall_blocked`. That
is fixed and recorded in `2026-10-18-relay-firewall-code.md`. The fallback button and the health
check are unaffected: the button appeared in that test, and the health check never reaches
Buttondown.
