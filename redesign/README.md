# Redesign proposals

Markup and content are untouched; designs are stylesheets that replace `site/assets/css/site.css`.

- `themes/system.css` – current direction: one self-contained, rule-based stylesheet
  (24px line, 4:3 type scale, 12-column grid, one hue per palette; CSS-only motion). Rules are documented at `/system/system/`.
- `themes/palette.js` – preview only: palette picker, `G` grid overlay, live values on the rules page.
- `themes/t0-technical.css` – previous round (layered `_structure` → `_swiss` → `_technical` + `_motion`); older rounds in `themes/archive/`.
- `build.py` – local preview: `python3 build.py && python3 -m http.server 8765 --directory out`, then open http://127.0.0.1:8765/system/
- `share.py` – static build of t0 that was published as an artifact (not yet updated to `system.css`).
