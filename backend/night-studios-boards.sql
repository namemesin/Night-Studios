-- NIGHT STUDIOS backend, part 5: leaderboards for any new game without touching code.
-- Run after the other four files. Safe to run again.
--
-- A new game gets its boards by adding rows to ng_boards: which boards exist, whether each is a daily one, and a
-- simple fair-play limit (a score may not exceed rate x seconds played + base, nor max_score). Night Run and
-- Night Drive keep their own distance-based checks inside ng_submit.

create table if not exists ng_boards (
  game text not null, board text not null, daily boolean not null default false,
  rate numeric not null, base int not null, max_score int not null,
  primary key (game, board)
);
alter table ng_boards enable row level security;
revoke all on ng_boards from anon, authenticated;
insert into ng_boards (game, board, daily, rate, base, max_score) values
  ('watch', 'free', false, 600, 5000, 5000000), ('watch', 'daily', true, 600, 5000, 5000000),
  ('heist', 'free', false, 1500, 3000, 5000000), ('heist', 'daily', true, 1500, 3000, 5000000)
on conflict (game, board) do update set daily = excluded.daily, rate = excluded.rate, base = excluded.base, max_score = excluded.max_score;

-- Replaces the earlier versions: games without a hand-written check are judged by their ng_boards row.
create or replace function ng_submit(p_token text, p_game text, p_board text, p_period text, p_score int, p_meta jsonb default '{}'::jsonb) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := ng_session(p_token); v_dist bigint := ng_num(p_meta->>'dist'); v_secs numeric; v_old int; v_best int; v_count int; v_rank int; v_bad boolean := false; b ng_boards%rowtype;
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
  if p_game = 'run' then
    if p_board not in ('free', 'daily', 'park') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'park' then v_bad := v_secs < 70 or v_secs > 240 or p_score > 600000;
    else v_bad := v_dist > 400000 or v_dist > 130 * v_secs + 50 or p_score > 700 * v_dist + 30000; end if;
  elsif p_game = 'drive' then
    if p_board not in ('free', 'daily', 'rush') or (p_board = 'daily') <> (p_period <> '') then raise exception 'Invalid board'; end if;
    if p_board = 'rush' then v_bad := v_secs < 20 or v_secs > 120 or v_dist > 140 * v_secs + 100 or p_score > 400000;
    else v_bad := v_dist > 400000 or v_dist > 140 * v_secs + 100 or p_score > 400 * v_dist + 20000; end if;
  else
    select * into b from ng_boards where game = p_game and board = p_board;
    if not found or b.daily <> (p_period <> '') then raise exception 'Invalid board'; end if;
    v_bad := p_score > b.max_score or p_score > b.rate * v_secs + b.base;
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
