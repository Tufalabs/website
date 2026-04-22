# Website
Public website for Tufa Labs.

## Common content workflows
- Add a team member: update [site/_data/team.yml](site/_data/team.yml) with the new entry and add the profile image under [site/assets/images/](site/assets/images/).
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

## Deploy
- GitHub Pages automatically deploys the site through the `Pages deploy` GitHub Actions workflow.

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

## Notes
- The editable website source lives in `site/`.
- Local test builds write to `build/`, which is ignored by git.
- GitHub Pages builds a separate `_site/` artifact in CI and deploys that artifact.
- The local workflow expects Ruby `3.4.9` and Bundler `4.0.3`.
- `just serve` auto-rebuilds the site on changes and serves the canonical pretty URLs directly.
