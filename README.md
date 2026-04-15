# Website
Public website for Tufa Labs.

## Deploy (static)
- Build the website locally, commit the generated files in `docs/`, then push to `main`.
- GitHub Pages should publish from `main:/docs` (no Jekyll build on GitHub).

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
- The committed publish output lives in `docs/`.
- GitHub Pages does not run Jekyll for this repo; it serves the committed static output.
- The local workflow expects Ruby `3.4.9` and Bundler `4.0.3`.
- `just serve` auto-rebuilds the site on changes and serves the canonical pretty URLs directly.
