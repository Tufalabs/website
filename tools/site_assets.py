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
# the icons. The identity's tab sizes (favicon.ico, favicon-48.png, favicon.png) are the ink mark on a transparent ground,
# which a dark tab strip swallows; its 96px and larger icons sit on a paper tile. The tab icons here are made on that tile
# too: an SVG (the mark on a paper square, sharp at every size) and an .ico holding the 96px tile as PNG
web = ID / "dist/web"
(SITE / "assets/icons").mkdir(parents=True, exist_ok=True)
for f in ("favicon-96.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"): shutil.copy2(web / f, SITE / "assets/icons" / f)
(SITE / "assets/icons/favicon-48.png").unlink(missing_ok=True)
shutil.copy2(web / "favicon-192.png", SITE / "favicon.png")
mark = (ID / "dist/mark/tufa-mark-ink.svg").read_text()
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', mark).group(1).split()]
paths = "".join(re.findall(r"<path[^>]*/>", mark)).replace(T["colour"]["light"]["ink"]["hex"], data["ink"])
side = max(vb[2], vb[3]) / 0.9                                   # the mark at 90% of the tile: a tab icon is drawn at 16px
ox, oy = vb[0] - (side - vb[2]) / 2, vb[1] - (side - vb[3]) / 2
(SITE / "favicon.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox:.1f} {oy:.1f} {side:.1f} {side:.1f}">'
                                  f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{side:.1f}" height="{side:.1f}" fill="{data["paper"]}"/>{paths}</svg>\n')
png = (web / "favicon-96.png").read_bytes()                     # an .ico may hold a PNG: one 96px entry, scaled by the browser
import struct
(SITE / "favicon.ico").write_bytes(struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 96, 96, 0, 0, 1, 32, len(png), 22) + png)
print("site: identity", data["version"], "· styles, creature, mark, icons")
