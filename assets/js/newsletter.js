// The Buttondown sign-up forms (layouts/_partials/signup.html and newsletter-popup.html). Loaded
// once per page, and only once params.newsletter.buttondown is set.
//
// Two ways a form can finish, chosen by the page:
//  * Relay (the form has data-relay, set from params.newsletter.relay): the address goes to the
//    project's own relay (relay/ in this repository, a Cloudflare Worker that holds the Buttondown
//    API key) with fetch, and the visitor never leaves the page. The relay answers with JSON:
//    { ok: true } (Buttondown is sending its confirmation email, or the address was already
//    there: the two are deliberately indistinguishable) or { ok: false, error }, which becomes a
//    translated message. If the relay cannot be reached, the message offers Buttondown's own page.
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
    var relay = form.getAttribute("data-relay");
    var busy = false;
    if (!input || !error || !button) return;
    form.noValidate = true; // this script shows its own, translated messages

    // A message under the field, optionally followed by a link (built as nodes, never as HTML).
    function show(message, linkText, linkHref) {
      error.replaceChildren();
      if (message) error.appendChild(document.createTextNode(message));
      if (linkText && linkHref) {
        error.appendChild(document.createTextNode(" "));
        var a = document.createElement("a");
        a.href = linkHref;
        a.textContent = linkText;
        error.appendChild(a);
      }
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
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
      var trap = form.querySelector("input[name='website']");
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
        return r.json().catch(function () { return { ok: false, error: "unavailable" }; });
      }, function () {
        return { ok: false, error: "unavailable" };
      }).then(function (answer) {
        if (timer) window.clearTimeout(timer);
        if (answer && answer.ok === true) {
          finish();
          window.setTimeout(release, COOL_DOWN_MS);
          return;
        }
        release();
        var code = answer && answer.error;
        var page = form.getAttribute("data-page");
        var pageText = form.getAttribute("data-page-text");
        if (code === "invalid") show(form.getAttribute("data-error-invalid"));
        else if (code === "busy") show(form.getAttribute("data-error-busy"));
        else if (code === "blocked") show(form.getAttribute("data-error-blocked"), pageText, page);
        else show(form.getAttribute("data-error-down"), pageText, page);
        input.focus();
      });
    });
  }
})();
