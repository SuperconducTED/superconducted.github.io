// Interface behaviour shared by every page. Deferred; each part checks that its markup exists
// and does nothing otherwise. No part writes HTML from strings: the DOM is built with
// createElement and textContent only (the production CSP enforces this with Trusted Types).
//
//   theme      three-way control (system, light, dark); saves light/dark, clears for system
//   language   remembers the switcher's choice for the root page (layouts/alias.html)
//   header     hairline once the page scrolls (IntersectionObserver, no scroll listener)
//   menu       mobile nav panel: toggle, Escape, outside click, link click; focus returns
//   progress   reading progress bar, only where CSS scroll timelines are missing
//   to top     back-to-top button after one screen; moves focus to the top of main
//   toc        marks the section in view; opens the contents list on wide screens
//   copy       Copy buttons on code blocks, with an announced "Copied" state
//   print      opens every <details> while printing, restores them after
//   search     opens the dialog (button, "/", Ctrl/Cmd+K) and loads search.js on first use
//   newsletter pop-up invitation: "No thanks", close and Escape (remembered); hides after a sign-up
//
// Storage keys: superconducted-theme, superconducted-lang and superconducted-newsletter only
// (preferences, no tokens or personal data). Every storage access is wrapped: blocked storage just means no memory.
(function () {
  "use strict";
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function store(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* not remembered */ }
  }
  function onAll(selector, event, handler) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].addEventListener(event, handler);
  }

  // ---- Theme ----------------------------------------------------------------------------
  function savedTheme() {
    var t = root.getAttribute("data-theme");
    return t === "light" || t === "dark" ? t : "system";
  }
  function markTheme() {
    var mode = savedTheme();
    var buttons = document.querySelectorAll("[data-theme-set]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-theme-set") === mode ? "true" : "false");
    }
  }
  function applyTheme(mode) {
    if (mode === "light" || mode === "dark") {
      root.setAttribute("data-theme", mode);
      store("superconducted-theme", mode);
    } else {
      root.setAttribute("data-theme", "auto");
      store("superconducted-theme", null);
    }
    markTheme();
    document.dispatchEvent(new CustomEvent("superconducted:theme"));
  }
  onAll("[data-theme-set]", "click", function (ev) {
    var mode = ev.currentTarget.getAttribute("data-theme-set");
    if (mode === savedTheme()) return;
    // Instant on purpose: a view-transition cross-fade was tried, but Chrome does not hit-test
    // the page while one plays, so a second click within it was silently lost.
    applyTheme(mode);
  });
  markTheme();

  // ---- Language memory --------------------------------------------------------------------
  onAll("a.lang[data-lang]", "click", function (ev) {
    store("superconducted-lang", ev.currentTarget.getAttribute("data-lang"));
  });

  // ---- Newsletter invitation (pop-up card) ----------------------------------------------------
  var popup = document.querySelector(".nl-popup");
  if (popup) {
    var dismissPopup = function () {
      store("superconducted-newsletter", popup.classList.contains("is-done") ? "subscribed" : "dismissed");
      var hadFocus = popup.contains(document.activeElement);
      root.classList.add("nl-hidden");
      // The control that had focus just vanished; continue from the top of the content.
      if (hadFocus) { var main = document.getElementById("main"); if (main) main.focus({ preventScroll: true }); }
    };
    onAll("[data-nl-dismiss]", "click", dismissPopup);
    popup.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); dismissPopup(); }
    });
    // Signed up through the box on the page instead: the invitation has done its job.
    document.addEventListener("superconducted:subscribed", function (ev) {
      var form = ev.detail && ev.detail.form;
      if (form && !popup.contains(form)) root.classList.add("nl-hidden");
    });
  }

  // ---- Header state, back to top ------------------------------------------------------------
  var header = document.querySelector(".site-header");
  var toTop = document.querySelector(".to-top");
  if ("IntersectionObserver" in window) {
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.className = "scroll-sentinel";
    document.body.insertBefore(sentinel, document.body.firstChild);
    new IntersectionObserver(function (entries) {
      if (header) header.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);

    var main = document.getElementById("main");
    if (toTop && main) {
      // Visible once the reader is a full screen down: a marker one viewport below the top.
      var marker = document.createElement("div");
      marker.setAttribute("aria-hidden", "true");
      marker.className = "screen-marker";
      document.body.insertBefore(marker, document.body.firstChild);
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        toTop.classList.toggle("is-visible", !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(marker);
    }
  }
  if (toTop) {
    toTop.addEventListener("click", function (ev) {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      var main = document.getElementById("main");
      if (main) main.focus({ preventScroll: true });
    });
  }

  // ---- Reading progress (fallback for browsers without CSS scroll timelines) ----------------
  var bar = document.querySelector(".progress");
  var hasTimeline = window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
  if (bar && !hasTimeline) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---- Mobile menu ------------------------------------------------------------------------
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open, returnFocus) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", toggle.getAttribute(open ? "data-label-close" : "data-label-open"));
      nav.classList.toggle("is-open", open);
      if (!open && returnFocus) toggle.focus();
      if (open) {
        var first = nav.querySelector("a, button");
        if (first) first.focus();
      }
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true", false);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && nav.classList.contains("is-open")) setOpen(false, true);
    });
    document.addEventListener("click", function (ev) {
      if (nav.classList.contains("is-open") && !nav.contains(ev.target) && !toggle.contains(ev.target)) setOpen(false, false);
    });
    nav.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest("a")) setOpen(false, false);
    });
    window.matchMedia("(min-width: 60rem)").addEventListener("change", function (e) {
      if (e.matches) setOpen(false, false);
    });
  }

  // ---- Contents rail ------------------------------------------------------------------------
  var toc = document.querySelector(".toc");
  if (toc) {
    var details = toc.querySelector("details");
    // Closed in the markup; opened only where it has its own column, so nothing shifts.
    if (details && window.matchMedia("(min-width: 64rem)").matches) details.open = true;
    var links = toc.querySelectorAll("a[href^='#']");
    var byId = {};
    var targets = [];
    for (var i = 0; i < links.length; i++) {
      var id = decodeURIComponent(links[i].getAttribute("href").slice(1));
      var target = document.getElementById(id);
      if (target) { byId[id] = links[i]; targets.push(target); }
    }
    if (targets.length && "IntersectionObserver" in window) {
      // A heading counts as "in view" while it crosses a band 20% to 30% down the screen.
      var current = null;
      var spy = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) {
          if (!entries[j].isIntersecting) continue;
          if (current) current.removeAttribute("aria-current");
          current = byId[entries[j].target.id];
          if (current) current.setAttribute("aria-current", "true");
        }
      }, { rootMargin: "-20% 0px -70% 0px" });
      for (var k = 0; k < targets.length; k++) spy.observe(targets[k]);
    }
  }

  // ---- Copy buttons on code blocks ----------------------------------------------------------
  // The Clipboard API first; if it is missing or refuses (no focus, permissions), the older
  // select-and-copy route.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return copyBySelection(text); });
    }
    return copyBySelection(text);
  }
  function copyBySelection(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.className = "visually-hidden";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) resolve(); else reject(new Error("copy failed"));
    });
  }
  onAll(".copy", "click", function (ev) {
    var button = ev.currentTarget;
    var block = button.closest(".code-block");
    var code = block && block.querySelector("pre code");
    if (!code) return;
    copyText(code.textContent.replace(/\n$/, "")).then(function () {
      var status = block.querySelector(".copy-status");
      var label = button.querySelector(".copy-text");
      var copied = button.getAttribute("data-copied");
      button.classList.add("is-copied");
      if (label) { label.setAttribute("data-was", label.textContent); label.textContent = copied; }
      if (status) status.textContent = copied;
      window.setTimeout(function () {
        button.classList.remove("is-copied");
        if (label && label.getAttribute("data-was")) label.textContent = label.getAttribute("data-was");
        if (status) status.textContent = "";
      }, 1800);
    }, function () { /* clipboard refused: the text can still be selected by hand */ });
  });

  // ---- Print: expand every answer, then put them back ---------------------------------------
  var opened = [];
  window.addEventListener("beforeprint", function () {
    var all = document.querySelectorAll("details:not([open])");
    for (var i = 0; i < all.length; i++) { all[i].open = true; opened.push(all[i]); }
  });
  window.addEventListener("afterprint", function () {
    while (opened.length) opened.pop().open = false;
  });

  // ---- Search: open the dialog, load the search module once ---------------------------------
  var dialog = document.getElementById("search");
  if (dialog && typeof dialog.showModal === "function") {
    var SEARCH_PATH = /^\/js\/search\.min\.[0-9a-f]{64}\.js$/;
    var policy = null;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      // The one Trusted Types policy the CSP allows: it vouches for the fingerprinted search
      // script on this origin and nothing else.
      policy = window.trustedTypes.createPolicy("sc-loader", {
        createScriptURL: function (url) {
          if (!SEARCH_PATH.test(url)) throw new TypeError("sc-loader: refused " + url);
          return url;
        }
      });
    }
    var loading = null;
    var loadSearch = function () {
      if (window.SuperconductedSearch) return Promise.resolve();
      if (loading) return loading;
      var src = dialog.getAttribute("data-src");
      if (!SEARCH_PATH.test(src)) return Promise.reject(new Error("unexpected search script path"));
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.integrity = dialog.getAttribute("data-integrity");
        s.crossOrigin = "anonymous";
        s.onload = function () { resolve(); };
        s.onerror = function () { loading = null; reject(new Error("search script failed to load")); };
        s.src = policy ? policy.createScriptURL(src) : src;
        document.head.appendChild(s);
      });
      return loading;
    };
    var opener = null;
    var openSearch = function () {
      if (dialog.open) return;
      opener = document.activeElement;
      dialog.showModal();
      var input = dialog.querySelector(".search-input");
      if (input) { input.focus(); input.select(); }
      loadSearch().then(function () {
        window.SuperconductedSearch.attach(dialog);
      }, searchFailed);
    };
    // The search script is fingerprinted, and a deploy replaces every file. A page whose HTML
    // was cached before the latest deploy (GitHub Pages allows 10 minutes) asks for a script
    // that no longer exists. A 404 for it means exactly that, so the dialog says so and offers
    // a reload instead of blaming the connection.
    var searchFailed = function () {
      var status = dialog.querySelector(".search-status");
      if (!status) return;
      status.textContent = dialog.getAttribute("data-error");
      fetch(dialog.getAttribute("data-src"), { method: "HEAD", cache: "no-store", credentials: "same-origin" }).then(function (r) {
        if (r.status !== 404) return;
        status.textContent = dialog.getAttribute("data-stale") + " ";
        var reload = document.createElement("button");
        reload.type = "button";
        reload.className = "button small";
        reload.textContent = dialog.getAttribute("data-reload");
        reload.addEventListener("click", function () { window.location.reload(); });
        status.appendChild(reload);
        reload.focus();
      }, function () { /* offline: the connection message above stands */ });
    };
    onAll("[data-search-open]", "click", openSearch);
    dialog.addEventListener("close", function () {
      if (opener && opener.focus) opener.focus();
    });
    var closeBtn = dialog.querySelector(".search-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (ev) {
      if (ev.target === dialog) dialog.close(); // a click on the backdrop
    });
    // In a search field Chrome spends the first Escape on clearing the text; here Escape
    // always closes, as the hint in the dialog's footer promises.
    dialog.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); dialog.close(); }
    });
    document.addEventListener("keydown", function (ev) {
      var t = ev.target;
      var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((ev.key === "k" || ev.key === "K") && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        openSearch();
      } else if (ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        openSearch();
      }
    });
  }
})();
