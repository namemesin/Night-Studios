-- NIGHT STUDIOS backend: player profiles anyone can open by tapping a name on a leaderboard.
-- Run after the other files. Safe to run again.
--
-- Shows only what the leaderboards already show, gathered in one place: name, level, flair, roughly when they
-- joined and were last on, and their best score on every board in every game with its rank. Banned players have
-- no profile, the same as they have no place on the boards. Daily boards only show yesterday's and today's.
-- With a login it also says whether you are friends, so Night Snowboard can offer "Add friend".

create or replace function ng_profile(p_name text, p_token text default null) returns json language plpgsql stable security definer set search_path = public, extensions as $$
declare p ng_players%rowtype; v_me uuid; v_rel text;
begin
  select * into p from ng_players where lower(username) = lower(btrim(coalesce(p_name, '')));
  if not found or p.banned then return json_build_object('error', 'There''s no player by that name.'); end if;
  if p_token is not null then begin v_me := ng_session(p_token); exception when others then v_me := null; end; end if;
  if v_me = p.id then v_rel := 'me';
  elsif v_me is not null then
    select case when f.status = 'friends' then 'friends' when f.a = v_me then 'asked' else 'asked you' end into v_rel
    from ng_friends f where (f.a = v_me and f.b = p.id) or (f.a = p.id and f.b = v_me) limit 1;
  end if;
  return json_build_object('name', p.username, 'level', p.level, 'color', p.color, 'title', p.title, 'joined', date_trunc('day', p.created_at),
    'days', greatest(0, current_date - p.last_seen::date), 'friend', coalesce(v_rel, case when v_me is null then null else 'none' end),
    'bests', (select coalesce(json_agg(x order by x.game, x.period, x.board), '[]'::json) from (
      select s.game, s.board, s.period, s.score,
        (select count(*) + 1 from ng_scores o join ng_players q on q.id = o.player_id where o.game = s.game and o.board = s.board and o.period = s.period and not q.banned and o.score > s.score) as rank,
        (select count(*) from ng_scores o join ng_players q on q.id = o.player_id where o.game = s.game and o.board = s.board and o.period = s.period and not q.banned) as "of"
      from ng_scores s where s.player_id = p.id and (s.period = '' or s.period >= to_char(current_date - 1, 'YYYY-MM-DD'))) x));
end $$;

revoke execute on function ng_profile(text, text) from public;
grant execute on function ng_profile(text, text) to anon, authenticated;
