#!/usr/bin/env python3
"""Mirror every page of the live site into live/<path>/index.html, crawling same-site links from the home page.
Usage: python3 tools/mirror.py   (re-run to refresh; assets come from ../site/assets, so only pages are fetched)"""
import re, pathlib, urllib.request, urllib.parse, collections
ROOT = pathlib.Path(__file__).resolve().parent.parent
LIVE, BASE = ROOT / "live", "https://tufalabs.ai"
SKIP = re.compile(r"^/(assets|cdn-cgi)/|\.(png|jpe?g|gif|svg|webp|pdf|css|js|ico|xml|json|txt|mp4|zip)$", re.I)

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "tufa-redesign-mirror/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.geturl(), r.read().decode("utf-8", "replace")

seen, queue, saved = set(), collections.deque(["/"]), []
while queue:
    path = queue.popleft()
    if path in seen: continue
    seen.add(path)
    try:
        final, html = fetch(path)
    except Exception as e:
        print("skip", path, e); continue
    fpath = urllib.parse.urlparse(final).path or "/"
    if urllib.parse.urlparse(final).netloc not in ("tufalabs.ai", "www.tufalabs.ai"): continue
    rel = fpath.strip("/")
    dst = LIVE / rel / "index.html" if not rel.endswith(".html") else LIVE / rel
    dst.parent.mkdir(parents=True, exist_ok=True); dst.write_text(html); saved.append(fpath)
    for href in re.findall(r'href="([^"#?]+)', html):
        u = urllib.parse.urlparse(urllib.parse.urljoin(BASE + fpath, href))
        if u.netloc not in ("tufalabs.ai", "www.tufalabs.ai") or SKIP.search(u.path): continue
        p = u.path if u.path.endswith("/") or u.path.endswith(".html") else u.path + "/"
        if p not in seen: queue.append(p)
print(len(saved), "pages:", " ".join(sorted(saved)))
