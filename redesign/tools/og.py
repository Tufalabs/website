"""The link-preview cards (site/assets/og/<slug>.png, 1200 × 630), drawn by tools/ogcards.js in a headless browser on
the built preview (out/, from build.py): each page's head in the identity's faces and colours, so a change in the
identity (or a new page) reaches the cards on the next run. CI runs it before every build; locally it needs Chrome or
Chromium (CHROME=/path/to/browser if it is not found).

    python3 redesign/build.py && python3 redesign/tools/og.py [--require]   # --serve: no browser of its own
"""
import http.server, os, pathlib, shutil, subprocess, sys, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT, CARDS = ROOT / "out", ROOT.parent / "site/assets/og"
PORT = 8767
done, result = threading.Event(), {}


def browser():
    for c in (os.environ.get("CHROME"), "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"):
        if c and (shutil.which(c) or pathlib.Path(c).exists()): return shutil.which(c) or c


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(OUT), **k)
    def do_GET(self):
        if self.path.startswith("/system/og.html"):   # the home page, with the card script appended
            page = (OUT / "system/index.html").read_text().replace("</body>", '<script src="/og/run.js"></script></body>')
            return self.reply(page.encode(), "text/html")
        if self.path == "/og/run.js": return self.reply((ROOT / "tools/ogcards.js").read_bytes(), "text/javascript")
        super().do_GET()
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        if self.path == "/og/done": result["log"] = body.decode(); done.set()
        elif self.path.startswith("/og/") and self.path.endswith(".png"): (CARDS / pathlib.Path(self.path).name).write_bytes(body)
        self.reply(b"", "text/plain", 204)
    def reply(self, data, kind, code=200):
        self.send_response(code); self.send_header("Content-Type", kind); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self, *a): pass


if __name__ == "__main__":
    exe = None if "--serve" in sys.argv else browser()   # --serve: only serve; open the printed URL in any browser
    if not exe and "--serve" not in sys.argv:
        print("og: no Chrome or Chromium found (set CHROME=…); the cards stay as they are")
        sys.exit(1 if "--require" in sys.argv else 0)
    if not (OUT / "system/pages.json").exists(): sys.exit("og: run build.py first")
    CARDS.mkdir(parents=True, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    if not exe: print(f"og: open http://127.0.0.1:{PORT}/system/og.html", flush=True)
    proc = None if not exe else subprocess.Popen([exe, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                             "--remote-debugging-port=0", "--window-size=1400,1000", f"http://127.0.0.1:{PORT}/system/og.html"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = done.wait(240 if exe else 600); proc and proc.kill(); srv.shutdown()
    log = result.get("log", "timed out")
    print("og:", log)
    sys.exit(0 if ok and not log.startswith("error") and ":2" in log and ":4" not in log and ":5" not in log else 1)
