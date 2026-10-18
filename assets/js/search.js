// Full-site search. Loaded by site.js the first time the search dialog opens; fetches this
// language's index (layouts/home.searchindex.json, about one record per page) once and keeps it
// in memory. Every result is built with createElement and textContent: index text is never
// parsed as HTML.
//
// Matching (docs/implementations/2026-10-18-site-redesign.md, "Search ranking"):
//   fold(text): lower-case with the page language's rules, decompose (NFD), drop combining
//   marks, map dotless ı to i. Folding works one UTF-16 unit at a time, so a position in the
//   folded text is the same position in the original, which is what lets hits be highlighted.
//   A page matches only if every query term occurs in some field (AND). A term scores the best
//   weight among the fields it occurs in (title 10, headings 5, description 3, body 1), plus 2
//   when it starts a word there. Pages are ranked by total score; ties keep index order.
//   Input is debounced: one search 120 ms after the last keystroke.
(function () {
  "use strict";
  var WEIGHTS = [["t", 10], ["h", 5], ["d", 3], ["b", 1]];
  var MAX_RESULTS = 8;
  var DEBOUNCE_MS = 120;
  var SNIPPET_HALF = 60;

  var records = null;     // the index, folded, once loaded
  var pending = null;     // the fetch in flight
  var wired = false;

  function makeFolder(lang) {
    var cache = Object.create(null);
    function foldUnit(c) {
      var hit = cache[c];
      if (hit !== undefined) return hit;
      var f = c.toLocaleLowerCase(lang).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
      f = f.length === 1 ? f : (f.charAt(0) || c);
      cache[c] = f;
      return f;
    }
    return function (s) {
      var out = new Array(s.length);
      for (var i = 0; i < s.length; i++) out[i] = foldUnit(s.charAt(i));
      return out.join("");
    };
  }

  function loadIndex(url, fold) {
    if (records) return Promise.resolve(records);
    if (pending) return pending;
    pending = fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("index HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      if (!Array.isArray(data)) throw new Error("index is not a list");
      records = data.map(function (d) {
        var rec = {
          t: String(d.t || ""), u: String(d.u || ""), s: String(d.s || ""), d: String(d.d || ""),
          h: Array.isArray(d.h) ? d.h.map(String).join(" · ") : "", b: String(d.b || "")
        };
        rec.f = { t: fold(rec.t), h: fold(rec.h), d: fold(rec.d), b: fold(rec.b) };
        return rec;
      });
      return records;
    }, function (err) { pending = null; throw err; });
    return pending;
  }

  function startsWord(text, at) {
    return at === 0 || !/[0-9a-z]/.test(text.charAt(at - 1));
  }

  function search(terms) {
    var hits = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i], total = 0, ok = true;
      for (var j = 0; j < terms.length && ok; j++) {
        var best = 0;
        for (var k = 0; k < WEIGHTS.length; k++) {
          var field = rec.f[WEIGHTS[k][0]];
          var at = field.indexOf(terms[j]);
          if (at < 0) continue;
          var score = WEIGHTS[k][1] + (startsWord(field, at) ? 2 : 0);
          if (score > best) best = score;
        }
        if (best === 0) ok = false; else total += best;
      }
      if (ok) hits.push({ rec: rec, score: total, order: i });
    }
    hits.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return hits.slice(0, MAX_RESULTS);
  }

  // Append `text` to `parent`, wrapping every hit of any term in <mark>. `folded` is fold(text).
  function appendMarked(parent, text, folded, terms) {
    var ranges = [];
    for (var i = 0; i < terms.length; i++) {
      var from = 0, at;
      while ((at = folded.indexOf(terms[i], from)) >= 0) {
        ranges.push([at, at + terms[i].length]);
        from = at + terms[i].length;
      }
    }
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    for (var r = 0; r < ranges.length; r++) {
      var s = Math.max(ranges[r][0], pos), e = ranges[r][1];
      if (e <= pos) continue;
      if (s > pos) parent.appendChild(document.createTextNode(text.slice(pos, s)));
      var m = document.createElement("mark");
      m.textContent = text.slice(s, e);
      parent.appendChild(m);
      pos = e;
    }
    if (pos < text.length) parent.appendChild(document.createTextNode(text.slice(pos)));
  }

  // The body around the first hit, cut at word boundaries; the description when the body has none.
  function snippet(rec, terms) {
    var at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = rec.f.b.indexOf(terms[i]);
    if (at < 0) return { text: rec.d, folded: rec.f.d };
    var s = Math.max(0, at - SNIPPET_HALF), e = Math.min(rec.b.length, at + SNIPPET_HALF);
    while (s > 0 && rec.b.charAt(s - 1) !== " ") s--;
    while (e < rec.b.length && rec.b.charAt(e) !== " ") e++;
    var pre = s > 0 ? "… " : "", post = e < rec.b.length ? " …" : "";
    return { text: pre + rec.b.slice(s, e) + post, folded: pre + rec.f.b.slice(s, e) + post };
  }

  function attach(dialog) {
    if (wired) return;
    wired = true;
    var lang = dialog.getAttribute("data-lang") || "en";
    var fold = makeFolder(lang);
    var input = dialog.querySelector(".search-input");
    var list = dialog.querySelector(".search-results");
    var status = dialog.querySelector(".search-status");
    var url = dialog.getAttribute("data-index");
    var selected = -1;
    var timer = null;

    function say(text) { status.textContent = text; status.hidden = !text; }
    function fill(template, values) {
      return template.replace(/%([ds])/g, function (_, k) { return String(values[k]); });
    }
    function clear() { list.replaceChildren(); selected = -1; input.removeAttribute("aria-activedescendant"); }
    function skeleton() {
      clear();
      for (var i = 0; i < 3; i++) {
        var li = document.createElement("li");
        li.className = "skeleton-row";
        li.setAttribute("aria-hidden", "true");
        list.appendChild(li);
      }
    }
    function select(i) {
      var items = list.querySelectorAll("[role='option']");
      if (!items.length) return;
      selected = (i + items.length) % items.length;
      for (var k = 0; k < items.length; k++) items[k].setAttribute("aria-selected", k === selected ? "true" : "false");
      input.setAttribute("aria-activedescendant", items[selected].id);
      items[selected].scrollIntoView({ block: "nearest" });
    }

    function run() {
      var raw = input.value.trim().slice(0, 100);
      var terms = fold(raw).split(/\s+/).filter(function (t) { return t.length > 1; }).slice(0, 8);
      if (!terms.length) { clear(); input.setAttribute("aria-expanded", "false"); say(dialog.getAttribute("data-hint")); return; }
      if (!records) {
        skeleton();
        say(dialog.getAttribute("data-loading"));
        loadIndex(url, fold).then(run, function () { clear(); say(dialog.getAttribute("data-error")); });
        return;
      }
      var hits = search(terms);
      clear();
      if (!hits.length) {
        input.setAttribute("aria-expanded", "false");
        say(fill(dialog.getAttribute("data-empty"), { s: raw }));
        return;
      }
      for (var i = 0; i < hits.length; i++) {
        var rec = hits[i].rec;
        // The link itself is the listbox option (ARIA allows no interactive element inside
        // an option); the list item is presentation only.
        var li = document.createElement("li");
        li.setAttribute("role", "none");
        var a = document.createElement("a");
        a.id = "search-hit-" + i;
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");
        a.href = rec.u;
        a.tabIndex = -1;
        var sec = document.createElement("span");
        sec.className = "r-section";
        sec.textContent = rec.s;
        var title = document.createElement("span");
        title.className = "r-title";
        appendMarked(title, rec.t, rec.f.t, terms);
        var snip = snippet(rec, terms);
        var body = document.createElement("span");
        body.className = "r-snippet";
        appendMarked(body, snip.text, snip.folded, terms);
        a.appendChild(sec);
        a.appendChild(title);
        if (snip.text) a.appendChild(body);
        a.addEventListener("click", function () { dialog.close(); });
        li.appendChild(a);
        list.appendChild(li);
      }
      input.setAttribute("aria-expanded", "true");
      var key = hits.length === 1 ? "data-count-one" : "data-count-other";
      say(fill(dialog.getAttribute(key), { d: hits.length }));
      select(0);
    }

    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, DEBOUNCE_MS);
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); select(selected + 1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); select(selected - 1); }
      else if (ev.key === "Enter") {
        var item = list.querySelector("a[aria-selected='true']");
        if (item) { ev.preventDefault(); dialog.close(); window.location.assign(item.href); }
      }
    });
    // Warm the index as soon as the dialog first opens, so the first keystroke is answered fast.
    loadIndex(url, fold).then(function () { if (input.value.trim()) run(); }, function () { say(dialog.getAttribute("data-error")); });
    if (input.value.trim()) run();
  }

  window.SuperconductedSearch = { attach: attach };
})();
