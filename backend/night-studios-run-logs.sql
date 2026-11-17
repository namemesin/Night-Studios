-- NIGHT STUDIOS backend, part 4: run data for balancing, for every game.
-- Run after night-games.sql, night-games-social.sql and night-drive.sql. Safe to run again.
--
-- Each game reports every run that ends (and restarts and quits): which game and mode, what ended it, how far,
-- the score, the zone, how long it took, where across the screen it ended, and a small bundle of game-specific
-- numbers. No names or personal details: a signed-in run is linked to the account only so repeat runs by one
-- player can be counted once, and a random device id does the same for guests. Players can turn it off in Settings.

create table if not exists ng_run_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  game text not null, mode text, ending text not null,
  meters int not null default 0, score int not null default 0, zone smallint not null default 0, secs numeric(8,1),
  x smallint, run_no int, touch boolean, version text,
  player_id uuid references ng_players(id) on delete set null, device text, stats jsonb
);
create index if not exists ng_run_logs_game on ng_run_logs (game, created_at);
create index if not exists ng_run_logs_device on ng_run_logs (device, created_at);
alter table ng_run_logs enable row level security;
revoke all on ng_run_logs from anon, authenticated;

create or replace function ng_log_run(p_game text, p_data jsonb, p_device text default null, p_token text default null) returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_end text := p_data->>'end'; v_dev text := left(p_device, 40);
begin
  if p_game is null or p_game !~ '^[a-z]{2,12}$' or p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 4000 then return; end if;
  if v_end is null or v_end !~ '^[a-z]{2,12}$' then return; end if;
  if ng_num(p_data->>'m') > 400000 or ng_num(p_data->>'s') > 5000000 then return; end if;
  if v_dev is not null and v_dev !~ '^[a-z0-9]{8,40}$' then v_dev := null; end if;
  -- flood guards: one run per device every 2 seconds, and a cap for everyone
  if v_dev is not null and exists (select 1 from ng_run_logs where device = v_dev and created_at > now() - interval '2 seconds') then return; end if;
  if (select count(*) from ng_run_logs where created_at > now() - interval '1 minute') >= 600 then return; end if;
  if p_token is not null then begin v_id := ng_session(p_token); exception when others then v_id := null; end; end if;
  insert into ng_run_logs (game, mode, ending, meters, score, zone, secs, x, run_no, touch, version, player_id, device, stats)
  values (p_game, left(coalesce(p_data->>'mode', ''), 12), v_end, ng_num(p_data->>'m'), ng_num(p_data->>'s'), least(ng_num(p_data->>'z'), 20),
    least(ng_num(p_data->>'t'), 99999), least(ng_num(p_data->>'x'), 1000), least(ng_num(p_data->>'n'), 1000000),
    case when p_data->>'touch' in ('true', 'false') then (p_data->>'touch')::boolean end, left(p_data->>'v', 24), v_id, v_dev, p_data);
  if random() < 0.01 then delete from ng_run_logs where created_at < now() - interval '180 days'; end if;
end $$;

-- Everything the admin panel's "Player data" screen shows, for one game over the last p_days days.
-- p_bucket is the width of the distance histogram in meters. 'hits' counts mid-run events a game lists in
-- stats.cr as [meters, zone, kind] (Night Drive's crashes).
create or replace function ng_admin_stats(p_token text, p_game text, p_days int default 7, p_bucket int default 250) returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 180)); v_b int := greatest(coalesce(p_bucket, 250), 10);
begin
  perform ng_admin(p_token);
  return (
    with r as (select * from ng_run_logs where game = p_game and created_at > v_since),
         e as (select * from r where ending not in ('quit', 'restart'))
    select json_build_object(
      'runs', (select count(*) from e), 'restarts', (select count(*) from r where ending = 'restart'), 'quits', (select count(*) from r where ending = 'quit'),
      'players', (select count(distinct coalesce(player_id::text, device)) from r),
      'medianM', (select round(percentile_cont(.5) within group (order by meters)) from e),
      'medianS', (select round(percentile_cont(.5) within group (order by secs)) from e),
      'medianScore', (select round(percentile_cont(.5) within group (order by score)) from e),
      'p90M', (select round(percentile_cont(.9) within group (order by meters)) from e),
      'causes', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select ending as c, count(*) n, round(percentile_cont(.5) within group (order by meters)) med from r group by 1) x),
      'zones', (select coalesce(json_agg(json_build_object('z', z, 'reached', (select count(*) from e where zone >= z), 'ended', (select count(*) from e where zone = z)) order by z), '[]'::json) from generate_series(0, (select coalesce(max(zone), 0) from e)) z),
      'zoneCauses', (select coalesce(json_agg(x), '[]'::json) from (select zone as z, ending as c, count(*) n from e group by 1, 2 order by 1, 3 desc) x),
      'buckets', (select coalesce(json_agg(json_build_object('b', b, 'n', n) order by b), '[]'::json) from (select least(meters / v_b, 23) b, count(*) n from e group by 1) x),
      'modes', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select mode, count(*) n, round(percentile_cont(.5) within group (order by meters)) med, round(percentile_cont(.5) within group (order by score)) score from e group by 1) x),
      'devices', (select coalesce(json_agg(x), '[]'::json) from (select touch, count(*) n, round(percentile_cont(.5) within group (order by meters)) med from e group by 1) x),
      'experience', (select coalesce(json_agg(x order by x.g), '[]'::json) from (select case when run_no <= 5 then 1 when run_no <= 25 then 2 else 3 end g, count(*) n, round(percentile_cont(.5) within group (order by meters)) med from e group by 1) x),
      'sides', (select coalesce(json_agg(json_build_object('s', s, 'n', n) order by s), '[]'::json) from (select least(x / 200, 4) s, count(*) n from e where x is not null group by 1) x),
      'versions', (select coalesce(json_agg(x), '[]'::json) from (select version, count(*) n, round(percentile_cont(.5) within group (order by meters)) med, min(created_at) first from e group by 1 order by 4 desc limit 5) x),
      'hits', (select coalesce(json_agg(x), '[]'::json) from (select h->>2 as k, (h->>1)::int as z, count(*) n from r, jsonb_array_elements(case when jsonb_typeof(stats->'cr') = 'array' then stats->'cr' else '[]'::jsonb end) h where jsonb_typeof(h) = 'array' and h->>1 ~ '^[0-9]{1,2}$' group by 1, 2 order by 3 desc limit 60) x)
    ));
end $$;

do $$
declare f text;
begin
  foreach f in array array['ng_log_run(text, jsonb, text, text)', 'ng_admin_stats(text, text, int, int)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
