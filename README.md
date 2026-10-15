# Website
Public website for Tufa Labs.

## Common content workflows
- Add a team member: update [site/_data/team.yml](site/_data/team.yml) with the new entry and add the profile image under [site/assets/images/](site/assets/images/).
- `/team/` shows the public team and legal notice. Set `full_team_only: true` on a member to omit them from the public HTML. The full team is rendered on a separate unlinked page with `noindex` and `sitemap: false`; it is not access-controlled. Query parameters no longer reveal additional members.
- Add a research post: create a dated Markdown file in [site/_posts/](site/_posts/) with the usual front matter.
- Add a news item: create a Markdown file in [site/_news/](site/_news/) with basic front matter.

### Front matter reference
- `title`: the headline shown on the site and used in page metadata.
- `date`: the publish date and time used for sorting and display.
- `author`: the byline shown on the entry.
- `description`: the short summary used on listing pages and in metadata.
- `layout`: the Jekyll layout used to render the entry; `post` is the normal choice for research posts and news items.
- `permalink`: the canonical URL for a research post, usually under `/research/<slug>/`.
- `external_link`: optional; if set on a research post, the research index links directly to that external URL.
- `sidenotes`: optional; set to `true` to enable the wider post layout needed for custom sidenotes and margin notes.

For news entries, `title`, `date`, `author`, and `description` are usually enough.

## Sidenotes
- Set `sidenotes: true` in front matter to opt a post into the wider layout that supports custom sidenotes and margin notes.
- See [site/_posts/2000-01-01-sidenote-demo.markdown](site/_posts/2000-01-01-sidenote-demo.markdown) for a compact example of the Liquid tag syntax and usage.

## Design: the identity
The site is built on the Tufa Labs identity ([Tufalabs/identity](https://github.com/Tufalabs/identity)): its colours,
faces, type scale, grid, motion, base styles, components (tables, callouts, citations, code) and the animated mark. A
tagged release of it is pinned in `identity/`; nothing there is edited by hand.

- Take a release: `python3 tools/sync_identity.py v0.4.2`, then `python3 tools/site_assets.py`. The second installs it
  into the site: the styles into `site/_includes/identity/`, the creature into `site/assets/js/`, the header's mark,
  the icons and the values the templates read (`site/_data/identity.json`). CI runs it before every build.
- The site's own styles are `site/_includes/system.css`; Jekyll joins them with the identity's into
  `/assets/css/system.css`. Lengths, sizes, colours and durations come from the identity's tokens
  (`var(--line)`, `var(--t2)`, `var(--ink)`, `var(--tau)`): use those rather than new numbers.
- The scripts are in `site/assets/js/` (the header and menu, the page router (swup), the section index, the figures); the
  head loads them in the order of `site/_data/scripts.yml`.
- Callouts and citations come from Markdown: a blockquote opening with a bold **Label: statement** is a callout, and a
  "Please cite this work as" section takes the citation's form (`site/_plugins/components.rb`). References to other
  work go in margin notes as `[Title](link) (Authors, Year).`
- Link-preview cards (`site/assets/og/`) are drawn from the built pages by `tools/og.py` (CI, on main).

## Deploy
- Pushing to `main` builds the site and deploys it to tufalabs.ai (the `Pages deploy` workflow).
- Every pull request (into `main` or `v2`) is built the same way and previewed at
  `https://urban-carnival-kkllvv1.pages.github.io/pr-preview/pr-<n>/` (Tufalabs/website-previews, private to the
  organisation); a comment on the pull request links there and follows each push, and the preview is removed when the
  pull request closes.

## Local build and test
1. Install `just` if it is not installed already:
   ```
   # macOS
   brew install just

   # Linux (Debian/Ubuntu)
   sudo apt install just
   ```
   `just` is required for the local workflow in this repository.
2. Initialize the Ruby/Bundler toolchain and install site dependencies:
   ```
   just init
   ```
3. Build the site:
   ```
   just build
   ```
4. Serve the full site locally:
   ```
   just serve
   ```
   This serves the unified Jekyll source from `site/` and writes output to `build/`.
   Then open `http://localhost:4000/`.

   To include unpublished news drafts (`published: false`), run `just preview` instead.

## Notes
- The editable website source lives in `site/`.
- Local test builds write to `build/`, which is ignored by git.
- GitHub Pages builds a separate `_site/` artifact in CI and deploys that artifact.
- The local workflow expects Ruby `3.4.9` and Bundler `4.0.3`.
- `just serve` auto-rebuilds the site on changes and serves the canonical pretty URLs directly.
