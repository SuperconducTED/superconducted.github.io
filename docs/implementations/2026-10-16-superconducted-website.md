# 2026-10-16: superconducted-website

Status: **plan, for review before any site code is written.** Sections marked "planned" become
"done" in an as-of section appended after the build; the plan rows themselves are not edited.

## Problem / Motivation

SuperconducTED has a finished identity (brand guide in `SuperconducTED/.github/brand`, merged in
PR #1 and PR #2) but no website. The repos' homepage fields are blank, waiting for one. Mert
decided on 2026-10-16 that, for budget reasons, a free GitHub Pages site is enough for now; a
custom domain (`superconducted.dev` was the researched favourite) can be attached later without
moving the site.

The site must serve four audiences at once: researchers and users of the engine, academic
reviewers (Dr. Akba and TED University committees), recruiters and the public, and prospective
contributors. It must stay honest about the research-preview state: aims are stated as aims, and
every number on it traces to the engine's numerical-claims register.

## Decisions taken (Mert, 2026-10-16, through five rounds of questions)

| Question | Answer |
| --- | --- |
| Placement | Org site: new repo `SuperconducTED/superconducted.github.io`, served at `https://superconducted.github.io/`. Mert creates the empty repo. |
| Audience | All four: researchers and users, academic reviewers, recruiters and public, contributors. |
| Scope | Home plus a few pages: **How it works**, **Team**, **Get started**. (No status page in v1.) |
| Languages | English and Turkish, URLs `/en/` and `/tr/`; the root page picks one from the browser's language. |
| Generator | Hugo (chosen after a stack comparison, see Design decisions). |
| How it works depth | Plain language first, then a clearly marked section with the key equations. |
| Team page | Name, role, GitHub link. Dr. Fırat Akba listed as faculty advisor (no link; he has no GitHub account). Yiğit is not listed (he has left the team; his work stays credited in git history). |
| Home page | Tagline and mark, a drift-to-range demo drawn from **real archive data**, "the problem in 3 steps", a project-facts strip, and a research-preview notice. |
| Facts | 156 qubits followed; progress toward the 1,170-state training floor; test-suite size; snapshots archived. Each cites its register row and an "as of" date. |
| Theme | Cryostat light or dark from the system setting, with a toggle that remembers the choice. |
| Turkish sign-off | Ship, fix later: the Turkish is reviewed after launch through follow-up PRs. |
| Analytics and contact | No analytics, no cookies, no email address on the page; contact through GitHub (engine issues and Discussions). |
| Tagline on Turkish pages | Stays in English as the brand line ("Noise as a range, not a number."); the Turkish text explains it. |
| Bengisu on the Team page | Full name, Bengisu Cıvdı. |
| Licence | MIT for code (layouts, scripts, CSS, JS); CC BY 4.0 for page text. The mark and name keep the brand's own terms. |
| Plan and downloads | Approved: Hugo 0.167.0 (`hugo_0.167.0_windows-amd64.zip`, 22.2 MB) and the pip packages fonttools and brotli in a scratch folder. |

## What will change (planned)

All paths are in the new repo `SuperconducTED/superconducted.github.io` unless stated otherwise.

| File | One-sentence description |
| --- | --- |
| `hugo.toml` | Site config: `baseURL`, two languages (`en` weight 1, `tr` weight 2), `defaultContentLanguageInSubdir = true`, menus, MathML math, no taxonomies. |
| `content/en/_index.md`, `content/tr/_index.md` | Home page text in each language. |
| `content/{en,tr}/how-it-works.md` | The method: drift, the frozen snapshot, the fuzzy layer, the range; then the key equations. |
| `content/{en,tr}/team.md` | Front matter only; the people come from `data/team.yaml`. |
| `content/{en,tr}/get-started.md` | Install, run the tests, poll calibrations, contribute. |
| `i18n/en.yaml`, `i18n/tr.yaml` | Every interface string (menu, switcher, footer, demo labels, notices). |
| `data/team.yaml` | People, roles and GitHub handles, each with its source (`docs/team.md` in the engine). |
| `data/facts.yaml` | The four facts: value, label key, register id, as-of date, source link. |
| `data/drift.json` | The demo series extracted from the calibration archive at a pinned ref. |
| `layouts/_default/baseof.html` and partials | Shared layout: head (meta, Open Graph, hreflang), header, language switcher, theme toggle, footer. |
| `layouts/index.html` | Home layout: hero, demo, three steps, facts, notice. |
| `layouts/_default/_markup/render-passthrough.html` | Renders `$$...$$` and `\(...\)` to MathML at build time with `transform.ToMath`. |
| `layouts/alias.html` | The root page: picks `/tr/` or `/en/` from `navigator.languages`, with visible links to both for no-script visitors. |
| `layouts/404.html` | A bilingual not-found page. |
| `assets/css/site.css` | Cryostat tokens (light and dark), Space Grotesk and Space Mono, layout, print styles. |
| `assets/js/theme.js`, `assets/js/drift-demo.js` | Theme toggle; the demo drawn as SVG from `data/drift.json`. |
| `static/fonts/` | Space Grotesk and Space Mono as WOFF2, subset to Latin plus Latin Extended-A (Turkish), with the OFL text. |
| `static/` icons and social card | Favicons, app icons and `social-card-noise-engine.png` copied byte-for-byte from the brand kit at `.github` `c70c9a9`. |
| `scripts/extract_drift.py` | Standard-library script that writes `data/drift.json` from an engine checkout at a given `calibration-data` ref. |
| `scripts/sync_brand.py` | Copies the brand files listed above and records the source commit. |
| `scripts/check_site.py` | Checks the built site: every EN page has a TR twin, no untranslated strings, links resolve, every fact cites a register id, no em dashes. |
| `.github/workflows/hugo.yml` | Builds with Hugo 0.167.0 (pinned) and deploys with `actions/upload-pages-artifact` and `actions/deploy-pages`. |
| `README.md`, `LICENSE`, `.gitignore` | How to build and preview; licence (see open items). |
| `docs/implementations/2026-10-16-superconducted-website.md` | This record. |

In the **engine** repo, one small separate PR (asked for separately): two new rows in
`docs/numerical-claims.md` for the fresh counts the facts strip needs (snapshot files in the
archive; distinct device states against the NC-012 floor), measured at one pinned
`calibration-data` commit with the existing scripts. The ids are chosen when that PR is made,
after checking every open PR: PR #113 was asked to renumber its six rows into NC-061 onward, so
the next free ids are not simply NC-061 and NC-062.

## Implementation approach (planned)

1. **Hugo multilingual mode.** Content by directory (`content/en`, `content/tr`); pages with the
   same relative path are linked as translations, so the switcher and `hreflang` tags come from
   `.Translations` with no hand-kept map. Interface strings live in `i18n/*.yaml`;
   `hugo --printI18nWarnings` lists any string missing in Turkish, and `check_site.py` fails on
   it.
2. **Root language pick.** With `defaultContentLanguageInSubdir`, Hugo writes the root page
   through the alias template. The custom `layouts/alias.html` runs a few lines of script: if the
   visitor's first matching language is Turkish it goes to `/tr/`, otherwise `/en/`, with
   `location.replace` so the root page does not enter the history. A choice made with the
   switcher is remembered (local storage, wrapped in try/catch) and wins over the browser
   language. Without script the page shows both links.
3. **Brand.** Colours are the Cryostat roles from `brand/figures/roles.json` and the guide;
   the accent marks only range elements, as in the mark (the one colour rule). Type is Space
   Grotesk for text and Space Mono for code and figures. Icons, favicon and social card are the
   kit's files, not redrawn.
4. **Math.** `transform.ToMath` renders LaTeX to MathML at build time (Hugo embeds KaTeX), so
   readers download no math script and no math CSS.
5. **Demo.** A small vanilla-JavaScript SVG chart (no library) reads `data/drift.json`, which
   Hugo inlines into the page. It respects `prefers-reduced-motion` (static frame, no animation)
   and has a text description for screen readers.
6. **Deploy.** The org site is published by GitHub Actions: `hugo.yml` runs on pushes to `main`,
   downloads the pinned Hugo release, builds with `--minify` and the base URL from
   `actions/configure-pages`, and deploys. Mert switches Settings, Pages, Source to "GitHub
   Actions" once (a settings write only he makes).
7. **Local preview.** Hugo's own server (`hugo server`) from the repo folder, shown in the app's
   browser pane through a `.claude/launch.json` entry.

## Mathematical / Statistical details

**Demo series.** For the chosen qubit q, let T1_q(d) be the T1 value in archive document d at the
pinned `calibration-data` ref. Documents that repeat the previous device state (same
`qubit_digest` in `health/state-index.tsv`) are dropped, so each point is one distinct
calibration, dated by its `last_update_date`.

**Which qubit.** Not hand-picked. For each qubit with a T1 value in at least 90% of the distinct
states, compute the coefficient of variation CV_q = s_q / m_q (sample standard deviation over
mean). The demo uses the qubit whose CV is the median of those values (ties broken by the lower
qubit index): a typical amount of drift, neither the calmest nor the wildest qubit. The rule, the
ref and the chosen index are written into `data/drift.json`.

**The frozen value.** A horizontal line at T1_q(d_0), the value a `from_backend` snapshot taken at
the first displayed point d_0 would keep using; the gap between it and the later points is the
drift the engine exists for.

**The range.** Drawn as an illustration and labelled as one: at each point, the band spans the
10th to 90th percentile of the qubit's own T1 values over the previous 7 days (linear
interpolation between order statistics; windows with fewer than 5 values are not banded). It is
not the engine's output: the trained engine is not finished (research preview), and the label
says so.

**Facts.** Values are copied from register rows, never computed in the site. "Progress" is
shown as "N of 1,170", where 1,170 is NC-045's floor (234 trainable parameters times 5) and N is
the new row's measured count of distinct device states. The pipeline's projected completion
date is not shown: ADR-025's amendment makes projections non-registrable.

## Design decisions

- **Hugo over the alternatives** (research of 2026-10-16): Hugo 0.168.0 (13 Oct) has
  multilingual linking, i18n tables and untranslated-string warnings in its core, ships as one
  binary (about 22 MB) that can be pinned identically here and on the runner, and has no npm
  dependency tree to keep current. Astro 7.4.0 (15 Oct) has good i18n routing and components but
  an npm tree and a yearly major release. A hand-rolled Python generator would mean writing the
  bilingual plumbing ourselves. GitHub's built-in Jekyll is still 3.10.0 and blocks multilingual
  plugins; Material for MkDocs reaches end of life on 5 Nov 2026 and its successor Zensical is
  pre-1.0 (0.0.70).
- **Pinned to Hugo 0.167.0, not 0.168.0**: 0.168.0 is three days old; 0.167.0 (28 Sep) has had
  more than two weeks of use. Standard edition: no Sass, so the extended edition is not needed.
- **Org site over a project site**: the shortest URL, and a later custom domain attaches in one
  place. The engine's `docs/` folder holds records, so it could not be the site root.
- **Actions deploy over "deploy from branch"**: Hugo output is built, not committed, so the
  repo holds only sources and every change is a reviewable PR.
- **Real data with an illustrative band** over a synthetic curve: it shows real hardware drift
  and stays honest about what the engine does today.
- **Facts from the register only**: the README's "at least 630 records" is already stale (the
  floor became 1,170 on 2026-09-09), which is why no number is copied from prose.
- **MathML over client-side KaTeX or MathJax**: no script, no CSS, works in every current browser.
- **No analytics**: no cookie banner, nothing to disclose.

## Verification (planned)

- `hugo --gc --minify --printI18nWarnings --panicOnWarning` builds with no warnings.
- `python -I scripts/check_site.py public` passes: every EN page has a TR twin and vice versa,
  internal links resolve, every fact cites a register id and an as-of date, no em dashes in text.
- `python -I scripts/extract_drift.py --repo <engine checkout> --ref <sha>` reproduces
  `data/drift.json` byte for byte.
- In the browser pane: both languages, the root pick (Turkish and English browser languages),
  the switcher, light and dark, the toggle, the demo with reduced motion on and off, phone width
  (375 px) with no horizontal scroll, keyboard-only navigation.
- After deploy: `https://superconducted.github.io/` serves, `/en/` and `/tr/` render, the social
  card shows in a link preview.

## Open items for Mert

- Create the empty public repo `SuperconducTED/superconducted.github.io`, then set Settings,
  Pages, Source to "GitHub Actions".
- Approve the engine register PR when it is ready (separate ask).
- After launch: set the homepage field of the engine and `.github` repos to the site URL (a
  settings write).

## Related docs

- Brand guide: `SuperconducTED/.github` `brand/README.md`; construction mathematics in
  `brand/CONSTRUCTION.md` (PR #4, open).
- Engine register: `docs/numerical-claims.md` (NC-012, NC-014, NC-021, NC-038, NC-043, NC-045).
- Engine architecture: `docs/architecture.md`; ADR ledger `docs/decisions.md` (ADR-025 on
  projections).
- Team roster: engine `docs/team.md` (still lists Yiğit as of 2026-10-16).

## As of 2026-10-16, later: built and verified locally

Everything in "What will change" exists in this repository, uncommitted until Mert creates the
GitHub repo and says to push. The workflow file is `.github/workflows/pages.yml` (the plan said
`hugo.yml`). Not yet done: the GitHub repo, the Pages setting, the deploy, and the engine PR.

### Where the build departed from the plan, and why

| Plan | Built | Why |
| --- | --- | --- |
| Math as MathML only, no CSS | KaTeX HTML plus MathML, built at build time; `static/katex/` (KaTeX 0.18.4 stylesheet, 20 WOFF2 fonts, MIT licence, 336 KB) loaded only on pages with `math: true` | In the browser pane, MathML set in Space Grotesk (no OpenType MATH table) did not stretch delimiters or brackets; with the system math font, `∏` limits and matrix brackets were still wrong and ℝ was not double-struck. KaTeX's HTML is identical in every browser. Still no script: Hugo's embedded KaTeX typesets at build time. The version matches the one Hugo 0.167.0 embeds (`internal/warpc/js/package.json`); the npm tarball's sha512 matched the registry's integrity value. |
| CSP `style-src 'self'` everywhere | `'self' 'unsafe-inline'` on the two How it works pages only | KaTeX positions glyphs with inline `style` attributes. Other pages keep `'self'`. |
| One demo point per distinct state, dated by `last_update_date` | One point per distinct T1 **measurement**, dated by the T1 record's own `date` | A new device state often changes readout errors while T1 is unchanged; dating by document would repeat T1 values. Each point is now one real T1 calibration of qubit 77 (138 points, 2026-05-08 to 2026-10-15). The qubit rule is unchanged: lower median CV (0.2644) of 156 eligible qubits. |
| Facts: "156 qubits" cites NC-014 and NC-038 | New row proposed (NC-067) | 156 appears only inside those rows' notes; NC-014's value is a missingness rate. |
| Register ids "chosen at PR time" | NC-067, NC-068, NC-069 | NC-061 is next free on `main`, but PR #113 was asked on 2026-10-13 to renumber its six rows from NC-061. `scripts/check_ids.py` treats gaps as legal. |
| Team "owns" as roster text | File paths only | "CI and pyproject" and "the decision record" would show in English on the Turkish page. `docs/decisions.md` dropped from Mert's list: the module table names Dr. Akba primary owner and Mert secondary. |
| `layouts/_default/...`, `layouts/index.html` | `layouts/baseof.html`, `home.html`, `page.html`, `_partials/`, `_markup/` | Hugo 0.146 replaced the `_default` layout; the new names are the ones 0.167 documents. |
| (not planned) | `.gitattributes`: `* text=auto eol=lf`, PNG and WOFF2 binary | With `core.autocrlf=true` (Mert's machine), a checkout would rewrite the brand SVGs and `data/drift.json` to CRLF, and the byte-hash checks in `check_site.py` would fail on Windows while passing on CI. |
| (not planned) | `public/en/404.html` copied to `/404.html` in the workflow | GitHub Pages serves only a root `404.html`; Hugo writes one per language. |

### Measured values (all at `calibration-data` @ `d62f2cdcd4bfcc6ccf2a250a150ab3bf982fe854`)

- 2,050 snapshot files; 868 distinct `qubit_digest` values in `health/state-index.tsv`;
  `target.num_qubits` = `configuration.n_qubits` = `len(properties.qubits)` = 156.
- Cross-check: `health/metrics.json` reports 308 states short of 1,170 (862); cutting the index at
  that file's `index_head` (`20261016T062913000000Z.json`) also gives 862.
- 52 of the 868 distinct-state documents (filed since 2026-10-13) were missing from the partial
  clone and were fetched by git's lazy fetch, about one minute.

### Verification run

- `hugo build --gc --minify --printI18nWarnings --panicOnWarning`: no warnings (two Hugo 0.156
  deprecations, `.Site.Data` and `.Site.Languages`, were caught this way and replaced with
  `hugo.Data` and `hugo.Sites`).
- `scripts/check_site.py public --register <engine main register>`: 10 checks, all ok, each with a
  non-zero count (10 pages, 249 links, 51 strings, 4 facts, 12 brand files, 138 points, 16
  contrast pairs, 45 dash scans, 2 root files).
- Mutation test (`C:\t-site\mutate_check.py`, kept outside the repo): one planted defect per check
  in a fresh copy; all 10 caught, and each clean copy passed before mutation.
- With the three facts un-pended and the engine branch's register: all checks ok, so the values
  match NC-067 to NC-069 exactly.
- `scripts/extract_drift.py` run twice at the same ref: byte-identical output (sha256
  `7fe0236c...`).
- Browser pane, dev server and production build: English and Turkish; root pick (`en-US` to
  `/en/`; a saved Turkish choice to `/tr/`); theme toggle (ground, saved choice, `aria-pressed`,
  logo swap); 375 px width with no horizontal scroll (scroll width 375); demo animation and
  Turkish month labels; production console empty; only the 7 KaTeX fonts in use load; keyboard:
  the skip link takes first focus with a visible outline, then home, the three menu items,
  language, theme toggle and the hero buttons, in that order.
- Not exercised: `prefers-reduced-motion` (the pane cannot emulate it), print styles, and the
  social card in a real link preview (needs the live URL). The Turkish text is Claude's draft,
  shipped on Mert's "fix later".
- Hugo 0.167.0 download checked against the release's `checksums.txt`; the workflow pins the
  Linux tarball's sha256 and every action by commit SHA.
