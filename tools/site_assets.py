"""What the site (site/, Jekyll) takes from the pinned identity (identity/, see tools/sync_identity.py), so nothing there is
copied by hand: its styles and the animated mark (site/_includes/identity/*.css, joined with the site's own sheet into
/assets/css/system.css by Jekyll; site/assets/js/creature.js), the header's mark (site/_includes/mark.svg), the icons
(site/favicon.*, site/assets/icons/) and the values the templates read (site/_data/identity.json: the paper colours, the
faces' Google Fonts request, the version). Run after tools/sync_identity.py; CI runs it before every build.

    python3 tools/site_assets.py
"""
import json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
ID, SITE = ROOT / "identity", ROOT / "site"
T = json.loads((ID / "tokens.json").read_text())

data = {"version": (ID / "VERSION").read_text().strip(), "paper": T["colour"]["light"]["paper"]["hex"], "paper_dark": T["colour"]["dark"]["paper"]["hex"],
        "ink": T["colour"]["light"]["ink"]["hex"], "google_fonts": T["type"]["google_fonts"]}
(SITE / "_data/identity.json").write_text(json.dumps(data, indent=2) + "\n")
# the styles and the creature
(SITE / "_includes/identity").mkdir(parents=True, exist_ok=True)
for f in ("tokens.css", "base.css", "motion.css"): shutil.copy2(ID / "css" / f, SITE / "_includes/identity" / f)
shutil.copy2(ID / "js/creature.js", SITE / "assets/js/creature.js")
# the header's mark: the parts the creature animates, with clip ids of its own
svg = re.sub(r"<!--.*?-->\s*", "", (ID / "mark/mark.svg").read_text(), flags=re.S).strip()
svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg).replace("tufa-eye-l", "tufa-eye-lh").replace("tufa-eye-r", "tufa-eye-rh")
(SITE / "_includes/mark.svg").write_text(svg.replace("<svg ", '<svg class="logo-image" id="logo-image" role="img" aria-label="Tufa Labs logo" ', 1) + "\n")
# the icons
web = ID / "dist/web"
for f in ("favicon.ico", "favicon.png"): shutil.copy2(web / f, SITE / f)
(SITE / "assets/icons").mkdir(parents=True, exist_ok=True)
for f in ("favicon-48.png", "favicon-96.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"): shutil.copy2(web / f, SITE / "assets/icons" / f)
print("site: identity", data["version"], "· styles, creature, mark, icons")
