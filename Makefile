.PHONY: jekyll-build serve

jekyll-build:
	cd blog && bundle exec jekyll build

serve:
	python3 -m http.server 4000
