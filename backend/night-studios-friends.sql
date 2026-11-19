-- NIGHT STUDIOS backend: friends for every game, shown on the home page.
-- Run after night-studios-profiles.sql. Safe to run again.
--
-- Friends were always one list for the whole studio (ng_friends), but only Night Snowboard showed them, with its
-- own scores. ng_friends_all gives the home page you and every friend with a best and today's daily in every
-- game, plus friend requests both ways. ng_friend_remove ends a friendship (or a request) by name, for the
-- profile card. The daily day is Denver's, the same day every game uses.

create or replace function ng_den_day() returns text language sql stable as $$
  select to_char((now() at time zone 'America/Denver')::date, 'YYYY-MM-DD')
$$;

create or replace function ng_friends_all(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token); v_day text := ng_den_day();
begin
  return json_build_object('day', v_day,
    'players', (select coalesce(json_agg(x), '[]'::json) from (
      select p.id, p.username as name, p.color, p.title, p.level, p.last_seen as seen, p.id = v_me as me,
        (select coalesce(json_object_agg(s.game, s.score), '{}'::json) from ng_scores s where s.player_id = p.id and s.board = 'free' and s.period = '') as best,
        (select coalesce(json_object_agg(s.game, s.score), '{}'::json) from ng_scores s where s.player_id = p.id and s.board = 'daily' and s.period = v_day) as today
      from ng_players p
      where p.id = v_me or (not p.banned and p.id in (select case when f.a = v_me then f.b else f.a end from ng_friends f where f.status = 'friends' and (f.a = v_me or f.b = v_me)))) x),
    'incoming', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.username) order by f.created_at), '[]'::json) from ng_friends f join ng_players p on p.id = f.a where f.b = v_me and f.status = 'pending'),
    'outgoing', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.username) order by f.created_at), '[]'::json) from ng_friends f join ng_players p on p.id = f.b where f.a = v_me and f.status = 'pending'));
end $$;

create or replace function ng_friend_remove(p_token text, p_username text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid := ng_session(p_token); v_them uuid; v_name text; n int;
begin
  select id, username into v_them, v_name from ng_players where lower(username) = lower(btrim(coalesce(p_username, '')));
  if v_them is null then return json_build_object('error', 'There''s no player by that name.'); end if;
  delete from ng_friends where (a = v_me and b = v_them) or (a = v_them and b = v_me); get diagnostics n = row_count;
  return json_build_object('ok', true, 'name', v_name, 'removed', n);
end $$;

-- Profiles: "yesterday's and today's" daily now means Denver's days, like the games.
do $$
declare d text;
begin
  select pg_get_functiondef('ng_profile(text,text)'::regprocedure) into d;
  if position('ng_den_day()' in d) = 0 then
    if position('s.period >= to_char(current_date - 1, ''YYYY-MM-DD'')' in d) = 0 then raise exception 'ng_profile is not in the expected shape'; end if;
    d := replace(d, 's.period >= to_char(current_date - 1, ''YYYY-MM-DD'')', 's.period >= to_char(ng_den_day()::date - 1, ''YYYY-MM-DD'')');
    execute d;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_friends_all(text)', 'ng_friend_remove(text, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
