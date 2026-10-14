#!/usr/bin/env python3
"""Self-contained share build of the rule-based system (system.css + sections.js) for hosting as an artifact."""
import re, shutil, pathlib
ROOT = pathlib.Path(__file__).parent
LIVE, OUT, SITE, THEMES = ROOT / "live", ROOT / "share", ROOT.parent / "site", ROOT / "themes"
PAGES = sorted(p.relative_to(LIVE) for p in LIVE.rglob("index.html"))
RULES_REL = pathlib.Path("rules/index.html")
# draft copy proposed for the redesign (not on the live site yet): page -> lede
LEDES = {"team/index.html": "A small group of researchers and engineers, based in Zurich."}
MIRRORED = {"/" + (str(p.parent) + "/" if str(p.parent) != "." else ""): p for p in PAGES}
MIRRORED["/system/"] = RULES_REL

def cf_decode(hexstr):
    key = int(hexstr[:2], 16)
    return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))

SHARE_CSS = """
/* share-only: the review bar marks this as a preview, not the live site */
#theme-switch { position: fixed; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 60;
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; max-width: calc(100vw - 24px);
  font: 400 12px/1.2 var(--mono); background: var(--ink); color: var(--bg); padding: 6px 8px; }
#theme-switch b { color: var(--accent); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
"""
HEAD = """<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600&display=block"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=block"><meta name="robots" content="noindex, nofollow">
<script>document.documentElement.classList.add("js-nav");var d=document.documentElement;d.classList.add("is-holding");var rel=function(){d.classList.remove("is-holding")};addEventListener("load",rel);setTimeout(rel,1500);try{var ins=+sessionStorage.getItem("tufa-inside");if(ins&&Date.now()-ins<15000)d.style.setProperty("--bt","0.35");}catch(e){}var off=new URLSearchParams(location.search).get("off");try{if(off!==null)sessionStorage.setItem("tufa-off",off);else off=sessionStorage.getItem("tufa-off");}catch(e){}if(off)off.split(",").forEach(function(k){if(k)d.classList.add("off-"+k);});if(off){var ks=off.split(",");if(ks.indexOf("css")>=0)document.querySelectorAll('link[rel="stylesheet"]:not([href*="fonts.googleapis"])').forEach(function(l){l.disabled=true;l.remove();});if(ks.indexOf("fonts")>=0)document.querySelectorAll('link[href*="fonts.g"]').forEach(function(l){l.remove();});if(ks.indexOf("scheme")>=0){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.remove();var st=document.querySelector("head > style");if(st&&/html\{background/.test(st.textContent))st.remove();}}try{var th=localStorage.getItem("tufa-theme");if(th==="dark"){d.setAttribute("data-theme","dark");var cm=document.querySelector('meta[name="color-scheme"]');if(cm)cm.content="dark";}var tr=JSON.parse(localStorage.getItem("tufa-rules")||"null");if(tr){var U={line:"px",u:"px",tau:"ms",ratio:"",h:"",tc:""};for(var k in tr)if(k in U)d.style.setProperty("--"+k,tr[k]+U[k]);if(tr.curve)d.style.setProperty("--ease","cubic-bezier("+tr.curve+")");var gf=function(n,w,b){var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+n.replace(/ /g,"+")+":wght@"+w+"&display=block";document.head.appendChild(l);};if(tr.font){gf(tr.font,tr.fontw||"400;500;600");var ff='"'+tr.font+'", '+(tr.serif?"Georgia, serif":"'Helvetica Neue', Arial, sans-serif");d.style.setProperty("--sans",ff);d.style.setProperty("--display",ff);}if(tr.mono){gf(tr.mono,tr.monow||"400;500",1);d.style.setProperty("--mono",'"'+tr.mono+'", ui-monospace, Menlo, monospace');}}}catch(e){}</script>
<script src="{up}palette.js" defer></script>
<script src="{up}sections.js" defer></script>
<script src="{up}creature.js" defer></script>
<script src="{up}site.js" defer></script>
<script src="{up}figures.js" defer></script>
<script src="{up}hero.js" defer></script>
<script src="{up}swup.umd.js" defer></script>
<script src="{up}swup-preload.umd.js" defer></script>
<script src="{up}swup-scroll.umd.js" defer></script>
<script src="{up}router.js" defer></script>"""
BAR = '<div id="theme-switch" data-rules="{up}rules/index.html"><b>Redesign preview</b><span>not the live site</span></div>'

if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir()
IDENTITY_CSS = "".join((ROOT / "vendor/identity/css" / f).read_text() + "\n" for f in ("tokens.css", "base.css", "motion.css"))   # the identity repo's design rules first
(OUT / "site.css").write_text(IDENTITY_CSS + (THEMES / "system.css").read_text() + SHARE_CSS)
for js in ("sections.js", "palette.js", "site.js", "figures.js", "hero.js", "router.js", "vendor/swup.umd.js", "vendor/swup-preload.umd.js", "vendor/swup-scroll.umd.js"):
    shutil.copy2(THEMES / js, OUT / pathlib.Path(js).name)
shutil.copy2(ROOT / "vendor/identity/js/creature.js", OUT / "creature.js")

import sys; sys.path.insert(0, str(ROOT / "identity")); import page as identity_page
sys.path.insert(0, str(ROOT / "tools")); from prerender import prerender
FIRST = '<meta name="color-scheme" content="light"><style>html{background:#f7f4ef;color-scheme:light}html[data-theme="dark"]{background:#1c1814;color-scheme:dark}</style>'   # the ground from the first byte: no dark flash between pages (or inside a dark embedding frame)
sources = {rel: (LIVE / rel).read_text() for rel in PAGES}
FOOTER = re.search(r'<footer class="site-footer">.*?</footer>', sources[pathlib.Path("terms/index.html")], re.S).group(0)
shell = sources[pathlib.Path("open-positions/index.html")]
shell = re.sub(r'<article class="page">.*?</article>', lambda m: (ROOT / "rules.html").read_text(), shell, flags=re.S)
sources[RULES_REL] = shell.replace(' class="active"', "").replace("<title>Open Positions", "<title>Design rules")
figs = sources[pathlib.Path("open-positions/index.html")]
figs = re.sub(r'<article class="page">.*?</article>', lambda m: (ROOT / "figures.html").read_text(), figs, flags=re.S)
sources[pathlib.Path("figures/index.html")] = figs.replace(' class="active"', "").replace("<title>Open Positions", "<title>Figures")
nf = re.sub(r'<article class="page">.*?</article>', lambda m: (ROOT / "notfound.html").read_text(), sources[pathlib.Path("open-positions/index.html")], flags=re.S)
sources[pathlib.Path("404/index.html")] = nf.replace(' class="active"', "").replace("<title>Open Positions", "<title>Page not found")
ident = re.sub(r'<article class="page">.*?</article>', lambda m: identity_page.render(), sources[pathlib.Path("open-positions/index.html")], flags=re.S)
sources[pathlib.Path("identity/index.html")] = ident.replace(' class="active"', "").replace("<title>Open Positions", "<title>Identity")
(OUT / "identity").mkdir(parents=True, exist_ok=True)
for svg in ("mark/mark.svg", "source/tufa_spider_1c_separation.svg", "source/tufa_spider_white_master.svg"): shutil.copy2(ROOT / "vendor/identity" / svg, OUT / "identity" / pathlib.Path(svg).name)

sources = {rel: re.sub(r'\s*<img [^>]*class="cartoon-image"[^>]*>', '', html) for rel, html in sources.items()}   # the home page's cartoon: dropped from the redesign
sources = {rel: re.sub(r'<img src="[^"]*tufa_logo\.png"[^>]*class="logo-image"[^>]*>', lambda m: identity_page.header_mark(), html) for rel, html in sources.items()}
assets = set()
for rel, html in sources.items():
    depth = len(rel.parts) - 1
    up = "../" * depth
    if str(rel) in LEDES:
        html = re.sub(r'(<h1 class="page-title">.*?</h1>)', lambda m: m.group(1) + f'\n        <p class="page-lede">{LEDES[str(rel)]}</p>', html, count=1)
    html = prerender(re.sub(r'\s*<script[^>]*assets/js/logo\.js[^>]*></script>', '', html))   # the menu button, the page name and statement sizing, in the HTML: the first frame has the final layout (and no more logo.js: the creature replaces its wobble)
    # what the Jekyll templates now emit: articles carry the footer and a way back to their section
    if "site-footer" not in html:
        html = html.replace("</main>", "</main>\n" + FOOTER, 1)
    if '<h1 class="post-title">' in html and "post-back" not in html:
        sec = rel.parts[0]; label = {"research": "Research", "news": "News"}.get(sec)
        if label: html = html.replace('<h1 class="post-title">', f'<a class="post-back" href="/{sec}/">← {label}</a>\n        <h1 class="post-title">', 1)
    html = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\s*', "", html)
    html = re.sub(r'href="/assets/css/site\.css[^"]*"', f'href="{up}site.css"', html)
    html = re.sub(r'<script[^>]*cdn-cgi[^>]*></script>', "", html)
    html = re.sub(r"<!-- Begin Jekyll SEO tag.*?<!-- End Jekyll SEO tag -->\s*", "", html, flags=re.S)
    html = re.sub(r'<link (rel="(icon|apple-touch-icon|shortcut icon)"|type="application/atom\+xml")[^>]*>\s*', "", html)
    html = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', "", html, flags=re.S)
    html = re.sub(r'<a href="/cdn-cgi/l/email-protection#[0-9a-f]+"><span class="__cf_email__" data-cfemail="([0-9a-f]+)">[^<]*</span></a>',
                  lambda m: f'<a href="mailto:{cf_decode(m.group(1))}">{cf_decode(m.group(1))}</a>', html)
    html = re.sub(r'<div class="video-embed">\s*<iframe src="https://www.youtube.com/embed/([\w-]+)[^"]*"[^>]*></iframe>\s*</div>',
                  r'<a class="video-link" href="https://www.youtube.com/watch?v=\1" target="_blank" rel="noopener">Watch on YouTube →</a>', html)
    def local(m):
        attr, path = m.group(1), m.group(2)
        clean = path.split("?")[0].split("#")[0]
        if clean.startswith("/assets/"):
            assets.add(clean); return f'{attr}="{up}{clean[1:]}{path[len(clean):]}"'
        if clean in MIRRORED:
            return f'{attr}="{up}{MIRRORED[clean]}"'
        if clean.startswith("/"):
            return f'{attr}="https://tufalabs.ai{path}"'
        return m.group(0)
    html = re.sub(r'\b(href|src)="(/[^"]*)"', local, html)
    html = re.sub(r"<title>(.*?)</title>", lambda m: "<title>Tufa Labs Redesign</title>" if depth == 0 else f"<title>{m.group(1)} · redesign preview</title>", html, count=1)
    html = html.replace("</head>", HEAD.replace("{up}", up) + "\n</head>", 1)
    html = html.replace("</body>", BAR.replace("{up}", up) + "\n</body>")
    if depth == 0:  # the artifact page itself is wrapped in a skeleton: keep head and body contents only
        head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
        head = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", head)
        body = re.search(r"<body[^>]*>(.*?)</body>", html, re.S).group(1)
        html = head.strip() + "\n" + body.strip() + "\n"
    dst = OUT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    html = re.sub(r"(<head>\s*<meta charset=\"UTF-8\">)", lambda m: m.group(1) + FIRST, html, count=1) if '<meta charset="UTF-8">' in html else html.replace("<head>", "<head>" + FIRST, 1)   # right after the charset
    # accessibility (as the Jekyll templates now emit): a skip link, the active nav item named, the main landmark
    if "skip-link" not in html: html = html.replace('<header class="site-header">', '<a class="skip-link" href="#content">Skip to content</a>\n<header class="site-header">', 1)
    html = html.replace(' class="active">', ' class="active" aria-current="page">')
    html = re.sub(r'<main class="container( post-container)?">', lambda m: f'<main class="container{m.group(1) or ""}" id="content" tabindex="-1">', html, count=1)
    dst.write_text(html)

for a in sorted(assets):
    src = SITE / a[1:]
    if src.exists():
        (OUT / a[1:]).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, OUT / a[1:])
    else:
        print("missing asset", a)
print("pages", len(sources), "assets", len(assets))
