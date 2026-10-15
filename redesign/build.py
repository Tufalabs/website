#!/usr/bin/env python3
"""Generate per-theme copies of the mirrored live pages with the stylesheet swapped (local preview)."""
import re, shutil, pathlib, time, json
ROOT = pathlib.Path(__file__).parent
LIVE, OUT = ROOT / "live", ROOT / "out"
STAMP = int(time.time())
THEMES = ["current", "t0-technical", "system"]
PAGES = sorted(p.relative_to(LIVE) for p in LIVE.rglob("index.html"))
LOCAL = {"/" + (str(p.parent) + "/" if str(p.parent) != "." else "") for p in PAGES} | {"/system/"}
FONTS = re.compile(r'<link href="https://fonts.googleapis.com[^>]*>\s*')
SWITCH = (ROOT / "switcher.html").read_text()
BAR = '<div id="theme-switch" data-rules="/system/system/" style="position:fixed;right:12px;bottom:12px;z-index:9999;font:12px/1.2 ui-monospace,Menlo,monospace;background:#111;color:#fff;padding:6px 8px;display:flex;gap:6px;align-items:center;border-radius:2px"><span style="opacity:.6">preview</span></div>'
MOTION_HEAD = (ROOT / "head.html").read_text()
# the identity's tokens, resolved (vendor/identity/tokens.json): the ground, the faces' Google Fonts request
TOKENS = json.loads((ROOT / "vendor/identity/tokens.json").read_text())
PAPER, PAPER_DARK = TOKENS["colour"]["light"]["paper"]["hex"], TOKENS["colour"]["dark"]["paper"]["hex"]
SYSTEM_HEAD = """<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="{{FONTS}}"><script>document.documentElement.classList.add("js-nav");var d=document.documentElement;d.classList.add("is-holding");var rel=function(){d.classList.remove("is-holding")};addEventListener("load",rel);setTimeout(rel,1500);try{var ins=+sessionStorage.getItem("tufa-inside");if(ins&&Date.now()-ins<15000)d.style.setProperty("--bt","0.35");}catch(e){}var off=new URLSearchParams(location.search).get("off");try{if(off!==null)sessionStorage.setItem("tufa-off",off);else off=sessionStorage.getItem("tufa-off");}catch(e){}if(off)off.split(",").forEach(function(k){if(k)d.classList.add("off-"+k);});if(off){var ks=off.split(",");if(ks.indexOf("css")>=0)document.querySelectorAll('link[rel="stylesheet"]:not([href*="fonts.googleapis"])').forEach(function(l){l.disabled=true;l.remove();});if(ks.indexOf("fonts")>=0)document.querySelectorAll('link[href*="fonts.g"]').forEach(function(l){l.remove();});if(ks.indexOf("scheme")>=0){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.remove();var st=document.querySelector("head > style");if(st&&/html\{background/.test(st.textContent))st.remove();}}try{var th=localStorage.getItem("tufa-theme");if(th==="dark"){d.setAttribute("data-theme","dark");var cm=document.querySelector('meta[name="color-scheme"]');if(cm)cm.content="dark";}var tr=JSON.parse(localStorage.getItem("tufa-rules")||"null");if(tr){var U={line:"px",u:"px",tau:"ms",ratio:"",h:"",tc:""};for(var k in tr)if(k in U)d.style.setProperty("--"+k,tr[k]+U[k]);if(tr.curve)d.style.setProperty("--ease","cubic-bezier("+tr.curve+")");var gf=function(n,w,b){var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+n.replace(/ /g,"+")+":wght@"+w+"&display=block";document.head.appendChild(l);};if(tr.font){gf(tr.font,tr.fontw||"400;500;600");var ff='"'+tr.font+'", '+(tr.serif?"Georgia, serif":"'Helvetica Neue', Arial, sans-serif");d.style.setProperty("--sans",ff);d.style.setProperty("--display",ff);}if(tr.mono){gf(tr.mono,tr.monow||"400;500",1);d.style.setProperty("--mono",'"'+tr.mono+'", ui-monospace, Menlo, monospace');}}if(localStorage.getItem("tufa-motion")==="off")document.documentElement.classList.add("no-motion")}catch(e){}</script>
<script src="/themes/palette.js?v={{STAMP}}" defer></script>
<script src="/themes/sections.js?v={{STAMP}}" defer></script>
<script src="/themes/creature.js?v={{STAMP}}" defer></script>
<script src="/themes/site.js?v={{STAMP}}" defer></script>
<script src="/themes/figures.js?v={{STAMP}}" defer></script>
<script src="/themes/hero.js?v={{STAMP}}" defer></script>
<script src="/themes/vendor/swup.umd.js?v={{STAMP}}" defer></script>
<script src="/themes/vendor/swup-preload.umd.js?v={{STAMP}}" defer></script>
<script src="/themes/vendor/swup-scroll.umd.js?v={{STAMP}}" defer></script>
<script src="/themes/router.js?v={{STAMP}}" defer></script>""".replace("{{FONTS}}", TOKENS["type"]["google_fonts"].replace("&", "&amp;"))
RULES = (ROOT / "rules.html").read_text()
import sys; sys.path.insert(0, str(ROOT / "identity")); import page as identity_page
sys.path.insert(0, str(ROOT / "tools")); from prerender import prerender
FIRST = f'<meta name="color-scheme" content="light"><style>html{{background:{PAPER};color-scheme:light}}html[data-theme="dark"]{{background:{PAPER_DARK};color-scheme:dark}}</style>'   # the ground from the first byte: no dark flash between pages (or inside a dark embedding frame)
# draft copy proposed for the redesign (not on the live site yet): page -> lede
LEDES = {"team/index.html": "A small group of researchers and engineers, based in Zurich."}

FOOTER = re.search(r'<footer class="site-footer">.*?</footer>', (LIVE / "terms/index.html").read_text(), re.S).group(0)
ICONS = """<link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/icons/favicon-48.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/assets/icons/favicon-96.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/favicon-192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
    <meta name="theme-color" content="{PAPER}">""".replace("{PAPER}", PAPER)

ORG = (ROOT.parent / "site/_includes/structured-data.html").read_text()
ORG = re.sub(r"\{%-? comment -?%\}.*?\{%-? endcomment -?%\}\s*", "", ORG, flags=re.S).replace("{{ site.url }}", "https://tufalabs.ai").replace("{{ site.title }}", "Tufa Labs")
ORG = ORG.replace("{{ site.description | jsonify }}", json.dumps("Public website for Tufa Labs, a small independent research group working on fundamental AI research."))

def access(html):
    """what the Jekyll templates now emit for accessibility and search (site/_includes/header.html, structured-data.html, the layouts)"""
    if "skip-link" not in html: html = html.replace('<header class="site-header">', '<a class="skip-link" href="#content">Skip to content</a>\n<header class="site-header">', 1)
    html = html.replace(' class="active">', ' class="active" aria-current="page">')
    html = re.sub(r'<main class="container( post-container)?">', lambda m: f'<main class="container{m.group(1) or ""}" id="content" tabindex="-1">', html, count=1)
    if "ResearchOrganization" not in html: html = html.replace("</head>", ORG + "</head>", 1)
    return html

def seo(html, rel):
    """what the Jekyll templates now emit (site/_includes/head.html, _plugins/og_image.rb): new icons, a preview image, the footer on articles"""
    html = re.sub(r'<link rel="icon"[^>]*>\s*<link rel="icon"[^>]*>\s*<link rel="apple-touch-icon"[^>]*>\s*<link rel="shortcut icon"[^>]*>', ICONS, html, count=1)
    slug = str(rel.parent).replace("/", "-") if str(rel.parent) != "." else "home"
    if (ROOT.parent / "site/assets/og" / f"{slug}.png").exists():
        img = f"https://tufalabs.ai/assets/og/{slug}.png"
        html = html.replace('<meta name="twitter:card" content="summary" />', f'<meta name="twitter:card" content="summary_large_image" />\n<meta property="og:image" content="{img}" />\n<meta property="twitter:image" content="{img}" />', 1)
    if '<h1 class="post-title">' in html and "post-back" not in html:
        sec = str(rel).split("/")[0]; label = {"research": "Research", "news": "News"}.get(sec)
        if label: html = html.replace('<h1 class="post-title">', f'<a class="post-back" href="/{sec}/">← {label}</a>\n        <h1 class="post-title">', 1)
    if "site-footer" not in html:
        html = html.replace("</main>", "</main>\n" + FOOTER, 1)
    return access(html)

def components(html):
    """The identity's content components, from the posts' Markdown output: a blockquote opening with a bold "Label: statement"
    (or "Label - statement") is a callout (label, statement, reasoning); a citation section's "Please cite this work as"
    and the reference that follows take the citation's classes; no highlighter colours (code is set in the inks)."""
    html = re.sub(r'\s*<link[^>]*assets/css/syntax\.css[^>]*>', '', html)
    def callout(m):
        body = m.group(1)
        head = re.match(r'\s*<p>((?:<strong>.*?</strong>\s*)+)</p>', body, re.S)
        if not head: return m.group(0)
        text = re.sub(r'</?strong>', '', head.group(1)).strip()
        lab = re.match(r'([^:\-–]{2,40}?)\s*(?::|\s[-–]\s)\s*(.+)$', text, re.S)
        label, title = (lab.group(1).strip(), lab.group(2).strip()) if lab and len(lab.group(1).split()) <= 4 else ('', text)
        title = title[:1].upper() + title[1:]   # a statement starts a sentence once its label is set apart
        return (f'<blockquote class="callout">' + (f'<span class="callout-label">{label}</span>' if label else '')
                + f'<p class="callout-title">{title}</p>' + body[head.end():] + '</blockquote>')
    html = re.sub(r'<blockquote>(.*?)</blockquote>', callout, html, flags=re.S)
    def citation(m):
        sec = re.sub(r'<p>\s*(Please cite[^<]*?):?\s*</p>(\s*)<p>', r'<p class="citation-label">\1</p>\2<p class="citation-ref">', m.group(0), count=1)
        return sec
    return re.sub(r'<h2 id="citation">.*?(?=<h2 |</div>\s*</article>|$)', citation, html, count=1, flags=re.S)


def render(theme, html):
    if theme == "system" and 'id="content"' not in html:   # every page's content is the router's container (and the skip link's target)
        html = re.sub(r'<main class="container( post-container)?">', lambda m: f'<main class="container{m.group(1) or ""}" id="content" tabindex="-1">', html, count=1)
    if theme == "system": html = components(html)
    if theme == "system": html = prerender(re.sub(r'\s*<script[^>]*assets/js/logo\.js[^>]*></script>', '', html))   # the menu button, the page name and statement sizing, in the HTML: the first frame has the final layout (and no more logo.js: the creature replaces its wobble)
    if theme != "current":
        html = FONTS.sub("", html)
        html = re.sub(r'href="/assets/css/site\.css[^"]*"', f'href="/themes/{theme}.css?v={STAMP}"', html)
        head = SYSTEM_HEAD if theme == "system" else MOTION_HEAD
        html = html.replace("</head>", head.replace("{{STAMP}}", str(STAMP)) + "</head>", 1)
    html = re.sub(r'<script[^>]*cdn-cgi[^>]*></script>', '', html)   # Cloudflare's email script only exists on the live host
    html = re.sub(r'(href=)"(/[^"]*)"', lambda m: f'{m.group(1)}"/{theme}{m.group(2)}"' if m.group(2) in LOCAL else m.group(0), html)
    if theme == "system": html = re.sub(r"(<head>\s*<meta charset=\"UTF-8\">)", lambda m: m.group(1) + FIRST, html, count=1) if '<meta charset="UTF-8">' in html else html.replace("<head>", "<head>" + FIRST, 1)   # right after the charset
    if theme == "system": html = re.sub(r'\s*<img [^>]*class="cartoon-image"[^>]*>', '', html)   # the home page's cartoon: dropped from the redesign
    if theme == "system": html = re.sub(r'<img src="[^"]*tufa_logo\.png"[^>]*class="logo-image"[^>]*>', lambda m: identity_page.header_mark(), html)   # the header mark: the inline, layered artwork
    if theme == "system":   # the preview bar is built by palette.js: animation and design options
        return html.replace("</body>", BAR + "</body>")
    return html.replace("</body>", SWITCH.replace("{{THEME}}", theme).replace("{{THEMES}}", ",".join(THEMES)) + "</body>")

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
(OUT / "assets").symlink_to(ROOT.parent / "site" / "assets")
(OUT / "favicon.ico").symlink_to(ROOT.parent / "site" / "favicon.ico")
shutil.copytree(ROOT / "themes", OUT / "themes", ignore=shutil.ignore_patterns("archive"))
# the identity repo's design rules (vendor/identity, pinned by tools/sync_identity.py) go in front of the site's own sheet
IDENTITY_CSS = "".join((ROOT / "vendor/identity/css" / f).read_text() + "\n" for f in ("tokens.css", "base.css", "motion.css"))
(OUT / "themes/system.css").write_text(IDENTITY_CSS + (ROOT / "themes/system.css").read_text())
shutil.copy2(ROOT / "vendor/identity/js/creature.js", OUT / "themes/creature.js")   # and its animated mark
for css in (OUT / "themes").glob("*.css"):  # bust caches on nested imports too
    css.write_text(re.sub(r'@import url\("([\w-]+\.css)"\)', rf'@import url("\1?v={STAMP}")', css.read_text()))

for theme in THEMES:
    for rel in PAGES:
        dst = OUT / theme / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        html = (LIVE / rel).read_text()
        if theme == "system":
            html = seo(html, rel)
        if theme == "system" and str(rel) in LEDES:
            html = re.sub(r'(<h1 class="page-title">.*?</h1>)', lambda m: m.group(1) + f'\n        <p class="page-lede">{LEDES[str(rel)]}</p>', html, count=1)
        dst.write_text(render(theme, html))
# rules page: the open-positions shell with the article swapped
shell = (LIVE / "open-positions/index.html").read_text()
shell = re.sub(r'<article class="page">.*?</article>', lambda m: RULES, shell, flags=re.S)
shell = shell.replace(' class="active"', "").replace("<title>Open Positions", "<title>Design rules")
(OUT / "system/system").mkdir(parents=True)
(OUT / "system/system/index.html").write_text(render("system", shell))
figs = (LIVE / "open-positions/index.html").read_text()
figs = re.sub(r'<article class="page">.*?</article>', lambda m: (ROOT / "figures.html").read_text(), figs, flags=re.S)
figs = figs.replace(' class="active"', "").replace("<title>Open Positions", "<title>Figures")
(OUT / "system/system/figures").mkdir(parents=True)
(OUT / "system/system/figures/index.html").write_text(render("system", figs))
ident = re.sub(r'<article class="page">.*?</article>', lambda m: identity_page.render(), (LIVE / "open-positions/index.html").read_text(), flags=re.S)
ident = ident.replace(' class="active"', "").replace("<title>Open Positions", "<title>Identity")
(OUT / "system/system/identity").mkdir(parents=True)
(OUT / "system/system/identity/index.html").write_text(render("system", ident))
for svg in ("mark/mark.svg", "source/tufa_spider_1c_separation.svg", "source/tufa_spider_white_master.svg"): shutil.copy2(ROOT / "vendor/identity" / svg, OUT / "system/system/identity" / pathlib.Path(svg).name)
# 404: the open-positions shell with the article swapped (the preview server answers missing pages with it)
nf = re.sub(r'<article class="page">.*?</article>', lambda m: (ROOT / "notfound.html").read_text(), (LIVE / "open-positions/index.html").read_text(), flags=re.S)
nf = nf.replace(' class="active"', "").replace("<title>Open Positions", "<title>Page not found")
(OUT / "system/404.html").write_text(render("system", seo(nf, pathlib.Path("404.html"))).replace('href="/research/"', 'href="/system/research/"').replace('href="/news/"', 'href="/system/news/"').replace('href="/open-positions/"', 'href="/system/open-positions/"').replace('<a href="/">Home', '<a href="/system/">Home'))
# for the link-preview cards (tools/og.py): every page, and the identity's mark as the cards draw it
(OUT / "system/pages.json").write_text(json.dumps(sorted("" if str(p.parent) == "." else str(p.parent) + "/" for p in PAGES)))
shutil.copy2(ROOT / "vendor/identity/dist/mark/tufa-mark-ink.svg", OUT / "system/mark-ink.svg")
print("themes:", THEMES)
