"""What site.js used to add to a page's head after load, written into the HTML instead, so the first frame already has the
final layout (on phones the page name above the statement pushed everything down a few lines once the script ran)."""
import re, html as H

LONG = 140   # site.js: a statement longer than this steps down one size


def _text(inner):
    return H.unescape(re.sub(r"<[^>]+>", "", inner)).strip()


def _mark(inner, attrs, head):
    cls = re.search(r'class="([^"]*)"', attrs)
    classes = (cls.group(1).split() if cls else []) + (["is-long"] if len(_text(inner)) > LONG else [])
    attrs = re.sub(r'\s*class="[^"]*"', "", attrs)
    return f'<p class="{" ".join(dict.fromkeys(classes))}"{attrs} data-pre>{head}{inner}</p>' if classes else f"<p{attrs} data-pre>{head}{inner}</p>"


def header(html):
    """The phone menu's button, in the HTML (site.js used to add it, so it appeared a moment after the page)."""
    if 'class="nav-toggle"' in html: return html
    html = re.sub(r'(<nav class="site-nav"[^>]*>\s*<ul)(>)', r'\1 id="site-nav-list"\2', html, count=1)
    return re.sub(r'(<nav class="site-nav".*?</nav>)', r'\1\n            <button type="button" class="nav-toggle" aria-controls="site-nav-list" aria-expanded="false">Menu</button>', html, count=1, flags=re.S)


def prerender(html):
    html = header(html)
    if "data-pre" in html: return html
    t = re.search(r'<h1 class="page-title">(.*?)</h1>', html, re.S)
    kicker = f'<span class="band-kicker" aria-hidden="true">{re.sub(r"<[^>]+>", "", t.group(1)).strip()}</span>' if t else ""
    # the home page: the lab's name above its statement (the second paragraph; the first is empty)
    home = re.subn(r'(<div class="page-content home-content">\s*<p></p>\s*)<p([^>]*)>(.*?)</p>',
                   lambda m: m.group(1) + _mark(m.group(3), m.group(2), '<span class="band-brand" aria-hidden="true">Tufa Labs</span>'), html, count=1, flags=re.S)
    if home[1]: return home[0]
    if not kicker: return html
    if 'class="page-lede' in html:   # the page's statement: its lede
        return re.sub(r'<p( class="page-lede[^"]*"[^>]*)>(.*?)</p>', lambda m: _mark(m.group(2), m.group(1), kicker), html, count=1, flags=re.S)
    # no lede: the content's first paragraph, if the content opens with one
    return re.sub(r'(<article class="page">.*?<div class="page-content">\s*)<p([^>]*)>(.*?)</p>', lambda m: m.group(1) + _mark(m.group(3), m.group(2), kicker), html, count=1, flags=re.S)
