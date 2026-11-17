#!/usr/bin/env python3
"""Builds the Night Studios website into the site/ folder.

  python3 build.py             build once
  python3 build.py --serve     play at http://localhost:8000 (rebuilds every time you refresh)
  python3 build.py --release   build and stamp each app's version number (the publish step runs this)

The site is one page per app: the studio home page, and one page for each game. Each app keeps its
source in its own folder (page.html, styles.css and numbered files in js/). Newer games are built on
the shared code in kit/ (saves, login, leaderboards, run data, common screens) and only add their own
rules, drawing and menus. An app's JavaScript all lives inside one wrapper function, so its files
can use each other's code freely; they are joined in filename order, which is why they are numbered.
Add ?offline to a game's address to test it without touching the server.

VERSIONS. The home page and every game have their own version number. Each app's folder has a VERSION
file holding the part a person decides, like 1.0 or 1.1. Publishing adds the last number by itself:
the first publish of 1.0 is "1.0", and every later publish that changes that app is 1.0.1, 1.0.2 and
so on. To mark a bigger update, change that app's VERSION file (1.0 to 1.1, never to 2.0 unless the
owner asks) and the count starts again: 1.1, 1.1.1, 1.1.2. Each published version is saved as a tag
like run-v1.0.2, which is how the next publish knows where to continue.
"""
import http.server
import json
import shutil
import subprocess
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'site'
KIT = ROOT / 'kit'
PORT = 8000
# id: used in version tags. path: address on the site. folder: where its source lives.
# styles: the folder whose styles.css it uses. kit: built on the shared kit?
# Every game is always built. Taking a game down is the owner's switch in the admin panel, not a change here.
APPS = [
    dict(id='hub', name='Night Studios', path='', folder='Hub', styles='Night Run', kit=False),
    dict(id='run', name='Night Run', path='run', folder='Night Run', styles='Night Run', kit=False),
    dict(id='watch', name='Night Watch', path='watch', folder='Night Watch', styles='Night Run', kit=True),
    dict(id='heist', name='Night Heist', path='heist', folder='Night Heist', styles='Night Run', kit=True),
    dict(id='keep', name='Night Keep', path='keep', folder='Night Keep', styles='Night Run', kit=True),
    dict(id='market', name='Night Market', path='market', folder='Night Market', styles='Night Run', kit=True),
    dict(id='drive', name='Night Drive', path='drive', folder='Night Drive', styles='Night Drive', kit=False),
]


def build():
    OUT.mkdir(exist_ok=True)
    shutil.copytree(ROOT / 'shared', OUT, dirs_exist_ok=True)
    for app in APPS:
        src = ROOT / app['folder'] / 'src'
        page = (src / 'page.html').read_bytes()
        styles = (ROOT / app['styles'] / 'src' / 'styles.css').read_bytes()
        theme = src / 'theme.css'  # a game's own colors and extras, on top of the base styles
        if theme.exists():
            styles += theme.read_bytes()
        files = sorted((src / 'js').glob('*.js'))
        if app['kit']:
            # a kit game: its 00-config.js (what the game is), then the shared kit, then the rest of the game
            files = files[:1] + sorted(KIT.glob('*.js')) + files[1:]
        code = b''.join(f.read_bytes() for f in files)
        for placeholder in (b'{{styles}}\n', b'{{game}}\n'):
            if page.count(placeholder) != 1:
                raise SystemExit(f"Stopped: {app['folder']}/src/page.html needs exactly one {placeholder.decode().strip()} line.")
        target = OUT / app['path']
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_bytes(page.replace(b'{{styles}}\n', styles).replace(b'{{game}}\n', code))
    (OUT / 'versions.json').write_text(json.dumps({app['id']: 'dev' for app in APPS}) + '\n')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)


def app_paths(app):
    """Everything that, when changed, means this app changed."""
    paths = [app['folder'], 'shared']
    if app['styles'] != app['folder']:
        paths.append(f"{app['styles']}/src/styles.css")
    if app['kit']:
        paths.append('kit')
    return paths


def next_version(app):
    """Works out this app's version from its VERSION file and the tags of what was published before."""
    base = (ROOT / app['folder'] / 'VERSION').read_text().strip()
    prefix = f"{app['id']}-v{base}"
    counts = []
    for tag in git('tag', '--list', prefix, prefix + '.*').stdout.split():
        rest = tag[len(prefix):]
        if rest == '':
            counts.append(0)
        elif rest[1:].isdigit():
            counts.append(int(rest[1:]))
    if not counts:
        return base, True  # the first publish of this base number
    last = max(counts)
    last_tag = prefix if last == 0 else f'{prefix}.{last}'
    changed = git('diff', '--quiet', last_tag, 'HEAD', '--', *app_paths(app)).returncode != 0
    if changed:
        return f'{base}.{last + 1}', True
    return (base if last == 0 else f'{base}.{last}'), False


def release():
    """Builds the site, stamps every page with its own version, and lists the versions that are new."""
    build()
    versions, fresh = {}, []
    for app in APPS:
        version, new = next_version(app)
        versions[app['id']] = version
        page = OUT / app['path'] / 'index.html'
        html = page.read_text()
        if html.count("APP_VERSION = 'dev'") != 1:
            raise SystemExit(f"Stopped: {app['folder']} needs exactly one APP_VERSION = 'dev' line to stamp.")
        page.write_text(html.replace("APP_VERSION = 'dev'", f"APP_VERSION = '{version}'"))
        if new:
            fresh.append(f"{app['id']}-v{version}\t{app['name']} {version}\t{app['path'] + '/' if app['path'] else ''}")
        print(f"{app['name']}: {version}{' (new)' if new else ''}")
    # the offline copy is refreshed whenever any app's version changes
    worker = OUT / 'sw.js'
    stamp = '-'.join(f'{k}{v}' for k, v in versions.items())
    code = worker.read_text()
    if code.count("'night-studios-dev'") != 1:
        raise SystemExit("Stopped: shared/sw.js needs exactly one 'night-studios-dev' cache name to stamp.")
    worker.write_text(code.replace("'night-studios-dev'", f"'night-studios-{stamp}'"))
    (OUT / 'versions.json').write_text(json.dumps(versions) + '\n')
    # one line per new version for the publish step: tag, release title, address on the site
    (ROOT / '.release').write_text(''.join(line + '\n' for line in fresh))


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
    elif '--release' in sys.argv[1:]:
        release()
    else:
        build()
        print('Built the site into site/')
