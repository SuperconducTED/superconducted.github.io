# Map Buttondown's firewall refusal, and pin Buttondown's measured answers

Date: 2026-10-18. Branch `site/relay-subscriber-blocked`, from `main` at `bb7dbe0` (PR #9 merged).

## Problem / Motivation

After PR #9 merged, a test sign-up on the live Turkish home page, made from the in-app browser
with the deliberately undeliverable address `deneme@example.invalid`, showed "Abonelik hizmeti
şu an yanıt vermiyor." (the relay's `unavailable`) instead of the firewall message. Two things
followed from it.

First, the request had reached the relay. The line it ran on has Türk Telekom's Safe Internet
filter, which resets `curl`, Node and Wrangler connections to `workers.dev`, but the same browser
got the relay's own `400 invalid` for a malformed address, so browsers on that line can get
through. The earlier sign-up failure from Mert's browser (Bengisu's address, about 11:15 UTC) was
therefore not proven to be the filter, as `2026-10-18-relay-fallback-and-health-check.md` had
said.

Second, Buttondown had answered something the relay did not recognise. Buttondown's
documentation describes a duplicate as "a 400 status code" with no code and documents no
firewall answer, and the relay's handling of Buttondown's refusals had never been exercised live
(Mert's two test sign-ups that morning were new addresses, answered 201). Mert sent two requests
straight to Buttondown's API with the key, from his own terminal:

| Request | Buttondown's answer |
|---|---|
| `deneme@example.invalid` | `400 {"code": "subscriber_blocked", "detail": "This subscriber was blocked by your firewall.", "metadata": {}}` |
| his own address, already pending | `400 {"code": "email_already_exists", "detail": "That email address (...) is already subscribed (id=...). ...", "metadata": {"subscriber_id": ..., "remedy_header": ..., "documentation_url": ...}}` |

The duplicate answer matches what the relay expects. The firewall answer does not: the relay
only knew `firewall_blocked`, a name from the original research, so a firewall refusal fell
through to `unavailable`. A visitor whom Buttondown's firewall refused saw "the service isn't
answering" instead of "this address couldn't be accepted" (the PR #9 button was there in both
cases). Whether Bengisu's attempt met the firewall is not known from here; Buttondown's dashboard
would show it.

## What Changed

| File | Change |
|---|---|
| `relay/src/index.js` | `subscriber_blocked` (and, as before, `firewall_blocked`) maps to `400 blocked`; a comment records the measurement. |
| `relay/test/relay.test.js` | The two measured answers as fixtures (address and id replaced by placeholders): the firewall refusal becomes `blocked`; the duplicate becomes exactly `{"ok":true}` with nothing of Buttondown's text in it; an unknown code stays `unavailable`. 17 tests. |
| `scripts/mutate_relay.py` | Seventh planted fault: the `subscriber_blocked` mapping removed. |
| `relay/README.md` | The filter section corrected (browsers may get through; the `http://` test is no test for a browser); a new section with Buttondown's measured answers; the mutation list. |
| `docs/implementations/2026-10-18-relay-fallback-and-health-check.md` | Appended correction (append-only). |
| `docs/implementations/2026-10-18-site-redesign.md` | Appended pointer (append-only). |

## Implementation Approach

The relay reads only `code` from Buttondown's JSON and never forwards Buttondown's text, so the
fix is one more accepted value in the existing firewall branch. The tests use the measured bodies
verbatim except for the personal data, so a future change that reads another field, or forwards
`detail` (which names the address and the subscriber id), fails them.

Reproduced before fixing: with the new tests and `main`'s `relay/src/index.js`, the measured
firewall test and the mapping table test failed (15 passed, 2 failed); with the fix, 17 passed.

## Mathematical / Statistical Details

None: a string comparison in an error mapping.

## Design Decisions

- **Keep `firewall_blocked`.** It costs one comparison and covers the case that Buttondown uses
  it somewhere not measured.
- **Unknown codes stay `unavailable`.** Mapping every unknown 400 to `blocked` or `invalid`
  would guess; `unavailable` already carries the Buttondown-page button since PR #9.
- **No code in the relay's answers.** Passing Buttondown's `code` to the page would have shown
  this at once, but unknown codes might describe an address's state on the list, which the relay
  promises not to reveal.

## Verification

```bash
node --test relay/test/relay.test.js
```

17 of 17 pass (Node 24.20.0).

```bash
python -I scripts/mutate_relay.py
```

7 of 7 planted faults caught, including the removed `subscriber_blocked` mapping; the restored
tests pass.

Production build and `scripts/check_site.py`: all 17 checks pass. The browser code is unchanged
since PR #9.

**Needs a redeploy:** the fix reaches visitors only after Mert deploys the relay again from
`relay/` with `npx wrangler@4.145.0 deploy`. Then the same test (an address Buttondown's firewall
refuses, from the live page) should show "This address couldn't be accepted here." with the
button.

## Related Docs

- `docs/implementations/2026-10-18-relay-fallback-and-health-check.md`: the fallback and the
  health check, and the correction appended to it.
- `docs/implementations/2026-10-18-relay-security-review.md`: the review that accepted a distinct
  `blocked` answer as revealing only Buttondown's spam verdict.
- `relay/README.md`: "Buttondown's answers" and the filter section.
- Buttondown, creating subscribers: https://docs.buttondown.com/api-subscribers-create
