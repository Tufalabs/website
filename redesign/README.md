# The Tufa Labs website, redesigned

The redesign of tufalabs.ai. Until it replaces the current site it is served, unlisted and kept out of search engines, at
**[tufalabs.ai/v2-9dcd86d1/](https://tufalabs.ai/v2-9dcd86d1/)**. When it becomes the site, this file becomes the
repository's README.

The content is the live site's own: the redesign changes how the pages look and move, not what they say. Its design rules
(colour, type, grid, motion, the logo and the animated creature) come from the identity repository,
[Tufalabs/identity](https://github.com/Tufalabs/identity), and are never edited here.

## How it fits together

```
Tufalabs/identity  ──(a tagged version, copied in)──►  redesign/vendor/identity/
                                                               │
site/ (Jekyll: the content) ──► tufalabs.ai ──(mirror)──► redesign/live/ ──► build.py ──► out/ ──► deploy.py ──► site/v2-9dcd86d1/
                                                                                                                       │
                                                                       push to main ──► GitHub Actions (Pages deploy) ─┘──► tufalabs.ai/v2-9dcd86d1/
```

| Path | What it is |
|---|---|
| `vendor/identity/` | the pinned identity release: `css/tokens.css` (colours, type, grid, motion), `css/base.css`, `css/motion.css`, `js/creature.js`, the mark; `VERSION` says which release |
| `themes/system.css` | the website's own styles, on top of the identity's (layout of its pages, header, menu, sections, figures) |
| `themes/site.js`, `router.js`, `sections.js`, `hero.js`, `figures.js` | page behaviour: header and menu, page transitions (swup), the section index, the home figure, the research figures |
| `themes/vendor/` | swup and its plugins (MIT), pinned copies |
| `live/` | the live site's pages, mirrored (the content) |
| `build.py` | `live/` → `out/`: each page with the redesign's head, styles and scripts (a local preview, with theme switcher) |
| `deploy.py` | `out/` → the deployable site: `--base /v2-9dcd86d1/` writes it into `../site/v2-9dcd86d1/`; minifies, adds `noindex` |
| `identity/page.py`, `identity.html` | the identity page of the site |
| `tools/` | `sync_identity.py` (pin an identity release), `site_assets.py` (the identity's icons and colours into the live site), `og.py` + `ogcards.js` (the link-preview cards, in a headless browser), `mirror.py` (refresh `live/`), `serve.py` (a no-cache preview server), `prerender.py` (layout written into the HTML at build time), test pages |
| `themes/t0-technical.css`, `themes/_*.css`, `themes/archive/` | earlier design rounds, kept for comparison in the preview |

`out/`, `dist/` and `share/` are build outputs and not committed.

## Everyday tasks

### Preview locally

```sh
python3 build.py
python3 tools/serve.py 8765 out        # http://localhost:8765/system/  (the redesign; /current/ is the old design)
```

Or the deployable build, exactly as it will be served:

```sh
python3 build.py && python3 deploy.py --base /v2-9dcd86d1/
python3 tools/serve.py 8791 ../site    # http://localhost:8791/v2-9dcd86d1/
```

### Deploy

```sh
python3 build.py && python3 deploy.py --base /v2-9dcd86d1/
git add site/v2-9dcd86d1 redesign && git commit -m "v2 preview: …" && git push
```

Pushing to `main` runs the `Pages deploy` workflow (`.github/workflows/pages-deploy.yml`): it takes the identity's icons
and colours into the live site, draws the link-preview cards, builds the Jekyll site (the redesign folder included) and
publishes it. It takes about a minute; the site caches pages for up to 10 minutes.

### Pull requests

Every pull request is built like main and published at `tufalabs.ai/pr-preview/pr-<n>/` (kept out of search engines);
a comment on the pull request links there and follows each push, and the preview is removed when the pull request
closes. main is published from the `gh-pages` branch's root.

### Change content (a post, a team member, a page)

Content lives in the Jekyll site (`site/`, see the repository README). The redesign reads the *published* pages, so:

1. change `site/`, push, wait for the deploy;
2. `python3 tools/mirror.py` (refreshes `live/` from tufalabs.ai);
3. build and deploy as above.

### Change a colour, the type, the grid or the motion

These are the identity's, not the website's. Change them there; the website follows when it takes the new release.

1. In the identity repo: edit `css/tokens.css`, run `make` and check the docs (`docs/index.html`). Every logo, banner,
   template and the docs regenerate from it.
2. Release it: bump `VERSION`, `git tag v0.3.0`, `git push origin main --tags`. The identity's CI rebuilds and
   publishes its docs.
3. Here: take the release, then build and deploy as above.

   ```sh
   python3 tools/sync_identity.py v0.3.0
   python3 tools/site_assets.py
   ```

While working on both at once, `python3 tools/sync_identity.py work` takes the identity repo's working tree instead
of a tag (the default location is `../../tufa-identity`; give another as a second argument). Never edit
`vendor/identity/` by hand: the next sync replaces it.

The website pins a release on purpose: a change in the identity reaches the website only when someone takes it, builds,
looks, and deploys.

What follows by itself once the release is taken: every colour and face on the pages, the page ground before the
styles load and the phone browser's bar colour (`theme-color`, also in the live site through `site/_data/identity.json`),
the icons (`site/favicon.*`, `site/assets/icons/`), and the link-preview cards (`site/assets/og/`). CI makes the last
two on every deploy (`tools/site_assets.py`, then `tools/og.py` in a headless Chrome); to see them before pushing, run
the same locally (`og.py` needs Chrome or Chromium; `--serve` lets any browser draw them).

A face is changed the same way: in the identity (its `fonts/fonts.json` and `css/tokens.css`), then taken here.

Only the creature GIFs stay manual (`make animations` in the identity repo: recording needs a browser, and they are
committed there).

### Change how the site looks or moves

Edit `themes/system.css` (layout and the site's own components) or the scripts in `themes/`, preview, deploy. Lengths,
sizes, colours and durations come from the identity's tokens (`var(--line)`, `var(--t2)`, `var(--ink)`, `var(--tau)` …);
use those rather than new numbers. Durations read in JavaScript go through `tauMs()`: the deploy's minifier rewrites
`120ms` as `.12s`.

## When the redesign becomes the site

The plan, when it replaces the current design:

- the redesign renders from the Jekyll source directly, instead of mirroring the published pages;
- it moves from `/v2-9dcd86d1/` to the root, `noindex` comes off, and the old stylesheet and `logo.js` go;
- this README becomes the repository's README (merged with its content workflows).
