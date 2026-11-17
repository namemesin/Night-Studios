# Night Studios

Arcade games after dark, all on one site: https://namemesin.github.io/night-run/

- `Hub/` is the home page: pick a game, log in once for all of them.
- `Night Run/` and `Night Drive/` are the games. Each keeps its own progress, currency and leaderboards.
- `shared/` holds the icons, app manifest and offline support for the whole site.
- `backend/` is the Supabase database script (run the three files in the order night-games, night-games-social, night-drive).

Build with `python3 build.py`, or play locally with `python3 build.py --serve` at http://localhost:8000.
Add `?offline` to a game's address to test without touching the server. Pushing to `main` publishes the site.
