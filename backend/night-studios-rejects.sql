-- NIGHT STUDIOS backend: keep every rejected score.
-- Run after night-studios-owner-anticheat.sql and night-studios-rally.sql. Safe to run again.
--
-- A score the fair-play check turns away used to vanish. Now it is kept in ng_rejects, never on a leaderboard,
-- with the reason it failed and the numbers the check compared, so a limit that catches real players can be
-- spotted and changed. Nothing deletes these rows.
--
-- Reasons:
--   'no ticket'            the page sent no run ticket (an old page; the player is told to refresh)
--   'ticket not found'     the ticket isn't this player's, or doesn't exist
--   'ticket already used'  the ticket was already spent on another score
--   'ticket for ...'       the ticket was for a different game, board or day
--   'day ended'            a daily score arrived after its day was over
--   'distance'             Night Snowboard / Night Drive: further than the time allows, or more score than the distance allows
--   'run length'           Night Snowboard park / Night Drive rush: a run shorter or longer than the mode allows
--   'time'                 the game's clock ran longer than real time since the ticket (x the game's top speed, + 5 s)
--   'score'                over the board's limit (rate x secs + base, or max_score)
--   'replay'               Night Drift: the replay sent with a finished run didn't pass its check
--
-- To look at them:  select * from ng_rejects order by created_at desc;
--   secs is the game's clock, real_secs the real time since the ticket, score_limit what the score was held to.

create table if not exists ng_rejects (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  player_id uuid references ng_players(id) on delete cascade,
  game text not null, board text not null, period text not null default '',
  score int, meta jsonb, run uuid,
  reason text not null,
  secs numeric, real_secs numeric, score_limit numeric
);
create index if not exists ng_rejects_game on ng_rejects (game, created_at desc);
create index if not exists ng_rejects_player on ng_rejects (player_id, created_at);
alter table ng_rejects enable row level security;
revoke all on ng_rejects from anon, authenticated;

-- Keeps the rejected score and hands back the error the player sees. At most 200 a player an hour, so nobody can
-- fill the table by sending junk.
create or replace function ng_reject(p_player uuid, p_game text, p_board text, p_period text, p_score int, p_meta jsonb, p_run uuid, p_reason text,
  p_secs numeric default null, p_real numeric default null, p_limit numeric default null, p_msg text default null) returns json language plpgsql security definer set search_path = public as $$
begin
  if p_player is not null and (select count(*) from ng_rejects where player_id = p_player and created_at > now() - interval '1 hour') < 200 then
    insert into ng_rejects (player_id, game, board, period, score, meta, run, reason, secs, real_secs, score_limit)
    values (p_player, left(coalesce(p_game, ''), 12), left(coalesce(p_board, ''), 12), left(coalesce(p_period, ''), 10), p_score,
      case when pg_column_size(coalesce(p_meta, '{}'::jsonb)) <= 600 then p_meta end, p_run, p_reason, p_secs, round(p_real, 1), p_limit);
  end if;
  return json_build_object('error', coalesce(p_msg, 'That run didn''t pass the fair-play check.'));
end $$;

-- Same checks as before, in the same order; each way a run can fail now goes through ng_reject with its reason.
create or replace function ng_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb, p_run uuid default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_dist bigint := ng_num(p_meta->>'dist'); v_secs numeric; v_old int; v_best int; v_count int; v_rank int; v_bad boolean := false; v_limit numeric; v_speed numeric := 1.15; v_real numeric; b ng_boards%rowtype; r ng_runs%rowtype; pl ng_players%rowtype;
begin
  select * into pl from ng_players where id = v_id;
  if pl.banned then return json_build_object('error', 'This account can''t post scores.'); end if;
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_board is null or p_board !~ '^[a-z]{2,12}$' then raise exception 'Invalid board'; end if;
  p_period := coalesce(p_period, '');
  if p_game = 'rally' and coalesce(current_setting('ng.rally', true), '') <> '1' then return json_build_object('error', 'Refresh the page to update the game, then your scores will post.'); end if;
  if p_score is null or p_score < 0 or p_score > 5000000 or pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 600 then raise exception 'Invalid score'; end if;
  v_secs := case when p_meta->>'secs' ~ '^[0-9]{1,6}(\.[0-9]+)?$' then (p_meta->>'secs')::numeric else 0 end;
  if p_period <> '' then
    if p_period !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid board'; end if;
    if to_date(p_period, 'YYYY-MM-DD') < current_date - 1 or to_date(p_period, 'YYYY-MM-DD') > current_date + 1 then
      return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'day ended', v_secs, null, null, 'That daily course has ended.');
    end if;
  end if;
  if not pl.is_owner and exists (select 1 from ng_config where id = 1 and hidden ? p_game) then return json_build_object('error', 'This game is taken down for now.'); end if;
  if p_run is null then
    if (select strict from ng_config where id = 1) then
      return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'no ticket', v_secs, null, null, 'Refresh the page to update the game, then your scores will post.');
    end if;
  else
    select * into r from ng_runs where id = p_run and player_id = v_id for update;
    if not found then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'ticket not found', v_secs); end if;
    if r.used_at is not null then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'ticket already used', v_secs, extract(epoch from now() - r.started_at)); end if;
    if r.game <> p_game or r.board <> p_board or r.period <> p_period then
      return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'ticket for ' || r.game || ' ' || r.board || coalesce(' ' || nullif(r.period, ''), ''), v_secs, extract(epoch from now() - r.started_at));
    end if;
    update ng_runs set used_at = now() where id = p_run;
  end if;
  v_real := coalesce(extract(epoch from now() - r.started_at), 1000000);
  if p_game = 'run' then
    if p_board not in ('free', 'daily', 'park') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'park' then v_bad := v_secs < 70 or v_secs > 240; v_limit := 600000;
    -- the distance counts from the top of the mountain, so a Head Start run begins 750 m down with its clock at 0
    else v_bad := v_dist > 400000 or v_dist > 130 * v_secs + 800; v_limit := 700 * v_dist + 30000; end if;
  elsif p_game = 'drive' then
    if p_board not in ('free', 'daily', 'rush') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'rush' then v_bad := v_secs < 20 or v_secs > 120 or v_dist > 140 * v_secs + 100; v_limit := 400000;
    else v_bad := v_dist > 400000 or v_dist > 140 * v_secs + 100; v_limit := 400 * v_dist + 20000; end if;
  else
    select * into b from ng_boards where game = p_game and board = p_board;
    if not found or b.daily <> (p_period <> '') then raise exception 'Invalid board'; end if;
    v_speed := b.speed; v_limit := least(b.max_score, b.rate * v_secs + b.base);
  end if;
  if v_bad then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, case when p_board in ('park', 'rush') then 'run length' else 'distance' end, v_secs, case when p_run is not null then v_real end, v_limit); end if;
  if v_secs > v_real * v_speed + 5 then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'time', v_secs, case when p_run is not null then v_real end, v_limit); end if;
  if p_score > v_limit then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, 'score', v_secs, case when p_run is not null then v_real end, v_limit); end if;
  select score into v_old from ng_scores where game = p_game and board = p_board and period = p_period and player_id = v_id;
  if v_old is null or p_score > v_old then
    insert into ng_scores (game, board, period, player_id, score, meta, flagged) values (p_game, p_board, p_period, v_id, p_score, p_meta, p_score > v_limit * 0.6)
    on conflict (game, board, period, player_id) do update set score = excluded.score, meta = excluded.meta, flagged = excluded.flagged, updated_at = now();
  end if;
  v_best := greatest(coalesce(v_old, 0), p_score);
  select count(*), count(*) filter (where score > v_best) + 1 into v_count, v_rank from ng_scores where game = p_game and board = p_board and period = p_period;
  if random() < 0.02 then delete from ng_scores where period <> '' and period < to_char(current_date - 60, 'YYYY-MM-DD'); end if;
  return json_build_object('ok', true, 'best', v_old is null or p_score > v_old, 'score', v_best, 'rank', v_rank, 'count', v_count);
end $$;

-- Night Drift's replay check now keeps what it turns away too.
create or replace function ng_rally_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb, p_run uuid default null, p_ghost text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_secs numeric; res json;
begin
  if p_game is distinct from 'rally' then raise exception 'Invalid board'; end if;
  v_secs := case when p_meta->>'secs' ~ '^[0-9]{1,6}(\.[0-9]+)?$' then (p_meta->>'secs')::numeric else 0 end;
  if p_score >= 2000 and not ng_rally_ghost_ok(p_ghost, v_secs) then
    return ng_reject(ng_session(p_token), p_game, p_board, p_period, p_score, p_meta, p_run, 'replay', v_secs);
  end if;
  perform set_config('ng.rally', '1', true);
  res := ng_submit(p_token, p_game, p_board, p_period, p_score, p_meta, p_run);
  perform set_config('ng.rally', '', true);
  if p_score >= 2000 and (res->>'best')::boolean then
    insert into ng_ghosts (player_id, game, kind, period, score, data) values (ng_session(p_token), 'rally', p_board, coalesce(p_period, ''), p_score, p_ghost)
    on conflict (player_id, game, kind) do update set period = excluded.period, score = excluded.score, data = excluded.data, updated_at = now();
  end if;
  return res;
end $$;

do $$
declare f text;
begin
  execute 'revoke execute on function ng_reject(uuid, text, text, text, int, jsonb, uuid, text, numeric, numeric, numeric, text) from public, anon, authenticated';
  foreach f in array array['ng_submit(text, text, text, text, int, jsonb, uuid)', 'ng_rally_submit(text, text, text, text, int, jsonb, uuid, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
