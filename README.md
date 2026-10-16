# superconducted.github.io

The website of SuperconducTED, a student research project building a fuzzy-logic noise engine
for Qiskit Aer: <https://superconducted.github.io/>, in English (`/en/`) and Turkish (`/tr/`).

The site is built with [Hugo](https://gohugo.io/) 0.167.0 and deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main`. Pull requests are built and checked but
not deployed.

## Preview locally

Download Hugo 0.167.0 (the standard edition is enough) from
<https://github.com/gohugoio/hugo/releases/tag/v0.167.0>, then from this folder:

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

`check_site.py` checks that every English page has a Turkish twin, that links resolve, that the
colour tokens meet WCAG contrast, that every fact cites a register row whose value matches, and
more; its docstring lists every check. The workflow runs the same three steps.

## Where things live

| Path | What it is |
| --- | --- |
| `content/en/`, `content/tr/` | The pages, one file per page per language; same file name = translations of each other. |
| `i18n/en.yaml`, `i18n/tr.yaml` | Every interface string. Keys must match; `check_site.py` flags a Turkish string left in English. |
| `data/facts.yaml` | The Home page facts. Values are copied from the engine's numerical-claims register, never computed here. |
| `data/team.yaml` | The Team page. Source: the engine's `docs/team.md`. |
| `data/drift.json` | The Home page demo, written by `scripts/extract_drift.py` from the engine's calibration archive at a pinned commit. |
| `data/brand.yaml` | Which brand-kit files are in `static/`, from which commit, with their SHA-256. |
| `layouts/` | Hugo templates (the v0.146+ layout: `baseof.html`, `home.html`, `page.html`, `_partials/`, `_markup/`). |
| `assets/css/site.css`, `assets/js/` | Styles (Cryostat colour tokens) and the three small scripts: theme boot, theme toggle, demo chart. |
| `static/` | Brand files, fonts, KaTeX's stylesheet and fonts. See `NOTICE` for their licences. |
| `scripts/` | `extract_drift.py`, `sync_brand.py`, `build_fonts.py`, `check_site.py`. |
| `docs/implementations/` | Records of each change: plan, decisions, verification. |

## Updating

- **A fact changed in the register:** edit `data/facts.yaml` (value, `nc`, `as_of`). CI fails while
  a fact disagrees with the register on the engine's `main`.
- **New demo data:** `python -I scripts/extract_drift.py --repo <engine clone> --ref <calibration-data commit>`.
- **The brand kit changed:** `python -I scripts/sync_brand.py <.github clone> <commit>`.
- **Text:** edit both languages in the same pull request.

## Licence

Code under the MIT License (`LICENSE`); page text under CC BY 4.0; brand files, fonts and KaTeX
under their own terms. `NOTICE` lists which is which.
