# Website
Public website for Tufa Labs.

## Deploy (static)
- Build the blog locally, commit the generated files, then push to `main`.
- GitHub Pages serves the repo as-is (no Jekyll build on GitHub).

## Local build and test
1. Install blog dependencies (first time only):
   ```
   cd blog
   bundle install
   ```
2. Build the blog:
   ```
   make jekyll-build
   ```
3. Serve the site locally:
   ```
   make serve
   ```
   Then open `http://localhost:4000/` (main site) and `http://localhost:4000/blog/_site/` (blog).

## Notes
- The blog output is committed at `blog/_site`.
- GitHub Pages does not run Jekyll for this repo (static hosting only).
