// SuperconducTED newsletter relay: a Cloudflare Worker that lets the website subscribe a visitor
// to the Buttondown newsletter without leaving the page.
//
// Why it exists: Buttondown's embed form must be posted as a whole page (the subscriber may have
// to pass a CAPTCHA on Buttondown's page) and its endpoint refuses to be framed, so an on-site
// sign-up needs Buttondown's API, and that API needs a secret key, which must never reach a
// browser. This Worker holds the key and accepts one thing: POST /subscribe from the website.
//
// Contract (docs/implementations/2026-10-18-site-redesign.md, "Plan: sign up without leaving
// the site"):
//   request   POST /subscribe, Content-Type application/x-www-form-urlencoded (a CORS "simple"
//             request, so browsers send no preflight), fields: email, lang (en|tr), website (a
//             honeypot that people never see and bots tend to fill)
//   checks    Origin must be listed in ALLOWED_ORIGINS; body at most MAX_BODY bytes; email
//             trimmed, at most 254 characters, same pattern as the site's newsletter.js;
//             optional SIGNUP_LIMITER rate limits per visitor IP and per hashed address
//   upstream  POST BUTTONDOWN_API with the visitor's IP (Buttondown's spam firewall uses it) and
//             type "unactivated", so Buttondown sends its double opt-in confirmation email
//   answer    JSON { ok: true } or { ok: false, error: invalid|blocked|busy|unavailable|origin|
//             method|type|too_large|not_found }. A new, an existing and a suppressed address all
//             get { ok: true }, so the form cannot reveal who is subscribed.
// The Worker never logs: no addresses, no IPs, no keys. Secret: BUTTONDOWN_API_KEY (set with
// `wrangler secret put`, never in this repository).

export const MAX_BODY = 2048;
const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const DEFAULT_API = "https://api.buttondown.com/v1/subscribers";

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};

// `deps.fetch` lets tests replace the network; production uses the platform's fetch.
export async function handle(request, env, deps = {}) {
  const send = deps.fetch || fetch;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const trusted = allowed.includes(origin);
  const cors = trusted ? { "Access-Control-Allow-Origin": origin } : {};
  const headers = (extra) => ({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...cors,
    ...extra,
  });
  const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: headers(extra) });

  if (url.pathname !== "/subscribe") return reply(404, { ok: false, error: "not_found" });
  if (request.method === "OPTIONS") {
    if (!trusted) return reply(403, { ok: false, error: "origin" });
    return new Response(null, {
      status: 204,
      headers: headers({ "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" }),
    });
  }
  if (request.method !== "POST") return reply(405, { ok: false, error: "method" }, { Allow: "POST, OPTIONS" });
  if (!trusted) return reply(403, { ok: false, error: "origin" });

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") return reply(415, { ok: false, error: "type" });
  const declared = Number(request.headers.get("Content-Length") || "0");
  if (declared > MAX_BODY) return reply(413, { ok: false, error: "too_large" });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, { ok: false, error: "too_large" });

  const form = new URLSearchParams(raw);
  // A filled honeypot gets the ordinary answer, so a bot learns nothing, and goes no further.
  if ((form.get("website") || "") !== "") return reply(200, { ok: true });
  const email = (form.get("email") || "").trim();
  const lang = form.get("lang") === "tr" ? "tr" : "en";
  if (!email || email.length > 254 || !EMAIL.test(email)) return reply(400, { ok: false, error: "invalid" });

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (env.SIGNUP_LIMITER) {
    // Cloudflare's rate-limiting binding: per location and approximate by its own description,
    // so it brakes floods rather than counting exactly. The address is hashed so the key never
    // spells it out; the hash is unsalted, so anyone who already has an address can recompute it,
    // and only Cloudflare, which carries the request anyway, ever sees these keys.
    const mailKey = "mail:" + (await sha256(email.toLowerCase()));
    const [byIp, byMail] = await Promise.all([
      env.SIGNUP_LIMITER.limit({ key: "ip:" + (ip || "unknown") }),
      env.SIGNUP_LIMITER.limit({ key: mailKey }),
    ]);
    if (!byIp.success || !byMail.success) return reply(429, { ok: false, error: "busy" }, { "Retry-After": "60" });
  }
  if (!env.BUTTONDOWN_API_KEY) return reply(503, { ok: false, error: "unavailable" });

  const payload = { email_address: email, type: "unactivated", metadata: { source: "website", language: lang } };
  if (ip) payload.ip_address = ip;
  let upstream;
  try {
    upstream = await send(env.BUTTONDOWN_API || DEFAULT_API, {
      method: "POST",
      headers: { Authorization: "Token " + env.BUTTONDOWN_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return reply(502, { ok: false, error: "unavailable" });
  }
  if (upstream.status === 200 || upstream.status === 201) return reply(200, { ok: true });

  let code = "";
  try {
    const data = await upstream.json();
    code = data && typeof data.code === "string" ? data.code : "";
  } catch (e) {
    code = "";
  }
  if (upstream.status === 400 && (code === "email_already_exists" || code === "subscriber_suppressed")) return reply(200, { ok: true });
  if ((upstream.status === 400 && code === "email_invalid") || upstream.status === 422) return reply(400, { ok: false, error: "invalid" });
  // Buttondown's spam firewall. Measured on 2026-10-18 against the live API: 400 with code
  // "subscriber_blocked" ("This subscriber was blocked by your firewall."). "firewall_blocked" is
  // the name this relay first assumed; it stays in case Buttondown uses it elsewhere.
  if (code === "subscriber_blocked" || code === "firewall_blocked") return reply(400, { ok: false, error: "blocked" });
  if (upstream.status === 429) return reply(429, { ok: false, error: "busy" }, { "Retry-After": "60" });
  return reply(502, { ok: false, error: "unavailable" });
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
