"""Local preview server that forbids caching: a rebuilt page is always the one you see.
   python3 tools/serve.py [port] [directory]"""
import sys, functools, http.server
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()
    def log_message(self, *a): pass
    def send_error(self, code, message=None, explain=None):
        # a missing page under /system/ gets the redesign's 404 page
        import os
        nf = os.path.join(self.directory, "system/404.html")
        if code == 404 and self.path.startswith("/system/") and os.path.exists(nf):
            body = open(nf, "rb").read(); self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        super().send_error(code, message, explain)
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765; root = sys.argv[2] if len(sys.argv) > 2 else "out"
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=root)).serve_forever()
