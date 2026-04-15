set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

ruby_version := "3.4.9"
bundler_version := "4.0.3"

init:
    #!/usr/bin/env bash
    set -euo pipefail

    current_ruby="$(ruby -e 'print RUBY_VERSION')"
    if [[ "$current_ruby" != "{{ruby_version}}" ]]; then
      echo "Expected Ruby {{ruby_version}}, found $current_ruby."
      echo "Activate the correct Ruby with rbenv before continuing."
      exit 1
    fi

    if ! gem list -i bundler -v "{{bundler_version}}" >/dev/null 2>&1; then
      echo "Installing Bundler {{bundler_version}}..."
      gem install bundler -v "{{bundler_version}}"
      if command -v rbenv >/dev/null 2>&1; then
        rbenv rehash
      fi
    fi

    if ! bundle _{{bundler_version}}_ -v >/dev/null 2>&1; then
      echo "Bundler {{bundler_version}} is not available on PATH."
      exit 1
    fi

    cd blog
    bundle _{{bundler_version}}_ check >/dev/null 2>&1 || bundle _{{bundler_version}}_ install
    echo "Ruby {{ruby_version}} and Bundler {{bundler_version}} are ready."

build: init
    cd blog && bundle _{{bundler_version}}_ exec jekyll build

serve: init
    #!/usr/bin/env bash
    set -euo pipefail

    cleanup() {
      if [[ -n "${jekyll_pid:-}" ]]; then
        kill "$jekyll_pid" >/dev/null 2>&1 || true
        wait "$jekyll_pid" 2>/dev/null || true
      fi
    }

    trap cleanup EXIT INT TERM

    (
      cd blog
      bundle _{{bundler_version}}_ exec jekyll build --watch
    ) &
    jekyll_pid="$!"

    echo "Watching blog sources and rebuilding into blog/_site..."
    echo "Serving website at http://localhost:4000/"
    echo "Serving blog at http://localhost:4000/blog/_site/"
    echo "Press Ctrl+C to stop."
    python3 -m http.server 4000 --directory .
