-- NIGHT STUDIOS backend: Night Rally's leaderboards.
-- Run after the other files. Safe to run again. Nothing else is needed for the game: its saves, logins and run
-- data use the same functions as every other game.
--
-- Night Rally is a time trial, so a faster run is a higher score: 2000 for finishing, plus 200 for every second
-- under two minutes. That is score = 26000 - 200 x seconds, which is exactly what the fair-play row checks (a score
-- may not exceed rate x seconds played + base), with 50 points of room because the game sends the time rounded to a
-- tenth of a second. Nobody can lap the track three times in under 35 seconds, so max_score stops at 19000.
-- The game has no fast-forward, so speed stays at the default.
--
-- That row alone only proves a run did not take LONGER than the real time since it started. The second half of
-- this file covers the other side: a finished rally has to arrive with its replay, and the replay has to be a drive
-- of the right length for the time it claims.
insert into ng_boards (game, board, daily, rate, base, max_score, speed) values
  ('rally', 'free', false, -200, 26050, 19000, 1.15), ('rally', 'daily', true, -200, 26050, 19000, 1.15)
on conflict (game, board) do update set daily = excluded.daily, rate = excluded.rate, base = excluded.base, max_score = excluded.max_score, speed = excluded.speed;

-- ---------------------------------------------------------------------------------------------------------
-- Replays. Night Rally sends the replay of a finished run with its score. The replay is the same small text the
-- game keeps for your own ghost: five letters a sample, five samples a second (two letters across, two letters
-- down, one for the way the car faces). It is stored in ng_ghosts, the table Night Run's friend ghosts already use.
--
-- What the server checks before a finishing score counts:
--   - the replay has the number of samples its time says it should (so the time and the replay agree)
--   - the car never jumps further between samples than a car can go (a few jumps are allowed: being put back
--     on the road after straying is one)
--   - the drive is at least about three laps long, ends where it started, and is not faster overall than a fully
--     upgraded car can average
-- What it still cannot do: it does not know the shape of the track, so it cannot replay the drive and prove every
-- corner. A faked run now has to come with a believable replay that everyone racing the leader will watch.
-- ---------------------------------------------------------------------------------------------------------
create or replace function ng_rally_ghost_ok(p_data text, p_secs numeric) returns boolean language plpgsql immutable set search_path = public as $$
declare abc constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  n int; x int; y int; px int; py int; x0 int; y0 int; hop numeric; total numeric := 0; jumps int := 0;
begin
  if p_data is null or p_secs is null or char_length(p_data) > 4000 or char_length(p_data) % 5 <> 0 or p_data !~ '^[A-Za-z0-9+/]+$' then return false; end if;
  n := char_length(p_data) / 5;
  if abs(n - (p_secs * 5 + 2)) > 3 then return false; end if;
  for i in 0 .. n - 1 loop
    x := (strpos(abc, substr(p_data, i * 5 + 1, 1)) - 1) * 64 + strpos(abc, substr(p_data, i * 5 + 2, 1)) - 1;
    y := (strpos(abc, substr(p_data, i * 5 + 3, 1)) - 1) * 64 + strpos(abc, substr(p_data, i * 5 + 4, 1)) - 1;
    if i = 0 then x0 := x; y0 := y;
    else
      hop := sqrt((x - px) * (x - px) + (y - py) * (y - py));
      if hop > 600 then return false; end if;
      if hop > 150 then jumps := jumps + 1; end if;
      total := total + hop;
    end if;
    px := x; py := y;
  end loop;
  return jumps <= 25 and total >= 15000 and total <= p_secs * 480 + 300 and sqrt((x - x0) * (x - x0) + (y - y0) * (y - y0)) < 400;
end $$;

-- The game posts its scores here instead of to ng_submit. Same answer as ng_submit; a finishing score (2000 or
-- more) needs a replay that passes the check above, and a new personal best keeps its replay.
create or replace function ng_rally_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb, p_run uuid default null, p_ghost text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_secs numeric; res json;
begin
  if p_game is distinct from 'rally' then raise exception 'Invalid board'; end if;
  v_secs := case when p_meta->>'secs' ~ '^[0-9]{1,6}(\.[0-9]+)?$' then (p_meta->>'secs')::numeric else 0 end;
  if p_score >= 2000 and not ng_rally_ghost_ok(p_ghost, v_secs) then return json_build_object('error', 'That run didn''t pass the fair-play check.'); end if;
  perform set_config('ng.rally', '1', true);
  res := ng_submit(p_token, p_game, p_board, p_period, p_score, p_meta, p_run);
  perform set_config('ng.rally', '', true);
  if p_score >= 2000 and (res->>'best')::boolean then
    insert into ng_ghosts (player_id, game, kind, period, score, data) values (ng_session(p_token), 'rally', p_board, coalesce(p_period, ''), p_score, p_ghost)
    on conflict (player_id, game, kind) do update set period = excluded.period, score = excluded.score, data = excluded.data, updated_at = now();
  end if;
  return res;
end $$;

-- ng_submit turns away a Night Rally score that did not come through ng_rally_submit, so the replay check cannot
-- be skipped. This adds one line to the function that is already on the server. Safe to run again.
do $$
declare d text;
begin
  select pg_get_functiondef('ng_submit(text,text,text,text,int,jsonb,uuid)'::regprocedure) into d;
  if position('ng.rally' in d) = 0 then
    if position('p_period := coalesce(p_period, '''');' in d) = 0 then raise exception 'ng_submit is not in the expected shape'; end if;
    d := replace(d, 'p_period := coalesce(p_period, '''');', 'p_period := coalesce(p_period, ''''); if p_game = ''rally'' and coalesce(current_setting(''ng.rally'', true), '''') <> ''1'' then return json_build_object(''error'', ''Refresh the page to update the game, then your scores will post.''); end if;');
    execute d;
  end if;
end $$;

-- The replay of whoever leads a Night Rally board, for everyone to race. Only handed out while it is the replay
-- of the score that is actually on the board. Night Run's ghosts stay friends-only: this answers for rally alone.
create or replace function ng_top_ghost(p_game text, p_kind text, p_period text default '') returns json language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object('id', t.id, 'name', t.username, 'score', t.score, 'data', g.data)
    from (select p.id, p.username, s.score from ng_scores s join ng_players p on p.id = s.player_id
          where p_game = 'rally' and s.game = p_game and s.board = p_kind and s.period = coalesce(p_period, '') and not p.banned
          order by s.score desc, s.updated_at limit 1) t
    join ng_ghosts g on g.player_id = t.id and g.game = p_game and g.kind = p_kind and g.period = coalesce(p_period, '') and g.score = t.score),
    json_build_object('none', true));
$$;

do $$
declare f text;
begin
  execute 'revoke execute on function ng_rally_ghost_ok(text, numeric) from public, anon, authenticated';
  foreach f in array array['ng_rally_submit(text, text, text, text, int, jsonb, uuid, text)', 'ng_top_ghost(text, text, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
