// The Buttondown sign-up forms (layouts/_partials/signup.html and newsletter-popup.html). Loaded
// once per page, and only once params.newsletter.buttondown is set.
//
// Two ways a form can finish, chosen by the page:
//  * Relay (the form has data-relay, set from params.newsletter.relay): the address goes to the
//    project's own relay (relay/ in this repository, a Cloudflare Worker that holds the Buttondown
//    API key) with fetch, and the visitor never leaves the page. The relay answers with JSON:
//    { ok: true } (Buttondown is sending its confirmation email, or the address was already
//    there: the two are deliberately indistinguishable) or { ok: false, error }, which becomes a
//    translated message. When the relay cannot be reached at all (some networks block its
//    workers.dev address, for example Türk Telekom's opt-in Safe Internet family profile), when it
//    reports Buttondown unavailable, or when Buttondown's firewall refuses the address, the
//    message carries a button that posts the typed address to Buttondown's own page in a new tab:
//    the plain form below, one click, nothing retyped.
//  * Plain form (no relay, or no script at all): a standard POST to Buttondown in a new tab, as
//    Buttondown requires for its embed endpoint; this script only checks the address first and
//    shows what happens next, since the page cannot see Buttondown's answer.
// Either way the address is checked before it leaves the page, double posts are stopped, and it
// is never stored or logged here. After a successful sign-up the preference key
// superconducted-newsletter = "subscribed" hides the pop-up invitation on later pages.
(function () {
  "use strict";
  var COOL_DOWN_MS = 8000;
  var RELAY_TIMEOUT_MS = 12000;
  // A pragmatic check, not RFC 5322: one @, no spaces, a dot in the domain, 254 characters at
  // most (the SMTP path limit). The relay and Buttondown validate again.
  var EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

  var forms = document.querySelectorAll(".signup-form");
  for (var i = 0; i < forms.length; i++) wire(forms[i]);

  function wire(form) {
    var box = form.closest(".signup");
    var input = form.querySelector("input[type='email']");
    var error = form.querySelector(".field-error");
    var button = form.querySelector("button[type='submit']");
    var done = box && box.querySelector(".signup-done");
    var doneText = done && done.querySelector(".signup-done-text");
    var trap = form.querySelector("input[name='website']");
    var relay = form.getAttribute("data-relay");
    var busy = false;
    if (!input || !error || !button) return;
    form.noValidate = true; // this script shows its own, translated messages

    // A message under the field, optionally followed by the fallback button (built as nodes,
    // never as HTML).
    function show(message, withFallback) {
      error.replaceChildren();
      if (message) error.appendChild(document.createTextNode(message));
      var label = form.getAttribute("data-fallback-text");
      if (withFallback && label) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "button small fallback";
        b.textContent = label;
        b.addEventListener("click", fallback);
        error.appendChild(b);
      }
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }

    // The plain form, on request: the browser posts the address already in the field to
    // Buttondown's embed endpoint (the form's own action, target _blank), where Buttondown can ask
    // for a CAPTCHA. form.submit() skips this script's submit handler, and running inside the
    // click keeps the new tab from being blocked. The honeypot is disabled for that moment, so it
    // is not sent: it belongs to the relay, not to Buttondown.
    function fallback() {
      if (trap) trap.disabled = true;
      form.submit();
      if (trap) trap.disabled = false;
      if (doneText && form.getAttribute("data-done-tab")) doneText.textContent = form.getAttribute("data-done-tab");
      show("");
      finish();
    }
    input.addEventListener("input", function () { if (input.hasAttribute("aria-invalid")) show(""); });

    function finish() {
      if (box) box.classList.add("is-done");
      if (done) done.focus();
      // Stop inviting this browser to sign up: theme-boot.js hides the pop-up on later pages, and
      // site.js closes it now if the sign-up came from the box on the page.
      try { window.localStorage.setItem("superconducted-newsletter", "subscribed"); } catch (e) { /* not remembered */ }
      document.dispatchEvent(new CustomEvent("superconducted:subscribed", { detail: { form: form } }));
    }
    function release() { busy = false; button.disabled = false; button.removeAttribute("aria-busy"); }

    form.addEventListener("submit", function (ev) {
      var value = input.value.trim();
      input.value = value;
      if (busy) { ev.preventDefault(); return; }
      if (!value) { ev.preventDefault(); show(form.getAttribute("data-error-empty")); input.focus(); return; }
      if (value.length > 254 || !EMAIL.test(value)) { ev.preventDefault(); show(form.getAttribute("data-error-invalid")); input.focus(); return; }
      show("");
      busy = true;
      button.disabled = true;

      if (!relay) {
        // Plain form: let the browser post it (to a new tab), then show the done state here.
        window.setTimeout(finish, 0);
        window.setTimeout(release, COOL_DOWN_MS);
        return;
      }

      ev.preventDefault();
      button.setAttribute("aria-busy", "true");
      var body = new URLSearchParams();
      body.set("email", value);
      body.set("lang", (document.documentElement.getAttribute("lang") || "en").slice(0, 2));
      body.set("website", trap ? trap.value : "");
      var controller = window.AbortController ? new AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, RELAY_TIMEOUT_MS) : null;
      fetch(relay, {
        method: "POST",
        body: body,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: controller ? controller.signal : undefined
      }).then(function (r) {
        // An answer that is not the relay's JSON (an error page from the platform) counts as the
        // service being unavailable.
        return r.json().catch(function () { return { ok: false, error: "unavailable" }; });
      }, function () {
        // No answer at all: the connection was refused or reset (a network filter), the request
        // was blocked, or the timeout above aborted it.
        return { ok: false, error: "network" };
      }).then(function (answer) {
        if (timer) window.clearTimeout(timer);
        if (answer && answer.ok === true) {
          finish();
          window.setTimeout(release, COOL_DOWN_MS);
          return;
        }
        release();
        var code = answer && answer.error;
        if (code === "invalid") show(form.getAttribute("data-error-invalid"));
        else if (code === "busy") show(form.getAttribute("data-error-busy"));
        else if (code === "blocked") show(form.getAttribute("data-error-blocked"), true);
        else if (code === "network") show(form.getAttribute("data-error-network"), true);
        else show(form.getAttribute("data-error-down"), true);
        input.focus();
      });
    });
  }
})();
