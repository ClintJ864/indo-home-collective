"""Local static server that applies netlify.toml's [[redirects]] the way Netlify
does (first match wins, `force` rules beat real files, 200 = rewrite), so path
routes like /about and the /prerender copies can be tested before deploying.

    python scripts/dev-server.py [port]      # default 8935, serves the site root
"""
import http.server
import os
import sys
import tomllib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with open(os.path.join(ROOT, 'netlify.toml'), 'rb') as f:
    RULES = tomllib.load(f).get('redirects', [])


def matches(pattern, path):
    if pattern.endswith('/*'):
        return path.startswith(pattern[:-1])
    return path == pattern or path.rstrip('/') == pattern.rstrip('/')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        on_disk = os.path.isfile(os.path.join(ROOT, path.lstrip('/'))) if path != '/' else False
        for rule in RULES:
            if not matches(rule['from'], path) or (on_disk and not rule.get('force')):
                continue
            status = rule.get('status', 301)
            if status in (301, 302):
                self.send_response(status)
                self.send_header('Location', rule['to'])
                self.end_headers()
                return
            return self.serve_file(rule['to'], status)
        super().do_GET()

    def serve_file(self, target, status):
        with open(os.path.join(ROOT, target.lstrip('/')), 'rb') as f:
            body = f.read()
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8935
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
