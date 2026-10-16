// The Home page demo: real T1 calibrations of one qubit, the value a frozen snapshot would keep,
// and an illustrative range. Data come from data/drift.json (scripts/extract_drift.py), inlined
// by Hugo as <script type="application/json" id="drift-data">. Drawn as SVG with no library,
// at the container's own pixel width so labels keep their size on a phone.
// Each point is [ISO date, T1 in microseconds, band low or null, band high or null].
(function () {
  var host = document.getElementById("drift-chart");
  var raw = document.getElementById("drift-data");
  if (!host || !raw) return;
  var data;
  try { data = JSON.parse(raw.textContent); } catch (e) { return; }
  var pts = data.points.map(function (p) {
    return { t: Date.parse(p[0]), v: p[1], lo: p[2], hi: p[3] };
  });
  if (pts.length < 2) return;

  var NS = "http://www.w3.org/2000/svg";
  var locale = host.getAttribute("data-locale") || "en";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  var vmax = 0;
  pts.forEach(function (p) { vmax = Math.max(vmax, p.v, p.hi || 0); });

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceStep(span, count) {
    var r = span / count, mag = Math.pow(10, Math.floor(Math.log10(r))), f = r / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  }

  var progress = reduce ? 1 : 0; // share of the time axis revealed, 0..1
  var clipRect = null, W = 0, M = null;

  function setClip() {
    if (clipRect) clipRect.setAttribute("width", M.l + progress * (W - M.l));
  }

  function draw() {
    W = Math.max(300, Math.round(host.clientWidth));
    var H = Math.round(Math.min(360, Math.max(240, W * 0.42)));
    M = { l: 44, r: 12, t: 22, b: 30 };
    var step = niceStep(vmax, H < 300 ? 3 : 4), ymax = Math.ceil(vmax / step) * step;
    function x(t) { return M.l + (t - t0) / (t1 - t0) * (W - M.l - M.r); }
    function y(v) { return H - M.b - v / ymax * (H - M.t - M.b); }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true", focusable: "false" });

    // Grid and y labels; T1 starts at zero so the drift is not exaggerated.
    for (var v = 0; v <= ymax + 1e-9; v += step) {
      el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), "class": v === 0 ? "c-axis" : "c-grid" }, svg);
      el("text", { x: M.l - 6, y: y(v) + 4, "text-anchor": "end" }, svg).textContent = String(Math.round(v));
    }
    el("text", { x: 0, y: 12, "text-anchor": "start" }, svg).textContent = host.getAttribute("data-label-y") || "T1 (µs)";

    // Month ticks on the first day of each month; every other label when space is short.
    var fmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    var d = new Date(t0), i = 0;
    var m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    var every = W < 520 ? 2 : 1;
    while (m.getTime() <= t1) {
      var mx = x(m.getTime());
      el("line", { x1: mx, x2: mx, y1: H - M.b, y2: H - M.b + 5, "class": "c-axis" }, svg);
      if (i % every === 0) el("text", { x: mx, y: H - M.b + 19, "text-anchor": "middle" }, svg).textContent = fmt.format(m);
      m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
      i++;
    }

    // Everything that "plays" sits inside a clip whose width grows with time.
    var defs = el("defs", {}, svg);
    var clip = el("clipPath", { id: "drift-clip" }, defs);
    clipRect = el("rect", { x: 0, y: 0, width: W, height: H }, clip);
    var played = el("g", { "clip-path": "url(#drift-clip)" }, svg);

    // Band: one polygon per run of consecutive banded points.
    var run = [];
    function flush() {
      if (run.length > 1) {
        var top = run.map(function (p) { return x(p.t) + "," + y(p.hi); });
        var bottom = run.map(function (p) { return x(p.t) + "," + y(p.lo); });
        el("polygon", { points: top.concat(bottom.slice().reverse()).join(" "), "class": "c-band" }, played);
        el("polyline", { points: top.join(" "), "class": "c-band-edge" }, played);
        el("polyline", { points: bottom.join(" "), "class": "c-band-edge" }, played);
      }
      run = [];
    }
    pts.forEach(function (p) { if (p.lo !== null && p.hi !== null) run.push(p); else flush(); });
    flush();

    // The frozen snapshot: the first value, held for the whole period.
    el("line", { x1: x(t0), x2: x(t1), y1: y(pts[0].v), y2: y(pts[0].v), "class": "c-frozen" }, svg);

    // The measured series.
    el("polyline", { points: pts.map(function (p) { return x(p.t) + "," + y(p.v); }).join(" "), "class": "c-line" }, played);
    var r = W < 520 ? 2 : 2.6;
    pts.forEach(function (p) { el("circle", { cx: x(p.t), cy: y(p.v), r: r, "class": "c-dot" }, played); });

    host.replaceChildren(svg);
    setClip();
  }

  var frame = null;
  function play() {
    if (reduce) { progress = 1; setClip(); return; }
    if (frame) cancelAnimationFrame(frame);
    var start = null, duration = 6000;
    function tick(now) {
      if (start === null) start = now;
      progress = Math.min(1, (now - start) / duration);
      setClip();
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  draw();
  var resizeTimer = null, lastWidth = host.clientWidth;
  window.addEventListener("resize", function () {
    if (host.clientWidth === lastWidth) return;
    lastWidth = host.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });

  var replay = document.getElementById("drift-replay");
  if (!reduce && "IntersectionObserver" in window) {
    var seen = false;
    new IntersectionObserver(function (entries, obs) {
      if (!seen && entries[0].isIntersecting) { seen = true; obs.disconnect(); play(); }
    }, { threshold: 0.4 }).observe(host);
    if (replay) { replay.hidden = false; replay.addEventListener("click", play); }
  } else {
    progress = 1;
    setClip();
  }
})();
