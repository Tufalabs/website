# website
Public website for tufa labs

## How to deploy
1. Push to main branch

The blog will be automatically built by GitHub Actions. The workflow will:
- Install required dependencies
- Build the Jekyll site
- Commit the generated files to the repository

## How to build the blog manually (for local testing)
1. Navigate to the blog directory:
   ```
   cd blog
   ```
2. Install the required gems (first time only):
   ```
   bundle install
   ```
3. Build the Jekyll site:
   ```
   bundle exec jekyll build
   ```
4. This will generate the static site in the `blog/_site` directory

## Automated Build Process
The repository is configured with GitHub Actions to automatically build the Jekyll blog when changes are pushed to the main branch. The workflow file is located at `.github/workflows/jekyll-build.yml`.

## How to run locally
 - Clone the repo
 - (No build step yet for the main site)
 - For the blog, follow the build steps above
 - Using a browser, navigate to file:///Users/YOUR_USER/code/tufalabs/website/index.html
 - To preview the blog, run `bundle exec jekyll serve` from the blog directory and visit http://localhost:4000/blog/