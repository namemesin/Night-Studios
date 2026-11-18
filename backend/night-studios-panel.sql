-- NIGHT STUDIOS backend: what the reworked Admin and Owner panel needs, and Night Drift's flags.
-- Run after night-studios-review.sql. Safe to run again.
--
--   - Night Drift scores are no longer flagged: its formula always puts a finished run right at its limit, and
--     its replay check (night-studios-rally.sql) is what proves a run. Old Drift flags are cleared.
--   - ng_admin_queue: how much is waiting for review in every game, for the panel's counts.
--   - ng_admin_board: a whole board as admins see it (top 100, flags, banned players marked).
--   - ng_admin_find: search players by name; each comes with their scores in every game.
--   - ng_admin_unflag: can now clear one score's flag instead of all of a player's flags in a game.

do $$
declare d text;
begin
  select pg_get_functiondef('ng_submit(text,text,text,text,int,jsonb,uuid)'::regprocedure) into d;
  if position('p_game <> ''rally'' and p_score > v_limit * 0.6' in d) = 0 then
    if position('p_meta, p_score > v_limit * 0.6)' in d) = 0 then raise exception 'ng_submit is not in the expected shape'; end if;
    d := replace(d, 'p_meta, p_score > v_limit * 0.6)', 'p_meta, p_game <> ''rally'' and p_score > v_limit * 0.6)');
    execute d;
  end if;
end $$;
update ng_scores set flagged = false where game = 'rally' and flagged;

create or replace function ng_admin_queue(p_token text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  return (select coalesce(json_object_agg(game, json_build_object('rejects', r, 'flags', f)), '{}'::json) from (
    select game, sum(r) r, sum(f) f from (
      select game, count(*) r, 0 f from ng_rejects where status = '' group by 1
      union all select game, 0, count(*) from ng_scores where flagged group by 1) u group by 1) x);
end $$;

create or replace function ng_admin_board(p_token text, p_game text, p_board text, p_period text default '') returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  return json_build_object('count', (select count(*) from ng_scores where game = p_game and board = p_board and period = coalesce(p_period, '')),
    'top', (select coalesce(json_agg(x), '[]'::json) from (
      select p.username as name, p.banned, s.score, s.flagged, s.meta, s.updated_at as at
      from ng_scores s join ng_players p on p.id = s.player_id
      where s.game = p_game and s.board = p_board and s.period = coalesce(p_period, '')
      order by s.score desc, s.updated_at limit 100) x));
end $$;

create or replace function ng_admin_find(p_token text, p_query text) returns json language plpgsql security definer set search_path = public, extensions as $$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  perform ng_admin(p_token);
  return (select coalesce(json_agg(x), '[]'::json) from (
    select p.username as name, p.level, p.is_admin as admin, p.is_owner as owner, p.banned, p.created_at as joined, p.last_seen as seen,
      (select coalesce(json_agg(s), '[]'::json) from (select game, board, period, score, flagged, updated_at as at from ng_scores where player_id = p.id order by updated_at desc limit 40) s) as scores,
      (select count(*) from ng_rejects j where j.player_id = p.id and j.status = '') as waiting
    from ng_players p
    where q = '' or lower(p.username) like '%' || replace(replace(q, '%', ''), '_', '\_') || '%'
    order by (lower(p.username) = q) desc, (lower(p.username) like q || '%') desc, p.last_seen desc limit 12) x);
end $$;

drop function if exists ng_admin_unflag(text, text, text);
create or replace function ng_admin_unflag(p_token text, p_username text, p_game text, p_board text default null, p_period text default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform ng_admin(p_token);
  update ng_scores set flagged = false where game = p_game and player_id = (select id from ng_players where lower(username) = lower(btrim(p_username)))
    and (p_board is null or board = p_board) and (p_period is null or period = p_period);
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'cleared', n);
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_admin_queue(text)', 'ng_admin_board(text, text, text, text)', 'ng_admin_find(text, text)', 'ng_admin_unflag(text, text, text, text, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
