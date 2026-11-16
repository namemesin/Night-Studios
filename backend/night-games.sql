-- NIGHT GAMES backend (Supabase / Postgres)
-- Run this whole file once in the Supabase SQL editor. It is safe to run again: it only adds or replaces.
-- It does NOT touch the old Night Run tables (players, scores, ...). Remove those separately when you're ready.
--
-- Design: the game never reads or writes tables directly. Every table has row level security on with no
-- policies, and the game calls the ng_* functions below with its publishable key. Passwords are bcrypt hashes;
-- login tokens are stored only as SHA-256 hashes.

create extension if not exists pgcrypto with schema extensions;

create table if not exists ng_players (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  pass_hash text not null,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  is_admin boolean not null default false,
  banned boolean not null default false,
  failed_logins int not null default 0,
  locked_until timestamptz,
  save jsonb,
  save_rev bigint not null default 0,
  color text, title text, level smallint not null default 1
);
create unique index if not exists ng_players_name on ng_players (lower(username));

create table if not exists ng_sessions (
  token_hash text primary key,
  player_id uuid not null references ng_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now()
);
create index if not exists ng_sessions_player on ng_sessions (player_id);

-- One row per player per board. period is '' for all-time boards and 'YYYY-MM-DD' for daily ones.
create table if not exists ng_scores (
  game text not null, board text not null, period text not null default '',
  player_id uuid not null references ng_players(id) on delete cascade,
  score int not null, meta jsonb, updated_at timestamptz not null default now(),
  primary key (game, board, period, player_id)
);
create index if not exists ng_scores_rank on ng_scores (game, board, period, score desc);

create table if not exists ng_config (
  id smallint primary key default 1 check (id = 1),
  message text, message_until timestamptz, event text, event_until timestamptz
);
insert into ng_config (id) values (1) on conflict do nothing;

alter table ng_players enable row level security;
alter table ng_sessions enable row level security;
alter table ng_scores enable row level security;
alter table ng_config enable row level security;
revoke all on ng_players, ng_sessions, ng_scores, ng_config from anon, authenticated;

-- ---------- helpers (not callable from the game) ----------
create or replace function ng_num(p text) returns bigint language sql immutable set search_path = public as
$$ select case when p ~ '^[0-9]{1,12}(\.[0-9]+)?$' then floor(p::numeric)::bigint else 0 end $$;

create or replace function ng_session(p_token text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Not logged in'; end if;
  update ng_sessions set last_used = now()
    where token_hash = encode(digest(p_token, 'sha256'), 'hex') and last_used > now() - interval '90 days'
    returning player_id into v;
  if v is null then raise exception 'Not logged in'; end if;
  update ng_players set last_seen = now() where id = v and last_seen < now() - interval '5 minutes';
  return v;
end $$;

create or replace function ng_new_session(p_id uuid) returns text language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(32), 'hex');
begin
  delete from ng_sessions where player_id = p_id and last_used < now() - interval '90 days';
  insert into ng_sessions (token_hash, player_id) values (encode(digest(t, 'sha256'), 'hex'), p_id);
  return t;
end $$;

create or replace function ng_config_json() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'message', case when message_until > now() then message end, 'message_until', case when message_until > now() then message_until end,
    'event', case when event_until > now() then event end, 'event_until', case when event_until > now() then event_until end, 'now', now())
  from ng_config where id = 1
$$;

create or replace function ng_admin(p_token text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := ng_session(p_token);
begin
  if not exists (select 1 from ng_players where id = v and is_admin) then raise exception 'Not an admin'; end if;
  return v;
end $$;

-- ---------- accounts ----------
create or replace function ng_config() returns json language sql stable security definer set search_path = public as $$ select ng_config_json() $$;

create or replace function ng_register(p_username text, p_password text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text := btrim(regexp_replace(coalesce(p_username, ''), '\s+', ' ', 'g')); v_id uuid;
begin
  if v_name !~ '^[A-Za-z0-9 _.-]{2,16}$' then return json_build_object('error', 'Usernames are 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'); end if;
  if p_password is null or char_length(p_password) < 6 or octet_length(p_password) > 72 then return json_build_object('error', 'Passwords need 6 to 72 characters.'); end if;
  if (select count(*) from ng_players where created_at > now() - interval '1 minute') >= 30 then return json_build_object('error', 'Lots of people are signing up right now. Try again in a minute.'); end if;
  insert into ng_players (username, pass_hash) values (v_name, crypt(p_password, gen_salt('bf', 10))) returning id into v_id;
  return json_build_object('token', ng_new_session(v_id), 'id', v_id, 'username', v_name, 'rev', 0, 'admin', false, 'config', ng_config_json());
exception when unique_violation then
  return json_build_object('error', 'That username is taken. Try another one.');
end $$;

create or replace function ng_login(p_username text, p_password text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare r ng_players%rowtype;
begin
  select * into r from ng_players where lower(username) = lower(btrim(coalesce(p_username, '')));
  if not found then
    perform crypt(coalesce(p_password, ''), gen_salt('bf', 10)); -- same work either way, so timing doesn't reveal usernames
    return json_build_object('error', 'Wrong username or password.');
  end if;
  if r.locked_until is not null and r.locked_until > now() then return json_build_object('error', 'Too many wrong tries. Wait a few minutes and try again.'); end if;
  if crypt(coalesce(p_password, ''), r.pass_hash) <> r.pass_hash then
    update ng_players set failed_logins = case when failed_logins + 1 >= 5 then 0 else failed_logins + 1 end,
      locked_until = case when failed_logins + 1 >= 5 then now() + interval '5 minutes' else locked_until end where id = r.id;
    return json_build_object('error', 'Wrong username or password.');
  end if;
  update ng_players set failed_logins = 0, locked_until = null where id = r.id;
  return json_build_object('token', ng_new_session(r.id), 'id', r.id, 'username', r.username, 'save', r.save, 'rev', r.save_rev, 'admin', r.is_admin, 'config', ng_config_json());
end $$;

create or replace function ng_me(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; r ng_players%rowtype;
begin
  begin v_id := ng_session(p_token); exception when others then return json_build_object('error', 'Not logged in'); end;
  select * into r from ng_players where id = v_id;
  return json_build_object('id', r.id, 'username', r.username, 'save', r.save, 'rev', r.save_rev, 'admin', r.is_admin, 'banned', r.banned, 'config', ng_config_json());
end $$;

create or replace function ng_logout(p_token text) returns void language sql security definer set search_path = public, extensions as
$$ delete from ng_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex') $$;

create or replace function ng_change_password(p_token text, p_old text, p_new text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_hash text;
begin
  select pass_hash into v_hash from ng_players where id = v_id;
  if crypt(coalesce(p_old, ''), v_hash) <> v_hash then return json_build_object('error', 'Your current password is wrong.'); end if;
  if p_new is null or char_length(p_new) < 6 or octet_length(p_new) > 72 then return json_build_object('error', 'Passwords need 6 to 72 characters.'); end if;
  update ng_players set pass_hash = crypt(p_new, gen_salt('bf', 10)) where id = v_id;
  delete from ng_sessions where player_id = v_id and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  return json_build_object('ok', true);
end $$;

-- Saves the whole progress copy. p_rev is the save number the game last merged; if another device saved since,
-- nothing is written and the newer copy comes back so the game can merge it and try again.
create or replace function ng_save(p_token text, p_data jsonb, p_rev bigint default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); r ng_players%rowtype;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 131072 then raise exception 'Invalid save'; end if;
  select * into r from ng_players where id = v_id for update;
  if r.save is not null and (p_rev is null or p_rev <> r.save_rev) then return json_build_object('stale', true, 'rev', r.save_rev, 'save', r.save); end if;
  update ng_players set save = p_data, save_rev = save_rev + 1,
    level = least(greatest(ng_num(p_data->>'level'), 1), 99),
    color = case when p_data->'flair'->>'color' ~ '^[a-z]{2,12}$' then p_data->'flair'->>'color' end,
    title = case when p_data->'flair'->>'title' ~ '^[a-z]{2,12}$' then p_data->'flair'->>'title' end
    where id = v_id returning save_rev into r.save_rev;
  return json_build_object('ok', true, 'rev', r.save_rev);
end $$;

-- ---------- leaderboards ----------
create or replace function ng_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_dist bigint := ng_num(p_meta->>'dist'); v_secs numeric; v_old int; v_best int; v_count int; v_rank int;
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
  -- plausibility checks for Night Run: you can't out-score or out-run what the game allows
  if p_game = 'run' then
    if p_board not in ('free', 'daily', 'park') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'park' then
      if v_secs < 70 or v_secs > 240 or p_score > 600000 then return json_build_object('error', 'That run didn''t pass the fair-play check.'); end if;
    elsif v_dist > 400000 or v_dist > 130 * v_secs + 50 or p_score > 700 * v_dist + 30000 then return json_build_object('error', 'That run didn''t pass the fair-play check.');
    end if;
  end if;
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

create or replace function ng_board(p_game text, p_board text, p_period text default '', p_token text default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_mine int;
begin
  p_period := coalesce(p_period, '');
  if p_token is not null then begin v_id := ng_session(p_token); exception when others then v_id := null; end; end if;
  if v_id is not null then select score into v_mine from ng_scores where game = p_game and board = p_board and period = p_period and player_id = v_id; end if;
  return json_build_object(
    'top', (select coalesce(json_agg(x), '[]'::json) from (
      select p.id, p.username as name, p.color, p.title, p.level, s.score, s.meta
      from ng_scores s join ng_players p on p.id = s.player_id
      where s.game = p_game and s.board = p_board and s.period = p_period and not p.banned
      order by s.score desc, s.updated_at limit 25) x),
    'count', (select count(*) from ng_scores s join ng_players p on p.id = s.player_id where s.game = p_game and s.board = p_board and s.period = p_period and not p.banned),
    'me', case when v_mine is not null then json_build_object('score', v_mine, 'rank',
      (select count(*) + 1 from ng_scores s join ng_players p on p.id = s.player_id where s.game = p_game and s.board = p_board and s.period = p_period and not p.banned and s.score > v_mine)) end);
end $$;

-- ---------- admin (the server checks every call) ----------
create or replace function ng_admin_announce(p_token text, p_message text, p_hours numeric) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  update ng_config set message = nullif(left(btrim(coalesce(p_message, '')), 200), ''), message_until = now() + make_interval(mins => (least(greatest(coalesce(p_hours, 0), 0), 720) * 60)::int) where id = 1;
  return ng_config_json();
end $$;

create or replace function ng_admin_event(p_token text, p_event text, p_hours numeric) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  if p_event is not null and p_event !~ '^(flakes|xp|both)[23]$' then p_event := null; end if;
  update ng_config set event = p_event, event_until = now() + make_interval(mins => (least(greatest(coalesce(p_hours, 0), 0), 720) * 60)::int) where id = 1;
  return ng_config_json();
end $$;

create or replace function ng_admin_ban(p_token text, p_username text, p_banned boolean) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text;
begin
  perform ng_admin(p_token);
  update ng_players set banned = coalesce(p_banned, true) where lower(username) = lower(btrim(p_username)) and not is_admin returning username into v_name;
  if v_name is null then return json_build_object('error', 'No such player (admins can''t be banned).'); end if;
  return json_build_object('ok', true, 'username', v_name, 'banned', coalesce(p_banned, true));
end $$;

-- Run from the SQL editor to make your own account an admin:  select ng_make_admin('YourName');
create or replace function ng_make_admin(p_username text) returns text language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  update ng_players set is_admin = true where lower(username) = lower(btrim(p_username)) returning username into v_name;
  return coalesce(v_name || ' is now an admin.', 'No account named ' || p_username || '. Create it in the game first.');
end $$;

-- ---------- who may call what ----------
do $$
declare f text;
begin
  -- nothing is callable unless it is granted below
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ng\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['ng_config()', 'ng_register(text, text)', 'ng_login(text, text)', 'ng_me(text)', 'ng_logout(text)', 'ng_change_password(text, text, text)',
    'ng_save(text, jsonb, bigint)', 'ng_submit(text, text, text, text, int, jsonb)', 'ng_board(text, text, text, text)',
    'ng_admin_announce(text, text, numeric)', 'ng_admin_event(text, text, numeric)', 'ng_admin_ban(text, text, boolean)'] loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
