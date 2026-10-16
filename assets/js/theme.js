// The theme toggle and the language switcher's memory.
//  * The toggle switches to the opposite of the theme on screen and saves the choice.
//  * A click on the language switcher saves the language, so the root page (layouts/alias.html)
//    sends a returning visitor to it instead of guessing from the browser.
// Storage can be blocked (private windows, previews); every access is wrapped so the page still
// works, it just does not remember.
(function () {
  var root = document.documentElement;
  function save(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* not remembered */ }
  }
  function current() {
    var set = root.getAttribute("data-theme");
    if (set === "light" || set === "dark") return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var button = document.querySelector(".theme-toggle");
  function label() {
    if (!button) return;
    var next = current() === "dark" ? "light" : "dark";
    button.setAttribute("title", button.getAttribute("data-label-" + next));
    button.setAttribute("aria-pressed", current() === "dark" ? "true" : "false");
  }
  if (button) {
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      save("superconducted-theme", next);
      label();
      document.dispatchEvent(new CustomEvent("superconducted:theme"));
    });
    label();
  }
  var links = document.querySelectorAll("a.lang[data-lang]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function (ev) {
      save("superconducted-lang", ev.currentTarget.getAttribute("data-lang"));
    });
  }
})();
