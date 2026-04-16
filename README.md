# Website
Public website for Tufa Labs.

## Deploy
- GitHub Pages deploys the site through the `Pages deploy` GitHub Actions workflow.
- Generated output is no longer committed to the repository.

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
   This serves the unified Jekyll source from `site/` and writes output to `docs/`.
   Then open `http://localhost:4000/`.

## Notes
- The editable website source lives in `site/`.
- Local test builds write to `docs/`, which is ignored by git.
- GitHub Pages builds a separate `_site/` artifact in CI and deploys that artifact.
- The local workflow expects Ruby `3.4.9` and Bundler `4.0.3`.
- `just serve` auto-rebuilds the site on changes and serves the canonical pretty URLs directly.
