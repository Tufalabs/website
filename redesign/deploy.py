#!/usr/bin/env python3
"""The redesign as a site of its own (v2.tufalabs.ai, Cloudflare Pages): build.py's `system` pages moved to the root, without the
preview bar, with real assets instead of the symlink, and kept out of search engines while tufalabs.ai is the main site.

    python3 build.py && python3 deploy.py                       # → dist/, a site of its own at the root
    python3 build.py && python3 deploy.py --base /<slug>/       # → ../site/<slug>/, inside the live site (its /assets/ shared)
"""
import re, shutil, pathlib, subprocess, sys, argparse
ROOT = pathlib.Path(__file__).parent
OUT, DIST, SITE = ROOT / "out", ROOT / "dist", ROOT.parent / "site"
NOINDEX = '<meta name="robots" content="noindex, nofollow">'

arg = argparse.ArgumentParser(); arg.add_argument("--base", default="/"); BASE = arg.parse_args().base
assert BASE.startswith("/") and BASE.endswith("/"), "--base like /slug/"
if BASE != "/":   # inside the live site: the pages go into its source, under the slug; the images are the live site's own
    DIST = SITE / BASE.strip("/")
if not (OUT / "system/index.html").exists():
    sys.exit("run build.py first")
if DIST.exists():   # only ever replace an earlier build of ours (inside the live site, a wrong slug must not wipe a real section)
    assert BASE == "/" or NOINDEX in (DIST / "index.html").read_text(errors="ignore"), f"{DIST} exists and is not a redesign build"
    shutil.rmtree(DIST)

# the pages: out/system/* at the root; the design pages (rules, figures, identity) stay under /system/
shutil.copytree(OUT / "system", DIST)
for test in ("eyediff.html", "partsview.html", "markdiff.html", "chiplevels.html", "mark.svg", "ref1c.svg", "tufa_spider_white_master-original.svg"):
    (DIST / test).unlink(missing_ok=True)   # tools/devpages.sh's test pages, if a build left them
shutil.copytree(OUT / "themes", DIST / "themes")
if BASE == "/":
    shutil.copytree(SITE / "assets", DIST / "assets", symlinks=False)
    for f in ("favicon.ico", "favicon.png", "site.webmanifest"):
        shutil.copy2(SITE / f, DIST / f)
    assert (DIST / "404.html").exists()   # a host of its own answers missing paths with /404.html
else:
    (DIST / "404.html").unlink()          # the live site's own 404 answers under the slug too


def cf_decode(hexstr):   # Cloudflare's obfuscated addresses (the mirror carries them; their decoder script is gone): back to plain mailto
    key = int(hexstr[:2], 16)
    return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))


def tracked(path):   # in the live site's repository (what tufalabs.ai actually serves), not only on this disk
    return subprocess.run(["git", "ls-files", "--error-unmatch", path], cwd=SITE, capture_output=True).returncode == 0


def local_asset(m):   # inside the live site: an image the repository does not have yet travels with the redesign, under the slug
    path = m.group(2)
    if BASE == "/" or tracked(path.lstrip("/")): return m.group(0)
    (DIST / path.lstrip("/")).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(SITE / path.lstrip("/"), DIST / path.lstrip("/"))
    return f'{m.group(1)}"{BASE}{path.lstrip("/")}'


def site(html):
    html = re.sub(r'<a href="/cdn-cgi/l/email-protection#[0-9a-f]+"><span class="__cf_email__" data-cfemail="([0-9a-f]+)">[^<]*</span></a>',
                  lambda m: f'<a href="mailto:{cf_decode(m.group(1))}">{cf_decode(m.group(1))}</a>', html)
    html = re.sub(r'((?:href|src|content)=)"(/assets/[^"?]*)', local_asset, html)
    html = re.sub(r'<div id="theme-switch"[^>]*>.*?</div>', "", html, flags=re.S)                 # the preview bar
    html = re.sub(r'\s*<script[^>]*themes/palette\.js[^>]*></script>', "", html)                  # which palette.js builds
    html = html.replace('"/system/system/', '"/__design__/').replace('"/system/', f'"{BASE}').replace('"/__design__/', f'"{BASE}system/')
    html = html.replace('"/themes/', f'"{BASE}themes/')   # (the images stay at /assets/: the same files either way)
    if NOINDEX not in html:
        html = html.replace("</head>", NOINDEX + "</head>", 1)
    return html


for page in DIST.rglob("*.html"):
    page.write_text(site(page.read_text()))

# production: only what the pages load, minified (esbuild, pinned); the vendored builds come minified, with their licences
THEME = DIST / "themes"
loaded = {m for p in DIST.rglob("*.html") for m in re.findall(r'themes/([\w./-]+?)(?:\?|")', p.read_text())}
for f in [f for f in THEME.rglob("*") if f.is_file()]:
    if str(f.relative_to(THEME)) not in loaded and not f.name.startswith("LICENSE"):
        f.unlink()
for f in sorted(THEME.glob("*.js")) + sorted(THEME.glob("*.css")):
    subprocess.run(["npx", "--yes", "esbuild@0.24.0", str(f), "--minify", "--legal-comments=none", f"--outfile={f}", "--allow-overwrite", "--log-level=warning"], check=True)

# search engines: the header (every response, assets too) and robots.txt, on a host of its own (inside the live site, the noindex
# meta on every page does it: a robots.txt line would only advertise the slug)
if BASE == "/":
    (DIST / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n")
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n")

# a last look: no link may still point into /system/ except the design pages, and nothing at all may name the preview
d = re.escape(BASE + "system/")
left = [(str(p.relative_to(DIST)), m) for p in DIST.rglob("*.html") for m in re.findall(r'(?:href|src)="(/(?:system|themes)/[^"]*)"', p.read_text())
        if not re.match(d + r"((figures/|identity/)?$|identity/[\w.-]+$)", m) and not m.startswith(BASE + "themes/")]
assert not left, left[:5]
assert not any("theme-switch" in p.read_text() or "palette.js" in p.read_text() for p in DIST.rglob("*.html"))
size = subprocess.run(["du", "-sh", str(DIST)], capture_output=True, text=True).stdout.split()[0]
print(f"{DIST}: {sum(1 for _ in DIST.rglob('*.html'))} pages, {size}")
