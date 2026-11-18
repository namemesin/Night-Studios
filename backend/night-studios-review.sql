-- NIGHT STUDIOS backend: admins review scores by hand.
-- Run after night-studios-rejects.sql. Safe to run again.
--
-- The fair-play limits stay as they are. Instead, every score they turn away waits in the Admin panel, and an
-- admin can post it to the board (it was a real run) or dismiss it. Admins can also take a single score off a
-- board, not only all of a player's scores in a game.
--
-- A score over 5,000,000 used to be refused as a bad request, so it never reached ng_rejects. It is now kept like
-- any other rejected score (reason 'over 5,000,000'), so an admin can post it if it was real.

alter table ng_rejects add column if not exists status text not null default '';  -- '', 'posted' or 'dismissed'
alter table ng_rejects add column if not exists reviewed_by uuid references ng_players(id) on delete set null;
alter table ng_rejects add column if not exists reviewed_at timestamptz;
create index if not exists ng_rejects_waiting on ng_rejects (game, created_at desc) where status = '';

-- ng_submit: a score over 5,000,000 is now a rejected score like any other, checked after its run ticket.
do $$
declare d text;
begin
  select pg_get_functiondef('ng_submit(text,text,text,text,int,jsonb,uuid)'::regprocedure) into d;
  if position('''over 5,000,000''' in d) = 0 then
    if position('or p_score > 5000000 or pg_column_size' in d) = 0 or position(E'  if p_game = ''run'' then\n    if p_board not in' in d) = 0 then raise exception 'ng_submit is not in the expected shape'; end if;
    d := replace(d, 'or p_score > 5000000 or pg_column_size', 'or pg_column_size');
    d := replace(d, E'  if p_game = ''run'' then\n    if p_board not in',
      E'  if p_score > 5000000 then return ng_reject(v_id, p_game, p_board, p_period, p_score, p_meta, p_run, ''over 5,000,000'', v_secs, case when p_run is not null then v_real end, 5000000); end if;\n  if p_game = ''run'' then\n    if p_board not in');
    execute d;
  end if;
end $$;

-- The rejected scores waiting for a look, newest first.
create or replace function ng_admin_rejects(p_token text, p_game text) returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform ng_admin(p_token);
  return json_build_object('waiting', (select count(*) from ng_rejects where game = p_game and status = ''),
    'list', (select coalesce(json_agg(x), '[]'::json) from (
      select j.id, p.username as name, j.board, j.period, j.score, j.reason, j.secs, j.real_secs as real, j.score_limit as "limit", j.created_at as at
      from ng_rejects j join ng_players p on p.id = j.player_id
      where j.game = p_game and j.status = '' order by j.created_at desc limit 40) x));
end $$;

-- Post a rejected score to its board (it stands if it beats the player's best there), or dismiss it.
create or replace function ng_admin_review(p_token text, p_id bigint, p_post boolean) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := ng_admin(p_token); j ng_rejects%rowtype; v_old int; v_name text;
begin
  select * into j from ng_rejects where id = p_id for update;
  if not found or j.player_id is null then return json_build_object('error', 'That score is gone.'); end if;
  if j.status <> '' then return json_build_object('error', 'Someone already ' || j.status || ' that score.'); end if;
  select username into v_name from ng_players where id = j.player_id;
  if coalesce(p_post, false) then
    select score into v_old from ng_scores where game = j.game and board = j.board and period = j.period and player_id = j.player_id;
    if v_old is null or j.score > v_old then
      insert into ng_scores (game, board, period, player_id, score, meta, flagged) values (j.game, j.board, j.period, j.player_id, j.score, coalesce(j.meta, '{}'::jsonb), false)
      on conflict (game, board, period, player_id) do update set score = excluded.score, meta = excluded.meta, flagged = false, updated_at = now();
    end if;
  end if;
  update ng_rejects set status = case when coalesce(p_post, false) then 'posted' else 'dismissed' end, reviewed_by = v_admin, reviewed_at = now() where id = p_id;
  return json_build_object('ok', true, 'username', v_name, 'score', j.score, 'posted', coalesce(p_post, false), 'best', coalesce(p_post, false) and (v_old is null or j.score > v_old), 'old', v_old);
end $$;

-- Remove a player's scores in a game: all of them, one board's, or one board on one day.
drop function if exists ng_admin_remove_score(text, text, text);
create or replace function ng_admin_remove_score(p_token text, p_username text, p_game text, p_board text default null, p_period text default null) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_name text; n int;
begin
  perform ng_admin(p_token);
  select id, username into v_id, v_name from ng_players where lower(username) = lower(btrim(p_username));
  if v_id is null then return json_build_object('error', 'No such player.'); end if;
  delete from ng_scores where player_id = v_id and game = p_game and (nullif(p_board, '') is null or board = p_board) and (p_period is null or period = p_period);
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'username', v_name, 'removed', n);
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_admin_rejects(text, text)', 'ng_admin_review(text, bigint, boolean)', 'ng_admin_remove_score(text, text, text, text, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
