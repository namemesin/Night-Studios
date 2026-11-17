-- Night Studios: the owner account, taking games down, per-game gifts, and the fair-play check on scores.
-- This is already applied to the live database. It is kept here so the repository matches the server.
-- Run order for a fresh database: night-games.sql, night-games-social.sql, night-drive.sql,
-- night-studios-run-logs.sql, night-studios-boards.sql, then this file.
--
-- Nothing here holds a secret. The owner is whichever player has is_owner set, and that is set by hand in the
-- database, never from the website:  update ng_players set is_owner = true, is_admin = true where username = '...';

alter table ng_players add column if not exists is_owner boolean not null default false;
alter table ng_config add column if not exists hidden jsonb not null default '[]'::jsonb;
alter table ng_scores add column if not exists flagged boolean not null default false;
alter table ng_boards add column if not exists speed numeric not null default 1.15;
update ng_boards set speed = 2.3 where game = 'watch';
create table if not exists ng_gifts (player_id uuid not null references ng_players(id) on delete cascade, game text not null, total bigint not null default 0, primary key (player_id, game));
create table if not exists ng_runs (id uuid primary key default gen_random_uuid(), player_id uuid not null references ng_players(id) on delete cascade, game text not null, board text not null, period text not null default '', started_at timestamptz not null default now(), used_at timestamptz);
create index if not exists ng_runs_player on ng_runs (player_id, started_at);
alter table ng_gifts enable row level security; alter table ng_runs enable row level security;
revoke all on ng_gifts, ng_runs from anon, authenticated;
update ng_players set is_owner = true, is_admin = true where username = 'Sin';

create or replace function ng_config_json() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'message', case when message_until > now() then message end, 'message_until', case when message_until > now() then message_until end,
    'event', case when event_until > now() then event end, 'event_until', case when event_until > now() then event_until end, 'hidden', hidden, 'now', now())
  from ng_config where id = 1
$$;

create or replace function ng_owner(p_token text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := ng_session(p_token);
begin
  if not exists (select 1 from ng_players where id = v and is_owner) then raise exception 'Not the owner'; end if;
  return v;
end $$;

create or replace function ng_me(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; r ng_players%rowtype;
begin
  begin v_id := ng_session(p_token); exception when others then return json_build_object('error', 'Not logged in'); end;
  select * into r from ng_players where id = v_id;
  return json_build_object('id', r.id, 'username', r.username, 'save', r.save, 'rev', r.save_rev, 'admin', r.is_admin, 'owner', r.is_owner, 'banned', r.banned, 'gift', r.gift, 'config', ng_config_json(),
    'requests', (select count(*) from ng_friends where b = v_id and status = 'pending'));
end $$;

create or replace function ng_game_load(p_token text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; g ng_game_saves%rowtype; r ng_players%rowtype;
begin
  begin v_id := ng_session(p_token); exception when others then return json_build_object('error', 'Not logged in'); end;
  select * into g from ng_game_saves where player_id = v_id and game = p_game;
  select * into r from ng_players where id = v_id;
  return json_build_object('id', v_id, 'username', r.username, 'save', g.save, 'rev', g.rev, 'admin', r.is_admin, 'owner', r.is_owner,
    'gift', coalesce((select total from ng_gifts where player_id = v_id and game = p_game), 0), 'config', ng_config_json());
end $$;

drop function if exists ng_admin_gift(text, text, bigint);
create or replace function ng_admin_gift(p_token text, p_username text, p_flakes bigint, p_game text default 'run') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_name text; n int;
begin
  perform ng_admin(p_token);
  if p_flakes is null or p_flakes < 1 or p_flakes > 1000000 then return json_build_object('error', 'Pick an amount from 1 to 1,000,000.'); end if;
  if p_game is null or p_game !~ '^[a-z]{2,12}$' then return json_build_object('error', 'Pick a game.'); end if;
  if btrim(coalesce(p_username, '')) = '*' then
    if p_game = 'run' then update ng_players set gift = gift + p_flakes;
    else insert into ng_gifts (player_id, game, total) select id, p_game, p_flakes from ng_players on conflict (player_id, game) do update set total = ng_gifts.total + excluded.total; end if;
    get diagnostics n = row_count; return json_build_object('ok', true, 'players', n);
  end if;
  select id, username into v_id, v_name from ng_players where lower(username) = lower(btrim(p_username));
  if v_id is null then return json_build_object('error', 'No such player.'); end if;
  if p_game = 'run' then update ng_players set gift = gift + p_flakes where id = v_id;
  else insert into ng_gifts (player_id, game, total) values (v_id, p_game, p_flakes) on conflict (player_id, game) do update set total = ng_gifts.total + excluded.total; end if;
  return json_build_object('ok', true, 'username', v_name, 'players', 1);
end $$;

create or replace function ng_admin_remove_score(p_token text, p_username text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_name text; n int;
begin
  perform ng_admin(p_token);
  select id, username into v_id, v_name from ng_players where lower(username) = lower(btrim(p_username));
  if v_id is null then return json_build_object('error', 'No such player.'); end if;
  delete from ng_scores where player_id = v_id and game = p_game; get diagnostics n = row_count;
  return json_build_object('ok', true, 'username', v_name, 'removed', n);
end $$;

create or replace function ng_admin_flags(p_token text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  return (select coalesce(json_agg(x), '[]'::json) from (select p.username as name, s.board, s.period, s.score, s.meta, s.updated_at as at from ng_scores s join ng_players p on p.id = s.player_id where s.game = p_game and s.flagged order by s.updated_at desc limit 40) x);
end $$;

create or replace function ng_admin_unflag(p_token text, p_username text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  update ng_scores set flagged = false where game = p_game and player_id = (select id from ng_players where lower(username) = lower(btrim(p_username)));
  return json_build_object('ok', true);
end $$;

create or replace function ng_owner_hide(p_token text, p_game text, p_hidden boolean) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_owner(p_token);
  if p_game is null or p_game !~ '^[a-z]{2,12}$' then return json_build_object('error', 'Pick a game.'); end if;
  update ng_config set hidden = case when coalesce(p_hidden, true) then (select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from jsonb_array_elements_text(hidden || to_jsonb(p_game)) v)
    else (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(hidden) v where v <> p_game) end where id = 1;
  return ng_config_json();
end $$;

create or replace function ng_owner_set_admin(p_token text, p_username text, p_admin boolean) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text;
begin
  perform ng_owner(p_token);
  update ng_players set is_admin = coalesce(p_admin, true) where lower(username) = lower(btrim(p_username)) and not is_owner returning username into v_name;
  if v_name is null then return json_build_object('error', 'No such player (the owner is always an admin).'); end if;
  return json_build_object('ok', true, 'username', v_name, 'admin', coalesce(p_admin, true), 'admins', (select json_agg(username order by username) from ng_players where is_admin));
end $$;

create or replace function ng_owner_reset_board(p_token text, p_game text, p_board text default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform ng_owner(p_token);
  delete from ng_scores where game = p_game and (p_board is null or board = p_board); get diagnostics n = row_count;
  return json_build_object('ok', true, 'removed', n);
end $$;

create or replace function ng_owner_delete_player(p_token text, p_username text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text;
begin
  perform ng_owner(p_token);
  delete from ng_players where lower(username) = lower(btrim(p_username)) and not is_owner returning username into v_name;
  if v_name is null then return json_build_object('error', 'No such player (the owner account can''t be deleted here).'); end if;
  return json_build_object('ok', true, 'username', v_name);
end $$;

create or replace function ng_owner_clear_runs(p_token text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform ng_owner(p_token);
  delete from ng_run_logs where game = p_game; get diagnostics n = row_count;
  return json_build_object('ok', true, 'removed', n);
end $$;

create or replace function ng_owner_info(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_owner(p_token);
  return json_build_object('admins', (select coalesce(json_agg(username order by username), '[]'::json) from ng_players where is_admin), 'hidden', (select hidden from ng_config where id = 1),
    'games', (select coalesce(json_agg(x), '[]'::json) from (select game, count(*) as scores, count(distinct player_id) as players from ng_scores group by 1 order by 1) x));
end $$;

create or replace function ng_run_start(p_token text, p_game text, p_board text, p_period text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_run uuid;
begin
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_board is null or p_board !~ '^[a-z]{2,12}$' then raise exception 'Invalid board'; end if;
  if (select count(*) from ng_runs where player_id = v_id and started_at > now() - interval '10 minutes') >= 150 then return json_build_object('error', 'Slow down a little.'); end if;
  insert into ng_runs (player_id, game, board, period) values (v_id, p_game, p_board, coalesce(p_period, '')) returning id into v_run;
  if random() < 0.02 then delete from ng_runs where started_at < now() - interval '2 days'; end if;
  return json_build_object('run', v_run);
end $$;

drop function if exists ng_submit(text, text, text, text, int, jsonb);
create or replace function ng_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb, p_run uuid default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_dist bigint := ng_num(p_meta->>'dist'); v_secs numeric; v_old int; v_best int; v_count int; v_rank int; v_bad boolean := false; v_limit numeric; v_speed numeric := 1.15; v_real numeric; b ng_boards%rowtype; r ng_runs%rowtype; pl ng_players%rowtype;
begin
  select * into pl from ng_players where id = v_id;
  if pl.banned then return json_build_object('error', 'This account can''t post scores.'); end if;
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_board is null or p_board !~ '^[a-z]{2,12}$' then raise exception 'Invalid board'; end if;
  p_period := coalesce(p_period, '');
  if p_period <> '' then
    if p_period !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid board'; end if;
    if to_date(p_period, 'YYYY-MM-DD') < current_date - 1 or to_date(p_period, 'YYYY-MM-DD') > current_date + 1 then return json_build_object('error', 'That daily course has ended.'); end if;
  end if;
  if p_score is null or p_score < 0 or p_score > 5000000 or pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 600 then raise exception 'Invalid score'; end if;
  if not pl.is_owner and exists (select 1 from ng_config where id = 1 and hidden ? p_game) then return json_build_object('error', 'This game is taken down for now.'); end if;
  if p_run is null then return json_build_object('error', 'Refresh the page to update the game, then your scores will post.'); end if;
  select * into r from ng_runs where id = p_run and player_id = v_id for update;
  if not found or r.game <> p_game or r.board <> p_board or r.period <> p_period or r.used_at is not null then return json_build_object('error', 'That run didn''t pass the fair-play check.'); end if;
  update ng_runs set used_at = now() where id = p_run;
  v_real := extract(epoch from now() - r.started_at);
  v_secs := case when p_meta->>'secs' ~ '^[0-9]{1,6}(\.[0-9]+)?$' then (p_meta->>'secs')::numeric else 0 end;
  if p_game = 'run' then
    if p_board not in ('free', 'daily', 'park') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'park' then v_bad := v_secs < 70 or v_secs > 240; v_limit := 600000;
    else v_bad := v_dist > 400000 or v_dist > 130 * v_secs + 50; v_limit := 700 * v_dist + 30000; end if;
  elsif p_game = 'drive' then
    if p_board not in ('free', 'daily', 'rush') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'rush' then v_bad := v_secs < 20 or v_secs > 120 or v_dist > 140 * v_secs + 100; v_limit := 400000;
    else v_bad := v_dist > 400000 or v_dist > 140 * v_secs + 100; v_limit := 400 * v_dist + 20000; end if;
  else
    select * into b from ng_boards where game = p_game and board = p_board;
    if not found or b.daily <> (p_period <> '') then raise exception 'Invalid board'; end if;
    v_speed := b.speed; v_limit := least(b.max_score, b.rate * v_secs + b.base);
  end if;
  if v_bad or v_secs > v_real * v_speed + 5 or p_score > v_limit then return json_build_object('error', 'That run didn''t pass the fair-play check.'); end if;
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

do $$
declare f text;
begin
  execute 'revoke execute on function ng_owner(text) from public, anon, authenticated';
  foreach f in array array['ng_admin_gift(text, text, bigint, text)', 'ng_admin_remove_score(text, text, text)', 'ng_admin_flags(text, text)', 'ng_admin_unflag(text, text, text)',
    'ng_owner_hide(text, text, boolean)', 'ng_owner_set_admin(text, text, boolean)', 'ng_owner_reset_board(text, text, text)', 'ng_owner_delete_player(text, text)', 'ng_owner_clear_runs(text, text)', 'ng_owner_info(text)',
    'ng_run_start(text, text, text, text)', 'ng_submit(text, text, text, text, int, jsonb, uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Run tickets are only demanded once ng_config.strict is true, so pages published before tickets existed can
-- still post scores. Turn it on after the new site is live:  update ng_config set strict = true where id = 1;
-- ---------------------------------------------------------------------------------------------------------
alter table ng_config add column if not exists strict boolean not null default false;
do $$
declare d text; n int := 0;
begin
  select pg_get_functiondef('ng_submit(text,text,text,text,int,jsonb,uuid)'::regprocedure) into d;
  if position('if p_run is null then return json_build_object(''error'', ''Refresh the page' in d) = 0 then raise exception 'ng_submit is not in the expected shape'; end if;
  d := replace(d, 'if p_run is null then return json_build_object(''error'', ''Refresh the page', 'if p_run is null and (select strict from ng_config where id = 1) then return json_build_object(''error'', ''Refresh the page');
  d := replace(d, 'if not found or r.game <> p_game', 'if p_run is not null and (not found or r.game <> p_game');
  d := replace(d, 'or r.used_at is not null then return', 'or r.used_at is not null) then return');
  d := replace(d, 'v_real := extract(epoch from now() - r.started_at);', 'v_real := coalesce(extract(epoch from now() - r.started_at), 1000000);');
  execute d;
end $$;
update ng_config set hidden = '[]'::jsonb where id = 1;
select position('p_run is not null and (not found' in pg_get_functiondef('ng_submit(text,text,text,text,int,jsonb,uuid)'::regprocedure)) > 0 as patched, (select strict from ng_config) as strict, (select hidden from ng_config) as hidden;

-- Night Keep's leaderboards. Speed is the fastest the game can run (4x) with a little slack.
insert into ng_boards (game, board, daily, rate, base, max_score, speed) values
  ('keep', 'free', false, 3000, 20000, 5000000, 4.3), ('keep', 'daily', true, 3000, 20000, 5000000, 4.3)
on conflict do nothing;
