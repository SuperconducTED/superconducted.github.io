// Runs in <head> before the page paints: applies a saved light or dark choice so the page
// never flashes the other theme. With no saved choice the theme follows the system setting.
(function () {
  try {
    var t = window.localStorage.getItem("superconducted-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: follow the system setting */ }
})();
