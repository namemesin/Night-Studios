-- NIGHT GAMES backend, part 2: friends, friend ghosts, admin gifts and the admin overview.
-- Run after night-games.sql. Safe to run again.

alter table ng_players add column if not exists gift bigint not null default 0;

create table if not exists ng_friends (
  a uuid not null references ng_players(id) on delete cascade,
  b uuid not null references ng_players(id) on delete cascade,
  status text not null default 'pending', created_at timestamptz not null default now(),
  primary key (a, b)
);
create index if not exists ng_friends_b on ng_friends (b);
-- A player's best-run replay per game: kind 'free' (best ever) or 'daily' (period = that day).
create table if not exists ng_ghosts (
  player_id uuid not null references ng_players(id) on delete cascade,
  game text not null, kind text not null, period text not null default '',
  score int not null, data text not null, updated_at timestamptz not null default now(),
  primary key (player_id, game, kind)
);
alter table ng_friends enable row level security;
alter table ng_ghosts enable row level security;
revoke all on ng_friends, ng_ghosts from anon, authenticated;

create or replace function ng_are_friends(p_x uuid, p_y uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from ng_friends where status = 'friends' and ((a = p_x and b = p_y) or (a = p_y and b = p_x))) $$;

-- replaces the first version: also reports admin gifts and waiting friend requests
create or replace function ng_me(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; r ng_players%rowtype;
begin
  begin v_id := ng_session(p_token); exception when others then return json_build_object('error', 'Not logged in'); end;
  select * into r from ng_players where id = v_id;
  return json_build_object('id', r.id, 'username', r.username, 'save', r.save, 'rev', r.save_rev, 'admin', r.is_admin, 'banned', r.banned, 'gift', r.gift, 'config', ng_config_json(),
    'requests', (select count(*) from ng_friends where b = v_id and status = 'pending'));
end $$;

create or replace function ng_friend_request(p_token text, p_username text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token); v_them uuid; v_name text;
begin
  select id, username into v_them, v_name from ng_players where lower(username) = lower(btrim(coalesce(p_username, '')));
  if v_them is null then return json_build_object('error', 'No player is called ' || left(btrim(coalesce(p_username, '')), 16) || '.'); end if;
  if v_them = v_me then return json_build_object('error', 'That''s you.'); end if;
  if ng_are_friends(v_me, v_them) then return json_build_object('error', 'You''re already friends with ' || v_name || '.'); end if;
  -- they already asked you: this makes you friends
  if exists (select 1 from ng_friends where a = v_them and b = v_me) then
    update ng_friends set status = 'friends' where a = v_them and b = v_me;
    return json_build_object('ok', true, 'friends', true, 'name', v_name);
  end if;
  if exists (select 1 from ng_friends where a = v_me and b = v_them) then return json_build_object('ok', true, 'name', v_name); end if;
  if (select count(*) from ng_friends where a = v_me or b = v_me) >= 100 then return json_build_object('error', 'You can have up to 100 friends and requests.'); end if;
  insert into ng_friends (a, b) values (v_me, v_them);
  return json_build_object('ok', true, 'name', v_name);
end $$;

-- accept a request, or (accept = false) decline it, cancel yours, or remove a friend
create or replace function ng_friend_respond(p_token text, p_id uuid, p_accept boolean) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token);
begin
  if coalesce(p_accept, false) then update ng_friends set status = 'friends' where a = p_id and b = v_me and status = 'pending';
  else delete from ng_friends where (a = p_id and b = v_me) or (a = v_me and b = p_id); end if;
  return json_build_object('ok', true);
end $$;

create or replace function ng_friends(p_token text, p_period text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token);
begin
  return json_build_object(
    'friends', (select coalesce(json_agg(x order by x.best desc nulls last, x.name), '[]'::json) from (
      select p.id, p.username as name, p.color, p.title, p.level, p.last_seen,
        (select score from ng_scores s where s.player_id = p.id and s.game = 'run' and s.board = 'free' and s.period = '') as best,
        (select score from ng_scores s where s.player_id = p.id and s.game = 'run' and s.board = 'daily' and s.period = coalesce(p_period, '')) as daily,
        (select score from ng_scores s where s.player_id = p.id and s.game = 'run' and s.board = 'park' and s.period = '') as park,
        exists (select 1 from ng_ghosts g where g.player_id = p.id and g.game = 'run' and g.kind = 'free') as ghost_free,
        exists (select 1 from ng_ghosts g where g.player_id = p.id and g.game = 'run' and g.kind = 'daily' and g.period = coalesce(p_period, '')) as ghost_daily
      from ng_friends f join ng_players p on p.id = case when f.a = v_me then f.b else f.a end
      where f.status = 'friends' and (f.a = v_me or f.b = v_me)) x),
    'incoming', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.username) order by f.created_at), '[]'::json) from ng_friends f join ng_players p on p.id = f.a where f.b = v_me and f.status = 'pending'),
    'outgoing', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.username) order by f.created_at), '[]'::json) from ng_friends f join ng_players p on p.id = f.b where f.a = v_me and f.status = 'pending'));
end $$;

create or replace function ng_save_ghost(p_token text, p_game text, p_kind text, p_period text, p_score int, p_data text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token); g ng_ghosts%rowtype;
begin
  p_period := coalesce(p_period, '');
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_kind not in ('free', 'daily') or p_period !~ '^(\d{4}-\d{2}-\d{2})?$' or (p_kind = 'daily') <> (p_period <> '') then return json_build_object('error', 'Bad ghost'); end if;
  if p_data is null or char_length(p_data) > 200000 or p_data !~ '^[A-Za-z0-9+/=]+$' or p_score is null or p_score < 0 or p_score > 5000000 then return json_build_object('error', 'Bad ghost'); end if;
  select * into g from ng_ghosts where player_id = v_me and game = p_game and kind = p_kind;
  if g.player_id is not null and not (p_score > g.score or p_period > g.period) then return json_build_object('ok', true, 'kept', true); end if;
  insert into ng_ghosts (player_id, game, kind, period, score, data) values (v_me, p_game, p_kind, p_period, p_score, p_data)
  on conflict (player_id, game, kind) do update set period = excluded.period, score = excluded.score, data = excluded.data, updated_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function ng_get_ghost(p_token text, p_id uuid, p_game text, p_kind text, p_period text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token); g ng_ghosts%rowtype;
begin
  if p_id <> v_me and not ng_are_friends(v_me, p_id) then return json_build_object('error', 'You can only race your friends'' ghosts.'); end if;
  select * into g from ng_ghosts where player_id = p_id and game = p_game and kind = p_kind and period = coalesce(p_period, '');
  if g.player_id is null then return json_build_object('error', 'No ghost to race yet.'); end if;
  return json_build_object('score', g.score, 'data', g.data, 'name', (select username from ng_players where id = p_id));
end $$;

-- Flakes from an admin. The total ever gifted is kept on the player; the game pays out whatever it hasn't seen yet.
-- Username '*' gifts every player.
create or replace function ng_admin_gift(p_token text, p_username text, p_flakes bigint) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text; n int;
begin
  perform ng_admin(p_token);
  if p_flakes is null or p_flakes < 1 or p_flakes > 1000000 then return json_build_object('error', 'Pick an amount from 1 to 1,000,000.'); end if;
  if btrim(coalesce(p_username, '')) = '*' then update ng_players set gift = gift + p_flakes; get diagnostics n = row_count; return json_build_object('ok', true, 'players', n); end if;
  update ng_players set gift = gift + p_flakes where lower(username) = lower(btrim(p_username)) returning username into v_name;
  if v_name is null then return json_build_object('error', 'No such player.'); end if;
  return json_build_object('ok', true, 'username', v_name, 'players', 1);
end $$;

create or replace function ng_admin_overview(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  return json_build_object(
    'players', (select count(*) from ng_players), 'active', (select count(*) from ng_players where last_seen > now() - interval '24 hours'),
    'new', (select count(*) from ng_players where created_at > now() - interval '24 hours'), 'banned', (select count(*) from ng_players where banned),
    'scores', (select count(*) from ng_scores),
    'recent', (select coalesce(json_agg(x), '[]'::json) from (select username as name, level, banned, is_admin as admin, last_seen,
      (select score from ng_scores s where s.player_id = p.id and s.game = 'run' and s.board = 'free' and s.period = '') as best from ng_players p order by last_seen desc limit 30) x),
    'config', ng_config_json());
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_are_friends(uuid, uuid)'] loop execute format('revoke execute on function %s from public, anon, authenticated', f); end loop;
  foreach f in array array['ng_friend_request(text, text)', 'ng_friend_respond(text, uuid, boolean)', 'ng_friends(text, text)', 'ng_save_ghost(text, text, text, text, int, text)',
    'ng_get_ghost(text, uuid, text, text, text)', 'ng_admin_gift(text, text, bigint)', 'ng_admin_overview(text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
