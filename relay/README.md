# Newsletter relay

A small [Cloudflare Worker](https://developers.cloudflare.com/workers/) that lets visitors subscribe
to the SuperconducTED newsletter ([buttondown.com/superconducted](https://buttondown.com/superconducted))
on the website itself, without opening Buttondown's page.

## Why it exists

Buttondown's embeddable form has to be posted as a whole page (the subscriber may need to pass a
CAPTCHA there), and its endpoint refuses to load inside another site. Staying on the page therefore
needs Buttondown's API, and the API needs a secret key that must never reach a browser. This Worker
holds the key and does one thing: `POST /subscribe` from the website. The design and every decision
behind it are in `docs/implementations/2026-10-18-site-redesign.md` ("Plan: sign up without leaving
the site").

## What it guarantees

- **Only the website can use it.** Requests whose `Origin` is not in `ALLOWED_ORIGINS` are refused;
  answers carry CORS headers for that origin alone.
- **Double opt-in.** Every new address is created as `unactivated`, so Buttondown emails a
  confirmation link and adds nobody until they click it.
- **No subscriber lookups.** New, existing and suppressed addresses all get the same answer.
- **Spam brakes.** A honeypot field, Cloudflare's rate-limiting binding (5 attempts per visitor IP
  and per hashed address per minute, approximate and per location), and Buttondown's own spam
  firewall, which receives the visitor's IP as Buttondown's API documentation recommends.
- **No secrets in the repository, no logs.** The key exists only as a Worker secret; the Worker
  logs nothing about requests (no addresses, no IPs).

## Deploy (Mert)

You need a free Cloudflare account, a Buttondown API key, and **Node.js 22 or newer** (Wrangler
4.87.0 and later refuse older Node; check with `node -v`). On Windows the current LTS installs with
`winget install OpenJS.NodeJS.LTS` (then open a new terminal); if an older Node came from winget's
`OpenJS.NodeJS.20` package, run `winget uninstall OpenJS.NodeJS.20` first and approve the
administrator prompt, since `winget upgrade` keeps that package on 20.x. Nobody else, including Claude,
should ever see the key.

1. **Create a Buttondown API key** at [buttondown.com/keys](https://buttondown.com/keys). Give it
   access to subscribers only (write), nothing else. Copy it somewhere safe for step 4.
2. **Create a Cloudflare account** at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up)
   (the free plan is enough: 100,000 Worker requests a day).
3. **Log in and deploy** from this folder (Wrangler 4.36.0 or later is needed for rate limits;
   the version below is pinned and needs Node 22 or newer):

   ```bash
   npx wrangler@4.145.0 login
   ```

   ```bash
   npx wrangler@4.145.0 deploy
   ```

   The output ends with the Worker's address, like
   `https://superconducted-newsletter.<your-subdomain>.workers.dev`. If Cloudflare rejects the
   `[[ratelimits]]` block on your plan, delete that block from `wrangler.toml` and deploy again;
   the code works without it.
4. **Store the key as a secret** (Wrangler asks for it; paste it there, never in a file or chat):

   ```bash
   npx wrangler@4.145.0 secret put BUTTONDOWN_API_KEY
   ```

5. **Try it with your own address** (replace both placeholders):

   ```bash
   curl -sS -X POST -H "Origin: https://superconducted.github.io" -H "Content-Type: application/x-www-form-urlencoded" --data "email=YOUR_ADDRESS&lang=en" https://superconducted-newsletter.YOUR_SUBDOMAIN.workers.dev/subscribe
   ```

   This is a real sign-up: it creates a pending subscriber on your list, so it should print
   `{"ok":true}` and Buttondown's confirmation email should arrive (confirm it, or delete the
   subscriber in Buttondown afterwards). If it prints `{"ok":false,"error":"unavailable"}`, the
   secret is missing or the key lacks subscriber access.
6. **Switch the site over:** set `relay` under `[params.newsletter]` in `hugo.toml` to the full
   `/subscribe` address from step 3 (or send it to Claude). The forms then subscribe on the page,
   and the relay's origin joins the site's Content Security Policy.

To turn the relay off again, empty `relay` in `hugo.toml`: the forms go back to posting to
Buttondown in a new tab, which also remains the path for visitors without JavaScript.

## Test

```bash
node --test relay/test/
```

The tests run the Worker's handler in Node 20 or later with Buttondown replaced by a stub. CI runs
them in the Pages workflow. `scripts/mutate_relay.py` plants faults in the handler (origin check
removed, honeypot ignored, an upsert header, a log line, a raw address as a rate-limit key, an
existing address revealed) and fails unless the tests catch every one.
