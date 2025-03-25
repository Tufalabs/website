# website
Public website for tufa labs

## How to deploy
1. Build the blog first (see below)
2. Push to main branch

## How to build the blog before publishing
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

## How to run locally
 - Clone the repo
 - (No build step yet for the main site)
 - For the blog, follow the build steps above
 - Using a browser, navigate to file:///Users/YOUR_USER/code/tufalabs/website/index.html
 - To preview the blog, run `bundle exec jekyll serve` from the blog directory and visit http://localhost:4000/blog/