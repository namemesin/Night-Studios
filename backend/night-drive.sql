-- NIGHT DRIVE on the Night Studios backend (Supabase / Postgres)
-- Run after Night Run's backend/night-games.sql and night-games-social.sql. Safe to run again.
--
-- Logins are studio-wide (ng_players, ng_login, ng_register). Each game's progress is its own row in
-- ng_game_saves, so currency, unlocks and stats never mix between games. Scores go to ng_scores with game 'drive'.

create table if not exists ng_game_saves (
  player_id uuid not null references ng_players(id) on delete cascade,
  game text not null, save jsonb not null, rev bigint not null default 1, updated_at timestamptz not null default now(),
  primary key (player_id, game)
);
alter table ng_game_saves enable row level security;
revoke all on ng_game_saves from anon, authenticated;

create or replace function ng_game_load(p_token text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; g ng_game_saves%rowtype;
begin
  begin v_id := ng_session(p_token); exception when others then return json_build_object('error', 'Not logged in'); end;
  select * into g from ng_game_saves where player_id = v_id and game = p_game;
  return json_build_object('id', v_id, 'username', (select username from ng_players where id = v_id), 'save', g.save, 'rev', g.rev);
end $$;

-- p_rev is the save number the game last merged. If another device saved since, nothing is written and the newer
-- copy comes back so the game can merge it and try again.
create or replace function ng_game_save(p_token text, p_game text, p_data jsonb, p_rev bigint default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); g ng_game_saves%rowtype;
begin
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 131072 then raise exception 'Invalid save'; end if;
  select * into g from ng_game_saves where player_id = v_id and game = p_game for update;
  if found then
    if p_rev is null or p_rev <> g.rev then return json_build_object('stale', true, 'rev', g.rev, 'save', g.save); end if;
    update ng_game_saves set save = p_data, rev = rev + 1, updated_at = now() where player_id = v_id and game = p_game returning rev into g.rev;
    return json_build_object('ok', true, 'rev', g.rev);
  end if;
  insert into ng_game_saves (player_id, game, save) values (v_id, p_game, p_data) on conflict do nothing;
  if not found then
    select * into g from ng_game_saves where player_id = v_id and game = p_game;
    return json_build_object('stale', true, 'rev', g.rev, 'save', g.save);
  end if;
  return json_build_object('ok', true, 'rev', 1);
end $$;

-- Replaces Night Run's version: the same function now knows the fair-play limits of both games.
create or replace function ng_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_dist bigint := ng_num(p_meta->>'dist'); v_secs numeric; v_old int; v_best int; v_count int; v_rank int; v_bad boolean := false;
begin
  if (select banned from ng_players where id = v_id) then return json_build_object('error', 'This account can''t post scores.'); end if;
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_board is null or p_board !~ '^[a-z]{2,12}$' then raise exception 'Invalid board'; end if;
  p_period := coalesce(p_period, '');
  if p_period <> '' then
    if p_period !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid board'; end if;
    if to_date(p_period, 'YYYY-MM-DD') < current_date - 1 or to_date(p_period, 'YYYY-MM-DD') > current_date + 1 then return json_build_object('error', 'That daily course has ended.'); end if;
  end if;
  if p_score is null or p_score < 0 or p_score > 5000000 or pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 600 then raise exception 'Invalid score'; end if;
  v_secs := case when p_meta->>'secs' ~ '^[0-9]{1,6}(\.[0-9]+)?$' then (p_meta->>'secs')::numeric else 0 end;
  if (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
  if p_game = 'run' then
    if p_board not in ('free', 'daily', 'park') then raise exception 'Invalid board'; end if;
    if p_board = 'park' then v_bad := v_secs < 70 or v_secs > 240 or p_score > 600000;
    else v_bad := v_dist > 400000 or v_dist > 130 * v_secs + 50 or p_score > 700 * v_dist + 30000; end if;
  elsif p_game = 'drive' then
    if p_board not in ('free', 'daily', 'rush') then raise exception 'Invalid board'; end if;
    if p_board = 'rush' then v_bad := v_secs < 20 or v_secs > 120 or v_dist > 140 * v_secs + 100 or p_score > 400000;
    else v_bad := v_dist > 400000 or v_dist > 140 * v_secs + 100 or p_score > 400 * v_dist + 20000; end if;
  else raise exception 'Invalid board';
  end if;
  if v_bad then return json_build_object('error', 'That run didn''t pass the fair-play check.'); end if;
  select score into v_old from ng_scores where game = p_game and board = p_board and period = p_period and player_id = v_id;
  if v_old is null or p_score > v_old then
    insert into ng_scores (game, board, period, player_id, score, meta) values (p_game, p_board, p_period, v_id, p_score, p_meta)
    on conflict (game, board, period, player_id) do update set score = excluded.score, meta = excluded.meta, updated_at = now();
  end if;
  v_best := greatest(coalesce(v_old, 0), p_score);
  select count(*), count(*) filter (where score > v_best) + 1 into v_count, v_rank from ng_scores where game = p_game and board = p_board and period = p_period;
  if random() < 0.02 then delete from ng_scores where period <> '' and period < to_char(current_date - 60, 'YYYY-MM-DD'); end if;
  return json_build_object('ok', true, 'best', v_old is null or p_score > v_old, 'score', v_best, 'rank', v_rank, 'count', v_count);
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_game_load(text, text)', 'ng_game_save(text, text, jsonb, bigint)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
