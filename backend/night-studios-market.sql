-- NIGHT STUDIOS backend: Night Market's leaderboards.
-- Run after the other files. Safe to run again. Nothing else is needed for the game: its saves, logins and run
-- data use the same functions as every other game.
--
-- Fair play: a score may not exceed rate x seconds played + base, nor max_score. The best runs earn well under
-- 100 silver a second, so 400 leaves plenty of room. The game has no fast-forward, so speed stays at the default.
insert into ng_boards (game, board, daily, rate, base, max_score, speed) values
  ('market', 'free', false, 400, 2000, 5000000, 1.15), ('market', 'daily', true, 400, 2000, 5000000, 1.15)
on conflict (game, board) do update set daily = excluded.daily, rate = excluded.rate, base = excluded.base, max_score = excluded.max_score, speed = excluded.speed;
