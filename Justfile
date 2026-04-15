set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

ruby_version := "3.4.9"
bundler_version := "4.0.3"
jekyll_args := "--config site/_config.yml --source site --destination docs"

init:
    #!/usr/bin/env bash
    set -euo pipefail

    if command -v rbenv >/dev/null 2>&1; then
      eval "$(rbenv init - bash)"
    fi

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

    bundle _{{bundler_version}}_ check >/dev/null 2>&1 || bundle _{{bundler_version}}_ install
    echo "Ruby {{ruby_version}} and Bundler {{bundler_version}} are ready."

build: init
    #!/usr/bin/env bash
    set -euo pipefail

    if command -v rbenv >/dev/null 2>&1; then
      eval "$(rbenv init - bash)"
    fi

    bundle _{{bundler_version}}_ exec jekyll build {{jekyll_args}}

serve: init
    #!/usr/bin/env bash
    set -euo pipefail

    if command -v rbenv >/dev/null 2>&1; then
      eval "$(rbenv init - bash)"
    fi

    bundle _{{bundler_version}}_ exec jekyll serve {{jekyll_args}} --host 127.0.0.1 --port 4000
