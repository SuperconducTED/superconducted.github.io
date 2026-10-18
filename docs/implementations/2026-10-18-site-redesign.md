# 2026-10-18: site-redesign

Status: **plan, written before any site code changes.** An as-of section is appended after the
build; the plan rows are not edited (dated records are append-only).

## Problem / Motivation

The site launched on 2026-10-16 (PR #1) as a deliberately small first version. Mert asked on
2026-10-18 for a full upgrade before professors review it: a proper look, many interface
features, a faster and harder-to-attack build, and copy rewritten to a strict voice (specific,
scannable, no padding, proof next to every claim, talking to one reader).

The request is a long checklist written for a generic web application. This site is a static
Hugo build served by GitHub Pages: no server code, no database, no API, no accounts, no
uploads. A senior answer builds every item that has a referent here, records evidence for the
items that are already true, and says plainly which items cannot apply, instead of adding a
backend so the checklist has something to tick. A backend would make the site slower and give
an attacker something to attack, the opposite of two of the request's goals.

Measured before planning (2026-10-18):

- `https://superconducted.github.io/en/` answers through Fastly (`Via: 1.1 varnish`,
  `X-Served-By: cache-vie...`), with `Content-Encoding: gzip`, `Strict-Transport-Security`,
  `Cache-Control: max-age=600` and `Access-Control-Allow-Origin: *`. GitHub sets all of these;
  a Pages site cannot change response headers.
- The current build passes `scripts/check_site.py` (10 checks, 249 links) with Hugo 0.168.0.
- **An existing bug:** Hugo's default code highlighting writes inline `style` attributes on
  `<pre>` (Get started, both languages), and the page's CSP (`style-src 'self'`) blocks them.
  The checker does not look for this. Fixed below.
- Hugo 0.167.0 has one open advisory, GHSA-r73q-gwx2-fpxm (theme `module.replacements`;
  affects only sites using an untrusted theme or module, which this site does not). 0.168.0
  fixes it and embeds the same KaTeX (0.18.4), so `static/katex/` stays as it is.
- The four Actions in `pages.yml` are already at their latest releases.

## Decisions taken (Mert, 2026-10-18)

| Question | Answer |
| --- | --- |
| Cookie banner, UTM, analytics | No tracking and no banner. The site sets no cookies, so a banner would be a false statement. A footer line says so. UTM is skipped because nothing would read it. |
| Updates and newsletter | An Updates section (EN and TR, paginated, Atom feed, latest posts on Home) and a real email signup through **Buttondown** (double opt-in: Buttondown verifies each address). Mert creates the Buttondown account. |
| `anthropic/claude-code-security-review` | Run the local `/security-review` skill on the branch, and add the Action's workflow, which runs once Mert adds the `CLAUDE_API_KEY` secret. |
| Lighthouse | Lighthouse 12.8.2 installed in the scratch folder `C:/t-lh` (13.x needs Node 22; this machine has Node 20.16). |
| Hugo | Upgrade the pin to 0.168.0 (downloaded, checksum verified). |

Standing decisions from 2026-10-16 that this plan keeps: Cryostat palette, Space Grotesk and
Space Mono, the accent colour only on links, the active state and range elements; brand files
byte-identical to the kit; every number from the engine's numerical-claims register; EN and TR
in the same pull request; contact through GitHub (Discussions and issues), no email address on
the page; the tagline stays the English brand line.

## Triage of the request

Every item from the request, in its order, with what this plan does about it.

### Interface

| Item | Bucket | What happens |
| --- | --- | --- |
| Better dark mode toggle | Build | Three-way control (System, Light, Dark) with icons and `aria-pressed`; the change animates with the View Transitions API where supported and is instant under reduced motion. |
| Sticky header | Build | `position: sticky`, translucent ground with blur; a hairline appears once the page scrolls (an IntersectionObserver sentinel, no scroll listener). |
| Mobile menu | Build | Below 48rem a Menu button (`aria-expanded`, `aria-controls`) opens a panel with the nav, language and theme; Escape and a link click close it and return focus. |
| Hover states on every button | Build | One button system (primary, secondary, ghost, icon) with hover, focus-visible, active and disabled states; links and cards get hover too. |
| Scroll progress bar | Build | A 2 px bar under the header. CSS scroll-driven animation where supported, no script at all; elsewhere a passive, rAF-throttled listener. |
| Back to top | Build | Appears after one screen of scroll; smooth unless reduced motion; moves focus to the top of `main`. |
| Loading animations | Build | One staggered entrance on page load, section reveals on scroll; content is visible without script (the hidden state is set only after `js` is on `<html>`), and nothing moves under reduced motion. |
| Full site search | Build | Hugo writes `search.json` per language at build time; a `<dialog>` opens from the header, `/` or Ctrl/Cmd+K; the search script and index load on first open only. Accent-folded, Turkish-aware matching. |
| Skip to content | Already true, restyled | The link exists; it gets the new button style. |
| Floating contact button | Build | Bottom-right button opening a small menu: ask a question (Discussions), report a bug (issues). No email address, per the 2026-10-16 decision. |
| Expandable FAQ | Build | `<details>` and `<summary>` (works without script), on Home, placed before the final call to action so objections are answered first. |
| Newsletter with success state | Build | Buttondown's documented embed form (standard POST, opened in a new tab; Buttondown asks sites not to submit it with `fetch` because the subscriber may need to pass a CAPTCHA there). On submit the box switches to "check your inbox". Hidden until `params.newsletter.buttondown` holds the username. |
| Simple cookie banner | Declined (Mert) | Footer privacy line instead. |
| Clean 404 | Build | Large mono 404, search button, links home and to the main pages, both languages. |
| Print stylesheet | Build | Ink-friendly colours, no chrome, external link URLs printed after the link, FAQ answers expanded, no page breaks inside figures, code and equations. |
| UTM tracking on links | Declined (Mert) | Nothing reads UTM without analytics. |
| Copy buttons on snippets | Build | A code-block render hook adds a Copy button to every fenced block, with a "Copied" state announced to screen readers. |
| Updates with every post | Build | Updates section, a post template (`archetypes/updates.md`), Atom feeds per language, the latest three posts on Home. A new post is two files, one per language. |

### Performance

| Item | Bucket | What happens |
| --- | --- | --- |
| Lazy loading | Build | An image render hook gives every content image `loading="lazy"`, `decoding="async"` and its intrinsic size; the hero mark is no longer an `<img>` pair (see compress). |
| Compress all images | Build, narrowed | Brand kit files stay byte-identical (`data/brand.yaml` hashes them). The two 75 KB hero SVGs are served as Hugo-minified, fingerprinted copies, and only the one for the current theme downloads (CSS background from a theme token instead of two `<img>` tags, one of them hidden but still fetched). Content images, when posts add them, go through Hugo's image pipeline to WebP at the size shown. |
| Split code into chunks | Build | Per-feature scripts: a small core on every page, the demo only on Home, search only on first open, the newsletter script only where the form is. |
| Cache API responses | Build, narrowed | The only fetched data is `search.json` (same origin). The search module keeps it in memory after the first load; the browser's HTTP cache (600 s from Pages) does the rest. No service worker: it would risk serving stale pages to reviewers for little gain on a site this size. |
| Add CDN | Already true | Fastly fronts GitHub Pages (headers above). |
| Minify JS and CSS | Already true, extended | Every new asset goes through `minify` and `fingerprint` with SRI; HTML is minified by `--minify`. |
| Index the database | Not applicable | No database. |
| Reduce re-renders | Build | No framework; the chart redraws only when its width changes; scroll work is rAF-throttled and compositor-only (`transform`). |
| Debounce input handlers | Build | Search input 120 ms; resize 120 ms (kept). |
| Paginate large lists | Build | Updates list, 10 posts per page. |
| Remove unused dependencies | Build | There is no package tree. Unused i18n keys are removed; the checker gains a weight budget so growth is visible. |
| Defer non-critical scripts | Already true, kept | All scripts `defer` except the 200-byte theme boot, which must run before paint to avoid a flash of the wrong theme. |
| Loading skeletons | Build, narrowed | Only for content that really loads later: the demo chart (a skeleton until the SVG is drawn) and search results while the index loads. Skeletons over content already in the HTML would be fake. |
| Load balancer | Not applicable | Static files from a CDN. |
| Compress API payloads | Already true | `search.json` is served gzip by Pages; it is also built minified. |
| Connection pooling | Not applicable | No database. |
| Cache expensive queries | Not applicable | No queries at request time; Hugo computes everything at build time. |
| N+1 queries | Not applicable | No database. Template loops over `hugo.Data` run once per build. |
| Server-side caching | Already true | Fastly edge cache, 600 s, set by GitHub. |
| Lighthouse audit | Build | Before (live site) and after (production build on a local server that mimics Pages: gzip, same cache header), mobile and desktop; numbers recorded in the as-of section. |

### Copy

All page text in both languages is rewritten to these rules: no em dashes (already checked);
no fabricated claims (every number keeps its register row; aims stay worded as aims; the
research-preview notice stays); specific headlines; one idea per section with at most three
bullets; short paragraphs; the body proves the headline; benefit before feature; calls to action
as verb plus outcome; no generic openers; no two-beat antithesis ("not X, but Y"); no aphorism
formulas; second person, one reader; objections answered before the last call to action; proof
(a register row, a PR, the code path, the chart) placed next to the claim it supports.

**One exception, flagged for Mert:** the brand tagline "Noise as a range, not a number." is
itself a two-beat antithesis. It is a decided brand element (2026-10-16), so it stays as the
brand line (footer, social card, page title) but no longer heads the hero; the hero gets a
specific headline instead.

### Security

| Item | Bucket | What happens |
| --- | --- | --- |
| Enforce permissions server-side | Not applicable | No server, no accounts, no protected data. |
| Enable RLS | Not applicable | No database. |
| Verify email addresses | Build (Buttondown) | Double opt-in, Buttondown's default: an address is only subscribed after its owner clicks the confirmation link. |
| Keep tokens out of local storage | Already true | Local storage holds only `superconducted-theme` and `superconducted-lang`; the checker gains a source check that no other key is written. |
| Keep API secrets server side | Already true | The site holds no secret; Buttondown's embed endpoint takes a public username, no key. The Action's key lives only in GitHub's encrypted secrets. |
| Sensitive data out of logs | Already true, checked | No logging; the checker fails on `console.log` in shipped scripts. |
| Parameterized SQL | Not applicable | No SQL. |
| Hash passwords | Not applicable | No passwords. |
| Validate form inputs | Build | Email field: `type="email"`, `required`, `maxlength="254"`, `autocomplete="email"`, trimmed, checked before submit with a visible message; the button is disabled while submitting and for a short cool-down to stop double posts. Buttondown validates again on its side. |
| Block cross-site scripting | Build | CSP stays `script-src 'self'` (no inline script, no `eval`); production adds `require-trusted-types-for 'script'; trusted-types 'none'`, so Chromium browsers refuse any string-to-HTML sink outright. Scripts build DOM with `textContent` only; the checker fails on `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `eval` in `assets/js`. Hugo 0.168.0 carries the escaping fixes of the 2026 advisories. |
| Validate file uploads | Not applicable | No uploads. |
| Verify webhook signatures | Not applicable | No webhooks. |
| Rate limit all requests | Not applicable here | GitHub Pages and Buttondown rate-limit their own endpoints; the site has no endpoint of its own. The signup cool-down is the client-side share. |
| Tighten CORS | Not applicable | Pages sends `Access-Control-Allow-Origin: *` and it cannot be changed; every file is public anyway. The CSP's `connect-src` limits where *our* pages may send requests: `'self'` only. |
| Disable production debugging | Already true, checked | Dev-only output (pending facts, live reload) is gated on `hugo.IsProduction`; no source maps; the checker fails on `livereload` in the build. |
| Update vulnerable dependencies | Build | Hugo 0.167.0 to 0.168.0; Actions already latest; a Dependabot config keeps the Actions pins current. |
| claude-code-security-review | Build | Workflow pinned to commit `0c6a49f1fa56a1d472575da86a94dbc1edb78eda`, same-repo PRs only, skipped until the secret exists; plus the local `/security-review` run, recorded below. |

## What will change (planned)

| File | One-sentence description |
| --- | --- |
| `hugo.toml` | Updates section menu entries, output formats `SearchIndex` (home) and `Atom` (updates section), pagination, highlight with CSS classes, Buttondown param, privacy-safe defaults. |
| `layouts/baseof.html` | New chrome: progress bar, header, floating contact and back-to-top, per-page script slots. |
| `layouts/_partials/head.html` | CSP with Trusted Types, `connect-src 'self'`, `form-action` only for Buttondown when configured; Atom `<link rel="alternate">`; font preloads. |
| `layouts/_partials/header.html` | Sticky header, search button, three-way theme control, language switch, mobile menu. |
| `layouts/_partials/footer.html` | Footer with privacy line, feed link, tagline as brand line. |
| `layouts/_partials/{fab,newsletter,faq,post-card,icons}.html` | New partials for the contact button, signup, FAQ, update cards and the inline SVG icon set. |
| `layouts/home.html` | Rebuilt Home: hero with proof chart, problem steps, what works today, facts, FAQ, updates and signup, final call to action. |
| `layouts/page.html` | Inner page with a sticky contents rail on wide screens. |
| `layouts/updates/list.html`, `layouts/updates/single.html` | Updates list (paginated) and post page. |
| `layouts/updates/list.atom.xml` | Atom feed per language. |
| `layouts/home.searchindex.json` | The per-language search index. |
| `layouts/404.html` | Rebuilt not-found page. |
| `layouts/_markup/render-codeblock.html` | Code blocks with a Copy button and a language label. |
| `layouts/_markup/render-image.html` | Lazy, sized, WebP-processed content images. |
| `layouts/_markup/render-link.html` | External links get `rel="noopener"` when they open a new tab (none do today) and a print URL hook. |
| `assets/css/site.css` | New design system on the existing Cryostat tokens: type scale, buttons, header, cards, motion, highlight theme, print styles. |
| `assets/js/theme-boot.js` | Also marks `<html class="js">` before paint so reveal styles never hide content without script. |
| `assets/js/site.js` | Replaces `theme.js`: theme control, menu, header state, progress, back to top, reveals, contact menu, copy buttons, print expansion, search launcher. |
| `assets/js/search.js` | The search dialog, loaded on first open. |
| `assets/js/newsletter.js` | Signup validation and success state. |
| `assets/js/drift-demo.js` | Skeleton handling; otherwise unchanged. |
| `content/{en,tr}/_index.md` | Home copy, FAQ and calls to action in front matter. |
| `content/{en,tr}/how-it-works.md`, `get-started.md`, `team.md` | Rewritten copy. |
| `content/{en,tr}/updates/_index.md` and one seed post per language | The section and its first post. |
| `archetypes/updates.md` | Template for a new post. |
| `i18n/en.yaml`, `i18n/tr.yaml` | New interface strings; unused keys removed. |
| `scripts/check_site.py` | New checks: inline styles under a strict CSP, unsafe DOM sinks, storage keys, console calls, live reload, search index coverage, feed validity, page weight budget, `rel="noopener"`. |
| `.github/workflows/pages.yml` | Hugo 0.168.0 and its checksum. |
| `.github/workflows/security-review.yml` | The Claude Code security review Action. |
| `.github/dependabot.yml` | Weekly Actions updates. |
| `README.md` | New sections: writing an update, the newsletter setting, the security workflow. |
| `docs/implementations/2026-10-18-site-redesign.md` | This record. |

## Implementation approach

**Design direction.** The brand fixes the type and colour, so character comes from layout,
detail and motion. The direction is a *calibration instrument*: the page reads like a
well-made lab readout. Mono "callout" labels index each section (`01 / The problem`); thin
dimension lines with end ticks divide sections, echoing the interval brackets of the mark; the
hero sets a large, tight Space Grotesk headline beside a framed readout of the real drift chart
with crop-mark corners; a faint measurement grid sits behind the hero only. Range elements (the
chart band, the brackets around the headline's key phrase, the progress bar as position
indicator) carry the accent; everything else stays in the text and surface roles. Motion is
few and deliberate: one staggered entrance, the chart drawing itself, reveals on scroll.

**Progressive enhancement.** Every page works without script: navigation (the menu is a plain
list when script is off), FAQ (`<details>`), the signup (a standard form POST), the 404 links.
Script adds the theme control, search, copy, progress and the floating buttons.

**Search.** Hugo renders `home.searchindex.json` per language: for each page, title, URL,
section, description, headings and plain text. The header button loads `search.js` (by
injecting a fingerprinted script with SRI) on first use; the module fetches the index once and
keeps it in memory.

**CSP per page.** Base: `default-src 'self'; img-src 'self' data:; style-src 'self'` (plus
`'unsafe-inline'` on math pages only, as today); `font-src 'self'; script-src 'self';
connect-src 'self'; base-uri 'self'; object-src 'none'; form-action` `'none'` or Buttondown's
origin when the form is on; in production `require-trusted-types-for 'script'; trusted-types
'none'`. Live reload in development keeps its websocket.

## Mathematical / Statistical details

**Search ranking.** A query is lower-cased with the page language's rules
(`toLocaleLowerCase("tr")` maps I to ı), split on whitespace into terms t1..tn, and each term
and each field is folded: Unicode NFD, combining marks removed, ı mapped to i, so "calisir"
finds "çalışır". A page matches only if every term occurs in at least one field (AND); the last
term matches as a prefix so results update while typing. Score = sum over terms of the best
field weight the term hits: title 10, headings 5, description 3, body 1, with a bonus of 2 when
the term matches a whole word. Ties keep index order (Home first). The result snippet is the
body around the first hit, 60 characters either side, cut at word boundaries.

**Debounce.** The search runs 120 ms after the last keystroke (trailing edge), so a fast typist
triggers one search per pause instead of one per key.

**Scroll progress.** p = scrollY / (scrollHeight − innerHeight), clamped to [0, 1], drawn as
`transform: scaleX(p)` on a full-width bar (compositor only, no layout).

**Contrast.** Every new colour token is checked by `check_site.py` against WCAG 2.x: 4.5:1 for
text roles on the ground and surface, 3:1 for non-text range elements, in light and dark.

**Weight budget.** For each built HTML page the checker sums the page and the CSS and JS it
references (uncompressed bytes) and fails above a budget: 200 KB for ordinary pages, 400 KB for
math pages (KaTeX CSS). Fonts and images are reported, not budgeted.

## Design decisions

- **No backend for the checklist's server items.** RLS, pooling, a load balancer and the rest
  need a server this site does not have; inventing one would add cost, latency and attack
  surface to satisfy wording. Each is recorded as not applicable with the reason.
- **Own search over Pagefind or a hosted service.** About a dozen pages per language; a
  build-time JSON index and a small script cost nothing to run, add no dependency, and keep
  every request on our origin (`connect-src 'self'`). Pagefind would be the choice past a few
  hundred pages.
- **Buttondown by plain form POST, not `fetch`.** Buttondown's documentation asks for a
  standard form because the subscriber may need to complete a CAPTCHA on its page; `fetch`
  would also need `connect-src` to a third party. The success state is honest about what the
  page can know: "finish in the Buttondown tab, then confirm from your inbox."
- **Trusted Types over sanitising.** The scripts never need to insert HTML, so the policy
  forbids it outright; there is nothing to sanitise and nothing to get wrong.
- **CSS scroll-driven progress with a script fallback.** Zero main-thread work where the browser
  supports it.
- **Hero mark as a CSS background chosen by theme token.** Saves one 75 KB download per visit
  and keeps the kit files untouched.
- **Tagline kept as the brand line.** See the copy exception above.

## Verification (planned)

1. `hugo build --gc --minify --printI18nWarnings --panicOnWarning --destination <out>` with
   Hugo 0.168.0: no warnings.
2. `python -I scripts/check_site.py <out> --register <engine register on main>`: every check
   reports a non-zero count and passes; each new check is mutation-tested (plant the fault,
   see it fail, restore from a backup copy).
3. Browser pane, both languages, light and dark, 375 px and desktop: header, menu, theme
   control, search (including "calisir"), FAQ, copy buttons, signup states, back to top,
   progress, 404, keyboard-only pass, reduced motion, print preview; console free of CSP
   violations.
4. Lighthouse before and after, mobile and desktop, Home, How it works, Get started.
5. `/security-review` on the branch; findings fixed or recorded.

## Open items for Mert

- Create the Buttondown account, keep double opt-in on, consider turning off open and click
  tracking (Settings), and send the username; until then the signup box stays hidden.
- Add the `CLAUDE_API_KEY` repository secret to enable the security review workflow, and turn
  on "Require approval for all external contributors" (the Action is not hardened against
  prompt injection in untrusted PRs).
- Review the Turkish copy (ship, fix later still applies).

## Related docs

- `docs/implementations/2026-10-16-superconducted-website.md`: the first version and its
  decisions.
- Engine register: `docs/numerical-claims.md` (NC-018, NC-021, NC-037, NC-045, NC-067..069).
- Brand guide: `SuperconducTED/.github` `brand/README.md`.
- Buttondown embed form: `docs.buttondown.com/building-your-subscriber-base`.
- Security review Action: `github.com/anthropics/claude-code-security-review`.

## As of 2026-10-18, later: built and verified locally

Everything in "What will change" exists on branch `site/redesign`, committed locally and not
pushed. Verification ran on this laptop (Windows 11, Hugo 0.168.0, Chrome, Python 3.12) and is
provisional until CI runs it on the pull request.

### Where the build departed from the plan, and why

| Plan | Built | Why |
| --- | --- | --- |
| Hero mark as a CSS background chosen by a theme token | Two `<img loading="lazy">` (on-light, on-dark), CSS shows one | Simpler and measured to do the same job: a hidden lazy image is never fetched. Lighthouse's network log for Home: `main` downloads both marks (26,662 and 26,669 bytes), the branch only the one on screen (24,794 bytes). |
| Header logo lazy like the other brand images | Header logo `loading="eager"` | Lighthouse found the lazy logo to be the phone Home page's largest paint and flagged it (`lcp-lazy-loaded`). Both logo versions now load at once, about 5 KB each compressed, as on `main`. |
| Theme boot stays an external blocking script | Inline, allowed by its SHA-256 in `script-src` | The external file was a render-blocking round trip. Hugo computes the hash (`fingerprint "sha256"`) and `check_site.py` recomputes it from the built page, so a mismatch fails CI instead of silently blocking the script. |
| Contents list collapsed by script on narrow screens | Closed in the markup, opened by script on wide screens | Collapsing after load shifted the page: Lighthouse measured a layout shift of 0.10 on Get started and How it works. Opening on wide screens moves nothing, because the list has its own column there. |
| `render-link.html` adds `rel="noopener"` | It draws evidence links (NC-, ADR-, PR #, #) as proof chips | No link on the site opens a new tab; the only `target="_blank"` is the sign-up form, which carries `rel="noopener"`, and the checker now fails any that does not. |
| Copy numbers typed into the text | `data/claims.yaml` plus `{claim:KEY}` and the `claim` shortcode | Not in the plan. Typed numbers would go stale when the register moves (CI checks `data/facts.yaml` against the register, not prose), so every register figure in the text is now printed from data that CI checks, with its proof chip. |
| Search script loaded by plain script injection | Loaded through the one Trusted Types policy `sc-loader` | Production enforces Trusted Types, under which a script URL must come from a policy. The policy accepts only `/js/search.min.<sha256>.js`. |

### Copy corrections found while rewriting

- **"Measured again many times a day" was removed.** The old Home and How it works said each
  qubit's T1, T2 and error rates are re-measured many times a day. The site's own data does not
  support that for one qubit: `data/drift.json` holds 138 T1 calibrations of qubit 77 from
  2026-05-08 to 2026-10-15, under one a day. The new text cites the register instead
  (NC-069: 868 distinct device states archived since May 2026).
- **Aims stay aims.** "ANFIS fits it to the archive" became "ANFIS training, now in progress,
  fits it"; the FAQ says the engine "is designed to" describe the spread; the range is "the
  plan". The research-preview notice moved into the hero.
- **Tagline.** "Noise as a range, not a number." stays the brand line (footer, page titles,
  social card) and no longer heads the page; the hero headline is "Put a [range] on your quantum
  noise model." This keeps the brand decision of 2026-10-16 while removing the two-beat
  antithesis from the headline. Mert may still want to revisit the tagline itself.

### Checks

`check_site.py` grew from 10 to 17 checks (aliases, csp, scripts, search, feeds, weight,
release), and the contrast check now covers the raised role and button text on the accent, and
compares the two dark token blocks. That comparison caught a real fault during the build: a CSS
comment quoting the selector text made the regex read the light tokens for both themes, so the
dark-theme contrast check would have checked nothing dark. The regexes now match selectors only
at the start of a line.

Every new check was mutation-tested (`mutate_checks.py`, kept in the session scratchpad): 18
planted faults (a style attribute, an inline handler, `target=_blank` without noopener, a
removed Trusted Types rule, an unhashed inline script, an edited hashed script, `'unsafe-inline'`
in `script-src`, `innerHTML`, `console.log`, a token written to local storage, a wrong search
URL, a broken feed entry, a live-reload script, a claim value that disagrees with the register,
a dark token that differs between blocks, a low-contrast accent, a page over budget, an alias
that is not noindex). All 18 were reported; every file was restored byte for byte from a backup
copy and the baseline passed again.

Production build with the production base URL, checked against the engine register fetched from
`main` on 2026-10-18 (unchanged when re-fetched at the end): all 17 checks pass; 532 links; the
heaviest page is `tr/how-it-works/` at 151,701 bytes with its CSS and JS (budget 400,000 for
math pages).

### Interface checks (headless Chrome, `interact.mjs` in the scratch folder `C:/t-lh`)

At 1440 and 390 px: header hairline after a short scroll; back-to-top hidden at the top, shown
after one screen, returns to the top and focuses `main`; progress bar scales with scroll;
Ctrl+K opens search and "anfis" finds three pages; Escape closes search. At 390 px with touch:
the menu opens, Escape closes it and returns focus to the button; a dark choice survives a
reload; "System" clears the saved choice; no console errors on any run (so the hashed inline
script and the Trusted Types policy both work in Chrome). In the browser pane: Turkish search
for "calisir" finds "Nasıl çalışır" with the hit marked; "/" opens search; a real click on Copy
shows "Kopyalandı" and announces it. Full-page screenshots at 1440 and 390 px, light and dark,
for Home, How it works, Get started, Team, Updates, the first post, Turkish Home and the 404 page
show no horizontal overflow after one fix (wide code blocks widened their grid column on phones;
grid items now have `min-width: 0`).

### Lighthouse (12.8.2, simulated throttling)

Like for like: `main` and this branch, each built with Hugo 0.168.0 and served by the same local
server that mimics GitHub Pages (gzip, `Cache-Control: max-age=600`, `/404.html`). Scores are
performance / accessibility / best practices / SEO.

| Page (phone) | `main` | This branch | FCP, LCP in ms, `main` to branch |
| --- | --- | --- | --- |
| Home | 99 / 100 / 100 / 92 | 99 / 100 / 100 / 100 | 1,356 to 1,357; 1,982 to 1,882 |
| How it works | 95 / 100 / 100 / 92 | 95 / 100 / 100 / 100 | 1,960 to 2,110; 2,558 to 2,635 |
| Get started | 100 / 100 / 93 / 92 | 99 / 100 / 100 / 100 | 1,208 to 1,357; 1,658 to 1,808 |
| Team | 99 / 100 / 100 / 92 | 99 / 100 / 100 / 100 | 1,206 to 1,356; 1,656 to 1,881 |

On desktop both builds score 100 for performance on every page; the branch also scores 100 for
accessibility, best practices and SEO on Home, How it works, Get started, Team and Updates.
Home's total transfer fell from 209,137 to 191,717 bytes (one hero mark instead of two, minified
brand SVGs) while the page gained search, the FAQ and the updates block.

- **SEO 92 to 100:** `main`'s CSP had `connect-src 'none'`, which also stopped Lighthouse from
  reading `robots.txt`; `connect-src 'self'` (needed by search) fixes it.
- **Best practices 93 to 100 on Get started:** `main` logged CSP violations there, because
  default highlighting wrote inline styles that `style-src 'self'` blocks. Highlighting now uses
  classes.
- **Cost:** inner pages paint first about 150 ms later on the phone profile, because the
  stylesheet grew from 3.0 KB to 8.6 KB compressed. Accepted for now; splitting out the CSS for
  search, FAQ and print would recover part of it.
- The first "after" run also showed accessibility 98 on Updates (a sign-up `h3` straight after
  the page's `h1`); the sign-up heading is now an `h2`.

The original "before" run against the live site (same Lighthouse version) agrees: phone
performance 100 / 96 / 98 for Home / How it works / Get started, SEO 92 everywhere.

### Security review

The local `/security-review` (a sub-agent reading the whole diff against `origin/main`) reported
no high or medium findings. It examined the search and site scripts (DOM built with
`textContent` only, URLs from the same-origin index), the Trusted Types loader, the render hooks
(no `safeURL`, so `javascript:` links are still refused), the `safeHTML` uses (literals only),
the CSP template, the sign-up form, the feed and search templates, both workflows
(`pull_request`, same-repository guard, no event data in a shell) and the checker's XML parsing.
With nothing reported, the false-positive filter step had nothing to examine.

The GitHub Action itself (`anthropics/claude-code-security-review` at `0c6a49f`) needed two
adjustments, recorded in the workflow: its default model, `claude-opus-4-1-20250805`, retired on
2026-08-05, so the workflow sets `claude-model: claude-opus-5-5`; and its optional second-stage
API filter probes access with a retired model (`claude-3-5-haiku-20241022`), fails, and switches
itself off. The main Claude Code scan and its pull-request comments still run.

### An unplanned download (reported to Mert)

While re-running the `main` baseline, a backgrounded server command carried the `cd`, so
`npx lighthouse` ran from the engine worktree, found no local Lighthouse and fetched the newest
release, 13.5.0, from the npm registry into the npx cache
(`%LOCALAPPDATA%/npm-cache/_npx/0f94ee7615faf582`, written 2026-10-18 02:12). Mert had approved
12.8.2 in `C:/t-lh` only. Its eight reports were moved out of the engine worktree into
`C:/t-lh/reports/stray-lh13/` and are not used above; the baseline was re-run with the pinned
`C:/t-lh/node_modules/.bin/lighthouse` (12.8.2). The cache entry is left for Mert to keep or
delete.

### Open items for Mert (as of this section)

- Push the branch and open the pull request (not done; needs his word).
- Buttondown: create the account, keep double opt-in on, consider turning off open and click
  tracking, then set `params.newsletter.buttondown` in `hugo.toml`. Until then the "Get
  updates" box offers the Atom feed and GitHub instead of an email form.
- Add the `CLAUDE_API_KEY` repository secret to enable the security review, and keep "Require
  approval for all external contributors" on.
- Review the Turkish copy and the first update post before merge; the post speaks for the team.
- Decide whether the tagline stays (see "Copy corrections").

### Later the same day: gaps closed after review

- **The sign-up form had not run in any check above** (the username is empty, so no build
  rendered it). It was then built once with a placeholder username passed through the
  environment (`HUGO_PARAMS_NEWSLETTER_BUTTONDOWN`, nothing committed) and tested in headless
  Chrome with buttondown.com resolved to a closed local port, so no request could reach
  Buttondown. In both languages: the form renders with the embed action and the newsletter
  script; the CSP reads `form-action https://buttondown.com`; an empty and a malformed address
  each show the translated message with `aria-invalid` and focus on the field; typing clears the
  error; a valid address (with surrounding spaces) is trimmed, the box switches to its done
  state, focus moves to it and the button is disabled; no console errors. Each valid submit
  opened one new tab towards Buttondown, which failed locally as intended.
- **The mutation test is now in the repository** as `scripts/mutate_check_site.py` (it was a
  scratchpad file when the section above was written). Rerun after this change: 18 of 18 faults
  reported, exit 0, every file restored.
- **Search options:** the link is now the listbox option itself (`role="option"` on the `<a>`,
  the list item `role="none"`); before, a link sat inside the option, which ARIA does not allow.
  Lighthouse could not see this because the dialog is closed during an audit.
- **Popover fallback:** in a browser without the Popover API the contact button and menu are
  hidden (the footer has the same two links), instead of the menu rendering as page content.
- **Security workflow:** the action exports `GITHUB_TOKEN: ${{ github.token }}` itself
  (action.yml at `0c6a49f`, lines 181 and 324), so checkout's `persist-credentials: false` does
  not starve it. It also installs `@anthropic-ai/claude-code` from npm without a version pin at
  run time, which pinning the action's commit does not cover.
- After these changes: all 17 checks pass on the production build, and the 19 interface checks
  pass.

### After the pull request opened: search reported broken

Mert reported that search did not work. The browser tab he was looking at held a copy of the
page from before one of the local rebuilds: it asked for `search.min.f41017ee...js`, a
fingerprint the rebuilt site no longer had (404), so the dialog said it could not load. A reload
fixed it. The same thing can happen to a real visitor: GitHub Pages lets browsers keep a page's
HTML for 10 minutes, every deploy replaces all files, and search loads its script only when it
is first opened. Two changes:

- **A missing search script now explains itself.** When the script fails to load, site.js asks
  for it again with a `HEAD` request; a 404 means the page is older than the latest deploy, and
  the dialog says so ("The site was updated after this page loaded...") with a focused "Reload
  the page" button. Any other failure keeps the connection message. Tested in headless Chrome in
  both languages by pointing a page at a fingerprint that is not in the build.
- **The theme switch is instant, as a departure from the plan.** The plan's view-transition
  cross-fade lost clicks: while a transition plays, Chrome does not hit-test the page (clicks
  landed on the root element, even with `pointer-events: none` on `::view-transition`), so a
  second click within about 250 ms was dropped, and skipped transitions left unhandled
  `AbortError` rejections in the console. A test of six quick clicks now ends on the last choice
  with no console errors.

All 17 checks pass on the production build, the mutation test reports 18 of 18, and the 19
interface checks pass.

### Copy reworded around spread (Mert, after a personal research audit)

A personal audit of how Qiskit Aer and the other Qiskit projects use calibration snapshots
(kept outside this repository) found the drift premise well supported but the phrasing "goes
stale at the next calibration" contested for the average: one study on IBM 127-qubit machines
found no significant pooled effect of time since calibration over 24 hours. The supported claim is
about spread: a snapshot model is one point, and it cannot say how far the hardware may be from
it. On Mert's instruction the two lines that used the contested phrasing were rewritten in both
languages:

- **Hero line:** "goes stale as the chip drifts" became "a single draw from a chip whose noise
  keeps moving", and the engine "learns how far that noise spreads across the whole calibration
  history".
- **FAQ, "Isn't rebuilding the model after each calibration enough?":** the answer now says the
  fresh model is a good single estimate that we do not claim is wrong on average, that it cannot
  say how far the hardware may sit from it, and cites IBM's "Monitor, calibrate, and benchmark"
  guide (calibrations triggered when monitoring detects drift) and Carroll et al. 2022, npj
  Quantum Information 8, 132, DOI 10.1038/s41534-022-00643-y (a single routine T1 measurement
  predicts a qubit's long-run mean only weakly). No figure from either source is quoted on the
  site. The answer also states a plan: judge the range by how often it covers repeated hardware
  runs, with the fresh model as the baseline. That is a public commitment to an evaluation method,
  made on Mert's word.

Also fixed: on Turkish pages the chart label upper-cased `ibm_fez` with Turkish rules ("İBM");
the backend name is now marked `lang="en"`.

### Newsletter banner, and a hash bug it exposed (Mert, 2026-10-18)

Mert asked for a working newsletter sign-up and a banner at the top that guides people to it, and
chose a banner on every page that can be closed and stays closed. The sign-up itself was already
built and tested; it is switched on by setting `params.newsletter.buttondown`, which needs the
Buttondown account only Mert can create (he was given the steps: account, username, leave open
and click tracking off, which Buttondown makes opt-in; double opt-in is Buttondown's default and
cannot be turned off for public forms, per its documentation).

- **Banner** (`layouts/_partials/newsletter-banner.html`, rendered above the header only while
  the username is set): the newsletter's name, one line on what it sends, a "Subscribe by email"
  link, and a close button. On Home and the Updates pages the link scrolls to the sign-up box and
  puts the cursor in the email field; elsewhere it opens the Updates page at the box. Closing it
  stores `superconducted-newsletter = dismissed`; a completed sign-up stores `subscribed`;
  `theme-boot.js` reads the key before paint and hides the bar, so it never appears and then
  jumps away. On phones it is one 51 px line (name, "Subscribe", close); the long button text stays
  as the link's accessible name. The footer privacy line now mentions banner choices, and
  `check_site.py` allows the third preference key.
- **Bug found by the test, not by a reader:** extending the inline theme boot changed its
  minified bytes, and the HTML minifier re-minified the inline script (renaming its variables a
  second time), so the page's CSP hash no longer matched and Chrome blocked the script. The
  earlier version had happened to survive the second pass. `check_site.py` would have failed CI
  on it (it recomputes the hash); the headless sign-up test caught it first. Fix: Hugo's JS
  minifier is off (`[minify] disableJS = true`), so the HTML minifier leaves inline scripts byte
  for byte, and every script is minified by Hugo's built-in esbuild instead
  (`layouts/_partials/js.html`, `js.Build` with `minify`, target ES2017). Script sizes are about
  what they were (site.js 7,988 bytes, search.js 4,786).
- **Tests** (headless Chrome, placeholder username passed through the environment, buttondown.com
  resolved to a closed local port): banner shown on six page types in both languages; the Home
  link focuses the email field in view; the Turkish Team link opens `/tr/updates/#get-updates`;
  close hides it, stores `dismissed`, and it stays hidden from first paint on the next page; a
  sign-up stores `subscribed` and hides it; no overflow at 390 px; no console errors. The sign-up
  checks (both languages) and the 19 interface checks pass; all 17 site checks pass on the
  production build, where the banner is absent until the username is set; the mutation test
  reports 18 of 18 after one mutation was retargeted at a string literal that esbuild keeps.

Still owed: Mert's Buttondown username. Until it is set, production shows neither the form nor
the banner.

### The banner became a pop-up (Mert, same day)

Before the bar was pushed, Mert asked for it to work like a cookie-policy banner, in a pop-up
style. The bar was replaced, in the same pull request, by a floating card
(`layouts/_partials/newsletter-popup.html`): bottom left at up to 24rem wide on wide screens,
clear of the floating buttons; a bottom sheet with 12 px margins on phones, where the floating
buttons step aside while it is open (`:has()`). It slides in 1.2 s after load (invisible and
unfocusable until then; immediately under reduced motion), never takes focus by itself, and sits
early in the document so keyboard users meet it first. It carries its own Buttondown form, so a
visitor subscribes without leaving the page; `newsletter.js` (now loaded once per page from
`baseof.html`, since a second load would wire every form twice) validates it like the box and
shows the done state inside the card until it is closed. "No thanks", the close button and Escape
store `dismissed`; a sign-up stores `subscribed`, and a sign-up through the page's box closes the
card too (a `superconducted:subscribed` event). The footer privacy line now says pop-up choices.

Three layout bugs were found by the tests and screenshots, all CSS specificity: `.signup`
(later in the file) overrode the card's `position: fixed`, so it sat in the page flow; `.signup >
*` gave the close button `position: relative`; and the full-width label line painted over the
close button, swallowing its clicks. The email field's intrinsic minimum width also pushed the
button to its own line. All fixed (two-class selectors, `z-index`, `min-width: 0`).

Tests (headless Chrome, placeholder username, buttondown.com resolved to a closed local port):
19 pop-up checks (hidden during the delay then shown; on seven page types in both languages;
bottom left with no overlap; "No thanks", close and Escape each hide it and remember; validation
inside it; done state inside it; a box sign-up closes it; 390 px bottom sheet of 301 px with the
floating buttons hidden and restored; no console errors), the 15 sign-up box checks (now scoped
to the box, since a page has two forms), 19 interface checks, the stale-page checks, 17 of 17 site
checks on both the production build and the placeholder build, and 18 of 18 mutations.

### Newsletter switched on (Mert, same day)

Mert created the Buttondown newsletter at https://buttondown.com/superconducted and sent the
link. Checked before switching on, by a plain GET of the public page only (no address was
submitted): HTTP 200, title "SuperconducTED • Buttondown", and Buttondown's own page posts to
`embed-subscribe/superconducted`, the endpoint our forms use. `params.newsletter.buttondown` is
now `superconducted`, so production renders the sign-up box (Home and the Updates pages), the
pop-up invitation on every page, and `form-action https://buttondown.com` in the CSP.

Verification with the real username (laptop, provisional; buttondown.com resolved to a closed
local port in every browser test, so no address could reach the list): 17 of 17 site checks on
the production build (547 links), 18 of 18 mutations, 19 pop-up checks and 15 sign-up box checks
in both languages, and Lighthouse 12.8.2 unchanged by the pop-up (desktop Home and How it works
100 / 100 / 100 / 100; phone Home 99 and How it works 94 for performance, 100 for the other three;
layout shift at most 0.002).

Not done here, by design: a real subscription. The first real test is Mert's own address after
merge (or from a local build), which also checks Buttondown's confirmation email. Open and click
tracking stay off unless Mert turns them on in Buttondown; the footer's "no tracking" line covers
this site, not Buttondown.
