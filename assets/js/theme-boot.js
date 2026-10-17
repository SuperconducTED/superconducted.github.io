// Runs in <head> before the page paints (the one script that is not deferred, about 300 bytes).
//  * Marks <html class="js">, so controls that need script show and their no-script fallbacks
//    hide, with no flash either way.
//  * Applies a saved light or dark choice so the page never flashes the other theme. With no
//    saved choice ("System") the theme follows the operating system.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var t = window.localStorage.getItem("superconducted-theme");
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: follow the system setting */ }
})();
