#!/usr/bin/env python3
"""Builds the Night Studios website into the site/ folder.

  python3 build.py           build once
  python3 build.py --serve   play at http://localhost:8000 (rebuilds every time you refresh)

The site is one page per app: the studio home page, and one page for each game. Each app keeps its
source in its own folder (page.html, styles.css and numbered files in js/). An app's JavaScript all
lives inside one wrapper function, so its files can use each other's code freely; they are joined
in filename order, which is why they are numbered. Add ?offline to a game's address to test it
without touching the server.
"""
import http.server
import shutil
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'site'
PORT = 8000
# (address on the site, source folder, folder whose styles.css it uses)
APPS = [
    ('', 'Hub', 'Night Run'),
    ('run', 'Night Run', 'Night Run'),
    ('drive', 'Night Drive', 'Night Drive'),
]


def build():
    OUT.mkdir(exist_ok=True)
    shutil.copytree(ROOT / 'shared', OUT, dirs_exist_ok=True)
    for path, folder, styles_from in APPS:
        src = ROOT / folder / 'src'
        page = (src / 'page.html').read_bytes()
        styles = (ROOT / styles_from / 'src' / 'styles.css').read_bytes()
        code = b''.join(f.read_bytes() for f in sorted((src / 'js').glob('*.js')))
        for placeholder in (b'{{styles}}\n', b'{{game}}\n'):
            if page.count(placeholder) != 1:
                raise SystemExit(f'Stopped: {folder}/src/page.html needs exactly one {placeholder.decode().strip()} line.')
        target = OUT / path
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_bytes(page.replace(b'{{styles}}\n', styles).replace(b'{{game}}\n', code))


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0].endswith(('/', '/index.html')):
            try:
                build()
            except SystemExit as stop:
                self.send_error(500, explain=str(stop))
                print(stop)
                return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve():
    build()
    handler = partial(DevHandler, directory=str(OUT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler) as server:
        print(f'Night Studios is at http://localhost:{PORT} (press Ctrl+C to stop)')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    if '--serve' in sys.argv[1:]:
        serve()
    else:
        build()
        print('Built the site into site/')
