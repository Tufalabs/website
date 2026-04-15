# Website
Public website for Tufa Labs.

## Deploy (static)
- Build the blog locally, commit the generated files, then push to `main`.
- GitHub Pages serves the repo as-is (no Jekyll build on GitHub).

## Local build and test
1. Install `just` if it is not installed already:
   ```
   # macOS
   brew install just

   # Linux (Debian/Ubuntu)
   sudo apt install just
   ```
   `just` is required for the local workflow in this repository.
2. Initialize the Ruby/Bundler toolchain and install blog dependencies:
   ```
   just init
   ```
3. Build the blog:
   ```
   just build
   ```
4. Serve the full site locally:
   ```
   just serve
   ```
   This watches blog source files and rebuilds `research/` automatically while serving the whole repo.
   Then open `http://localhost:4000/` (main site) and `http://localhost:4000/research/` (blog).

## Notes
- The blog output is committed at `research/`.
- GitHub Pages does not run Jekyll for this repo (static hosting only).
- The local workflow expects Ruby `3.4.9` and Bundler `4.0.3`.
- `just serve` auto-rebuilds the Jekyll blog on changes, but it does not do browser live reload.
