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
