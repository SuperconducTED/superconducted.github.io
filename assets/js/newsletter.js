// The Buttondown sign-up (layouts/_partials/signup.html). Loaded only on pages that render the
// form, and only once params.newsletter.buttondown is set.
//
// Contract: the form still posts to Buttondown as a standard form in a new tab (Buttondown asks
// for that: the subscriber may need to pass a CAPTCHA or fix the address on its page). This
// script only (1) checks the address before it leaves the page, with a visible, announced
// message, (2) stops double posts with a short cool-down, and (3) switches the box to its done
// state, which says what happens next: confirm in the Buttondown tab, then click the link in
// the email. The page cannot see Buttondown's answer, so it never claims more than that.
// The address is never stored or logged; it goes from the form straight to Buttondown. After a
// submit, the preference key superconducted-newsletter = "subscribed" hides the pop-up invitation.
(function () {
  "use strict";
  var COOL_DOWN_MS = 8000;
  // A pragmatic check, not RFC 5322: one @, no spaces, a dot in the domain, 254 characters at
  // most (the SMTP path limit). Buttondown validates again on its side.
  var EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

  var forms = document.querySelectorAll(".signup-form");
  for (var i = 0; i < forms.length; i++) wire(forms[i]);

  function wire(form) {
    var box = form.closest(".signup");
    var input = form.querySelector("input[type='email']");
    var error = form.querySelector(".field-error");
    var button = form.querySelector("button[type='submit']");
    var done = box && box.querySelector(".signup-done");
    var busy = false;
    if (!input || !error || !button) return;
    form.noValidate = true; // this script shows its own, translated messages

    function show(message) {
      error.textContent = message;
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    input.addEventListener("input", function () { if (input.hasAttribute("aria-invalid")) show(""); });

    form.addEventListener("submit", function (ev) {
      var value = input.value.trim();
      input.value = value;
      if (busy) { ev.preventDefault(); return; }
      if (!value) { ev.preventDefault(); show(form.getAttribute("data-error-empty")); input.focus(); return; }
      if (value.length > 254 || !EMAIL.test(value)) { ev.preventDefault(); show(form.getAttribute("data-error-invalid")); input.focus(); return; }
      show("");
      // Let the browser post the form (to a new tab), then show the done state here.
      busy = true;
      button.disabled = true;
      window.setTimeout(function () {
        if (box) box.classList.add("is-done");
        if (done) done.focus();
      }, 0);
      // Stop inviting this browser to sign up: theme-boot.js hides the pop-up on later pages, and
      // site.js closes it now if the sign-up came from the box on the page.
      try { window.localStorage.setItem("superconducted-newsletter", "subscribed"); } catch (e) { /* not remembered */ }
      document.dispatchEvent(new CustomEvent("superconducted:subscribed", { detail: { form: form } }));
      window.setTimeout(function () { busy = false; button.disabled = false; }, COOL_DOWN_MS);
    });
  }
})();
