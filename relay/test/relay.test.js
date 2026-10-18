// Unit tests for the newsletter relay, run with Node 20+ (`node --test relay/test/relay.test.js`),
// using the platform's own Request and Response. Buttondown is replaced by a stub; nothing leaves
// the machine.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle, MAX_BODY } from "../src/index.js";

const SITE = "https://superconducted.github.io";
const ENV = { ALLOWED_ORIGINS: SITE, BUTTONDOWN_API_KEY: "test-key-not-real", BUTTONDOWN_API: "https://buttondown.test/v1/subscribers" };

function req({ method = "POST", origin = SITE, path = "/subscribe", body = "email=reader%40example.org&lang=tr", type = "application/x-www-form-urlencoded", ip = "203.0.113.7" } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (type) headers["Content-Type"] = type;
  if (ip) headers["CF-Connecting-IP"] = ip;
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD" && body !== null) init.body = body;
  return new Request("https://relay.example" + path, init);
}

// A stub upstream that records every call and answers with the given status and JSON.
function upstream(status = 201, json = { id: "sub_1" }) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  fn.calls = calls;
  return fn;
}

// Fail the test if the relay writes anything to the console (it must never log requests).
let logged;
const originals = {};
beforeEach(() => {
  logged = [];
  for (const k of ["log", "info", "warn", "error", "debug"]) {
    originals[k] = console[k];
    console[k] = (...args) => logged.push([k, ...args]);
  }
});
afterEach(() => {
  for (const k of Object.keys(originals)) console[k] = originals[k];
  assert.deepEqual(logged, [], "the relay must not log");
});

test("a valid sign-up reaches Buttondown with double opt-in, IP and language, and answers ok", async () => {
  const up = upstream(201);
  const res = await handle(req(), ENV, { fetch: up });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(up.calls.length, 1);
  const call = up.calls[0];
  assert.equal(call.url, ENV.BUTTONDOWN_API);
  assert.equal(call.init.headers.Authorization, "Token test-key-not-real");
  assert.deepEqual(call.body, { email_address: "reader@example.org", type: "unactivated", metadata: { source: "website", language: "tr" }, ip_address: "203.0.113.7" });
  assert.equal(call.init.headers["X-Buttondown-Collision-Behavior"], undefined, "must not upsert existing subscribers");
});

test("CORS: the allowed origin is echoed with no-store and nosniff", async () => {
  const res = await handle(req(), ENV, { fetch: upstream() });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal(res.headers.get("Vary"), "Origin");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("other origins, and requests without an origin, are refused before Buttondown is called", async () => {
  for (const origin of ["https://evil.example", "http://superconducted.github.io", ""]) {
    const up = upstream();
    const res = await handle(req({ origin }), ENV, { fetch: up });
    assert.equal(res.status, 403, origin);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(up.calls.length, 0);
  }
});

test("preflight: allowed origin gets 204 with POST only; others 403", async () => {
  const ok = await handle(req({ method: "OPTIONS", body: null }), ENV, { fetch: upstream() });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("Access-Control-Allow-Methods"), "POST");
  const no = await handle(req({ method: "OPTIONS", origin: "https://evil.example", body: null }), ENV, { fetch: upstream() });
  assert.equal(no.status, 403);
});

test("wrong path, method and content type are refused", async () => {
  assert.equal((await handle(req({ path: "/" }), ENV, { fetch: upstream() })).status, 404);
  const get = await handle(req({ method: "GET", body: null }), ENV, { fetch: upstream() });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("Allow"), "POST, OPTIONS");
  assert.equal((await handle(req({ type: "application/json", body: '{"email":"a@b.org"}' }), ENV, { fetch: upstream() })).status, 415);
});

test("an oversized body is refused", async () => {
  const up = upstream();
  const res = await handle(req({ body: "email=a%40b.org&x=" + "a".repeat(MAX_BODY) }), ENV, { fetch: up });
  assert.equal(res.status, 413);
  assert.equal(up.calls.length, 0);
});

test("the honeypot answers ok but never reaches Buttondown", async () => {
  const up = upstream();
  const res = await handle(req({ body: "email=reader%40example.org&website=http%3A%2F%2Fspam.example" }), ENV, { fetch: up });
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(up.calls.length, 0);
});

test("malformed, missing and over-long addresses are invalid and never sent", async () => {
  for (const email of ["", "not-an-address", "a@b", "a b@c.org", "x".repeat(250) + "@example.org"]) {
    const up = upstream();
    const res = await handle(req({ body: "email=" + encodeURIComponent(email) }), ENV, { fetch: up });
    assert.equal(res.status, 400, email.slice(0, 20));
    assert.deepEqual(await res.json(), { ok: false, error: "invalid" });
    assert.equal(up.calls.length, 0);
  }
});

test("an unknown language falls back to English; surrounding spaces are trimmed", async () => {
  const up = upstream();
  await handle(req({ body: "email=%20reader%40example.org%20&lang=de" }), ENV, { fetch: up });
  assert.equal(up.calls[0].body.email_address, "reader@example.org");
  assert.equal(up.calls[0].body.metadata.language, "en");
});

test("existing and suppressed addresses get the same ok answer as a new one", async () => {
  for (const code of ["email_already_exists", "subscriber_suppressed"]) {
    const res = await handle(req(), ENV, { fetch: upstream(400, { code, detail: "x" }) });
    assert.equal(res.status, 200, code);
    assert.deepEqual(await res.json(), { ok: true });
  }
});

// Buttondown's answers as measured against the live API on 2026-10-18 (status, body shape and
// field names exactly as returned; the address and subscriber id replaced by placeholders).
const MEASURED_BLOCKED = { code: "subscriber_blocked", detail: "This subscriber was blocked by your firewall.", metadata: {} };
const MEASURED_EXISTS = {
  code: "email_already_exists",
  detail: "That email address (reader@example.org) is already subscribed (id=00000000-0000-0000-0000-000000000000). To update them instead, retry with the header 'X-Buttondown-Collision-Behavior: overwrite', or PATCH /v1/subscribers/00000000-0000-0000-0000-000000000000.",
  metadata: { subscriber_id: "00000000-0000-0000-0000-000000000000", remedy_header: "X-Buttondown-Collision-Behavior: overwrite", documentation_url: "https://docs.buttondown.com/api-subscribers-create" },
};

test("measured: Buttondown's firewall refusal becomes blocked, so the visitor gets the Buttondown-page button", async () => {
  const res = await handle(req(), ENV, { fetch: upstream(400, MEASURED_BLOCKED) });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, error: "blocked" });
});

test("measured: an existing address gets plain ok, and nothing of Buttondown's answer leaks", async () => {
  const res = await handle(req(), ENV, { fetch: upstream(400, MEASURED_EXISTS) });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, JSON.stringify({ ok: true }));
  assert.doesNotMatch(text, /subscriber_id|00000000|already/);
});

test("Buttondown errors map to the site's messages", async () => {
  const cases = [
    [400, { code: "email_invalid" }, 400, "invalid"],
    [422, { detail: [] }, 400, "invalid"],
    [400, { code: "subscriber_blocked" }, 400, "blocked"],
    [400, { code: "firewall_blocked" }, 400, "blocked"],
    [400, { code: "some_new_code" }, 502, "unavailable"],
    [429, {}, 429, "busy"],
    [401, { code: "unauthorized" }, 502, "unavailable"],
    [500, {}, 502, "unavailable"],
  ];
  for (const [status, json, want, error] of cases) {
    const res = await handle(req(), ENV, { fetch: upstream(status, json) });
    assert.equal(res.status, want, `${status} ${JSON.stringify(json)}`);
    assert.deepEqual(await res.json(), { ok: false, error });
  }
});

test("a network failure or a missing key is unavailable, without leaking details", async () => {
  const boom = async () => { throw new Error("socket hang up at 10.0.0.1"); };
  const res = await handle(req(), ENV, { fetch: boom });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false, error: "unavailable" });
  const noKey = await handle(req(), { ...ENV, BUTTONDOWN_API_KEY: "" }, { fetch: upstream() });
  assert.equal(noKey.status, 503);
});

test("rate limits: keyed by IP and by a hash of the address, never the raw address; refusal is busy", async () => {
  const keys = [];
  const limiter = (allow) => ({ limit: async ({ key }) => { keys.push(key); return { success: allow(key) }; } });
  const up = upstream();
  const ok = await handle(req(), { ...ENV, SIGNUP_LIMITER: limiter(() => true) }, { fetch: up });
  assert.equal(ok.status, 200);
  assert.ok(keys.includes("ip:203.0.113.7"));
  const mailKey = keys.find((k) => k.startsWith("mail:"));
  assert.match(mailKey, /^mail:[0-9a-f]{64}$/);
  assert.ok(!keys.some((k) => k.includes("example.org")), "no raw address in a key");
  const up2 = upstream();
  const busy = await handle(req(), { ...ENV, SIGNUP_LIMITER: limiter((k) => !k.startsWith("mail:")) }, { fetch: up2 });
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get("Retry-After"), "60");
  assert.equal(up2.calls.length, 0);
});

test("without CF-Connecting-IP no ip_address is sent", async () => {
  const up = upstream();
  await handle(req({ ip: "" }), ENV, { fetch: up });
  assert.equal("ip_address" in up.calls[0].body, false);
});

// The sign-up form promises the relay logs nothing. Cloudflare persists request logs for new
// Workers unless wrangler.toml switches them off, so the switch is pinned here.
test("wrangler.toml turns Cloudflare's request logs off", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const table = toml.match(/^\[observability\][^\n]*\n((?:(?!\[)[^\n]*(?:\n|$))*)/m);
  assert.ok(table, "wrangler.toml has an [observability] table");
  assert.match(table[1], /^enabled\s*=\s*false\s*$/m);
  assert.doesNotMatch(table[1], /^enabled\s*=\s*true/m);
});
