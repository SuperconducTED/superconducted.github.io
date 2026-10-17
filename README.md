# superconducted.github.io

The website of SuperconducTED, a student research project building a fuzzy-logic noise engine
for Qiskit Aer: <https://superconducted.github.io/>, in English (`/en/`) and Turkish (`/tr/`).

The site is built with [Hugo](https://gohugo.io/) 0.168.0 and deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main`. Pull requests are built and checked but
not deployed. It is fully static: no server code, no database, no cookies, no analytics.

## Preview locally

Download Hugo 0.168.0 (the standard edition is enough) from
<https://github.com/gohugoio/hugo/releases/tag/v0.168.0>, then from this folder:

```bash
hugo server
```

and open <http://localhost:1313/>. The development server also shows facts whose register rows
are still pending, marked as such; production builds leave them out.

## Check a production build

```bash
hugo build --gc --minify --printI18nWarnings --panicOnWarning
cp public/en/404.html public/404.html
python -I scripts/check_site.py public --register <path to the engine's docs/numerical-claims.md>
```

`check_site.py` runs 17 checks: Turkish twins, links, contrast in both themes, every figure
against the register, the Content Security Policy of every page (including the hash of the
inline theme script), unsafe DOM calls in the scripts, the search index, the Atom feeds, a
weight budget per page, and more; its docstring lists them all. The workflow runs the same
three steps.

To click through a production build in a browser, build it for a local address (otherwise the
pages point their fonts and icons at the live site, and their CSP blocks that) and serve the
folder with any static server:

```bash
hugo build --gc --minify --baseURL http://127.0.0.1:8137/ --destination ../site-out
```

## Where things live

| Path | What it is |
| --- | --- |
| `content/en/`, `content/tr/` | The pages, one file per page per language; same file name = translations of each other. Home's copy is in the front matter of `_index.md`. |
| `content/*/updates/` | The Updates section: one file per post per language. |
| `archetypes/updates.md` | The template `hugo new` uses for a post. |
| `i18n/en.yaml`, `i18n/tr.yaml` | Every interface string. Keys must match; `check_site.py` flags a Turkish string left in English. |
| `data/facts.yaml` | The Home page facts strip. Values are copied from the engine's numerical-claims register, never computed here. |
| `data/claims.yaml` | Register figures used inside page text (same rules as the facts). |
| `data/team.yaml` | The Team page. Source: the engine's `docs/team.md`. |
| `data/drift.json` | The Home page chart, written by `scripts/extract_drift.py` from the engine's calibration archive at a pinned commit. |
| `data/brand.yaml` | Which brand-kit files are in `static/`, from which commit, with their SHA-256. |
| `layouts/` | Hugo templates (the v0.146+ layout: `baseof.html`, `home.html`, `page.html`, `updates/`, `_partials/`, `_markup/`, `_shortcodes/`). `home.searchindex.json` writes each language's search index. |
| `assets/css/site.css` | Styles on the Cryostat colour tokens, including print styles. |
| `assets/js/` | `theme-boot.js` (inline, before paint), `site.js` (every page), `search.js` (loaded on the first search), `newsletter.js` (sign-up pages only), `drift-demo.js` (Home). |
| `static/` | Brand files, fonts, KaTeX's stylesheet and fonts. See `NOTICE` for their licences. |
| `scripts/` | `extract_drift.py`, `sync_brand.py`, `build_fonts.py`, `check_site.py`. |
| `docs/implementations/` | Records of each change: plan, decisions, verification. |

## Updating

- **A fact changed in the register:** edit `data/facts.yaml` or `data/claims.yaml` (value, `nc`,
  `as_of`). CI fails while a value disagrees with the register on the engine's `main`.
- **A number in the text:** never type a register figure. Use `{claim:KEY}` in front matter or
  `{{% claim "KEY" %}}` in Markdown; it prints the value in the page's number format with its
  register row as a proof chip, and an unknown key fails the build.
- **New demo data:** `python -I scripts/extract_drift.py --repo <engine clone> --ref <calibration-data commit>`.
- **The brand kit changed:** `python -I scripts/sync_brand.py <.github clone> <commit>`.
- **Text:** edit both languages in the same pull request.

### Writing an update

```bash
hugo new content content/en/updates/2026-11-02-short-slug.md
```

Write the post, copy it to `content/tr/updates/` under the same file name and translate it, and
remove `draft: true` from both. The post then appears on the Updates page, in the latest three on
Home, in each language's Atom feed (`/en/updates/atom.xml`, `/tr/updates/atom.xml`) and in
search, all from the one pull request. A post dated in the future (UTC) is held back until that
date.

### Newsletter

The "Get updates" box posts to [Buttondown](https://buttondown.com/) when
`params.newsletter.buttondown` in `hugo.toml` holds the Buttondown username; while it is empty,
the box offers the Atom feed and GitHub instead and the CSP allows no form at all. Buttondown
confirms every address by email (double opt-in) before subscribing it. No secret is involved:
the form needs only the public username. Buttondown's RSS-to-email automation (a paid feature)
reads Atom feeds too, so with it a new post reaches subscribers without a manual send; each entry's
Atom `id` is its permanent URL, which Buttondown uses to avoid sending a post twice.

## Security

- Every page carries a strict CSP: scripts only from this site (plus the hash of the inline
  theme script), no inline styles except KaTeX on math pages, requests only to this site, and
  Trusted Types in production, so no script can turn a string into HTML.
- Actions are pinned to commit SHAs and Hugo to a version and checksum; `.github/dependabot.yml`
  proposes Action updates weekly. Upgrading Hugo is manual: check that its embedded KaTeX version
  still matches `static/katex/`.
- `.github/workflows/security-review.yml` runs
  [Claude Code security review](https://github.com/anthropics/claude-code-security-review) on
  pull requests from this repository once an owner adds the `CLAUDE_API_KEY` secret. Keep
  "Require approval for all external contributors" on: the action is not hardened against prompt
  injection in untrusted pull requests.
- Report a vulnerability privately through the organisation's security policy, not in an issue.

## Licence

Code under the MIT License (`LICENSE`); page text under CC BY 4.0; brand files, fonts and KaTeX
under their own terms. `NOTICE` lists which is which.
