"""What the live site (site/, Jekyll) takes from the pinned identity (vendor/identity), so nothing there is copied by hand:
the icons (dist/web/ → site/favicon.*, site/assets/icons/) and the values its templates read (site/_data/identity.json:
the paper colour for theme-color and the web manifest, the identity version). Run after tools/sync_identity.py; CI runs
it before every build.

    python3 redesign/tools/site_assets.py
"""
import json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
ID, SITE = ROOT / "vendor/identity", ROOT.parent / "site"
T = json.loads((ID / "tokens.json").read_text())

data = {"version": (ID / "VERSION").read_text().strip(), "paper": T["colour"]["light"]["paper"]["hex"], "paper_dark": T["colour"]["dark"]["paper"]["hex"],
        "ink": T["colour"]["light"]["ink"]["hex"], "google_fonts": T["type"]["google_fonts"]}
(SITE / "_data/identity.json").write_text(json.dumps(data, indent=2) + "\n")
web = ID / "dist/web"
for f in ("favicon.ico", "favicon.png"): shutil.copy2(web / f, SITE / f)
(SITE / "assets/icons").mkdir(parents=True, exist_ok=True)
for f in ("favicon-48.png", "favicon-96.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"): shutil.copy2(web / f, SITE / "assets/icons" / f)
print("site: identity", data["version"], "· paper", data["paper"], "· icons")
