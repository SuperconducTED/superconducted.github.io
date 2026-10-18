// Runs in <head> before the page paints (the one script that is not deferred, about 400 bytes).
//  * Marks <html class="js">, so controls that need script show and their no-script fallbacks
//    hide, with no flash either way.
//  * Applies a saved light or dark choice so the page never flashes the other theme. With no
//    saved choice ("System") the theme follows the operating system.
//  * Hides the newsletter banner before it is drawn once the visitor has closed it or signed up
//    (class "nl-hidden"), so it never appears and then jumps away.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var t = window.localStorage.getItem("superconducted-theme");
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    var n = window.localStorage.getItem("superconducted-newsletter");
    if (n === "dismissed" || n === "subscribed") root.classList.add("nl-hidden");
  } catch (e) { /* storage blocked: follow the system setting, show the banner */ }
})();
