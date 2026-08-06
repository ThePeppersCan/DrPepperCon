-- Repo Company Quidditch: authoritative Golden Snitch 30-second restart fix
-- Run this entire file ONCE in Supabase -> SQL Editor.
--
-- Why this is required:
-- The older live league derives its phase from a fixed 235-second wall-clock cycle
-- (25s lineup + 180s live + 30s full time). A Snitch catch could change the screen,
-- but it could not shorten that server cycle. This migration gives the league one
-- shared authoritative phase clock. Catching the Snitch atomically ends the live
-- phase, records the winning score, starts exactly 30 seconds of full time, then
-- advances every viewer to the next match lineup.

create table if not exists public.quidditch_live_clock (
  clock_id smallint primary key default 1 check (clock_id = 1),
  match_id bigint not null,
  phase text not null check (phase in ('lineup','live','post')),
  phase_started_at timestamptz not null,
  phase_ends_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.quidditch_snitch_match_results (
  match_id bigint primary key,
  winner_side text not null check (winner_side in ('left','right')),
  winner_pet text not null,
  caught_at timestamptz not null default clock_timestamp(),
  post_ends_at timestamptz not null
);

alter table public.quidditch_live_clock enable row level security;
alter table public.quidditch_snitch_match_results enable row level security;
revoke all on public.quidditch_live_clock from public;
revoke all on public.quidditch_snitch_match_results from public;

-- Keep the currently-running fixed-cycle match/phase when this is installed, so
-- deploying the migration does not abruptly reset a match that players are watching.
do $$
declare
  v_now timestamptz := clock_timestamp();
  v_epoch bigint := floor(extract(epoch from v_now))::bigint;
  v_match bigint := floor(extract(epoch from v_now) / 235)::bigint;
  v_elapsed integer := (v_epoch % 235)::integer;
  v_phase text;
  v_started timestamptz;
  v_ends timestamptz;
begin
  if v_elapsed < 25 then
    v_phase := 'lineup';
    v_started := v_now - make_interval(secs => v_elapsed);
    v_ends := v_now + make_interval(secs => 25 - v_elapsed);
  elsif v_elapsed < 205 then
    v_phase := 'live';
    v_started := v_now - make_interval(secs => v_elapsed - 25);
    v_ends := v_now + make_interval(secs => 205 - v_elapsed);
  else
    v_phase := 'post';
    v_started := v_now - make_interval(secs => v_elapsed - 205);
    v_ends := v_now + make_interval(secs => 235 - v_elapsed);
  end if;

  insert into public.quidditch_live_clock(clock_id,match_id,phase,phase_started_at,phase_ends_at,updated_at)
  values(1,v_match,v_phase,v_started,v_ends,v_now)
  on conflict(clock_id) do nothing;
end $$;

-- Advance the shared clock through any completed phases. All callers lock the
-- same singleton row, so many open browsers remain safe and deterministic.
drop function if exists public.advance_quidditch_live_clock();
create function public.advance_quidditch_live_clock()
returns public.quidditch_live_clock
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_clock public.quidditch_live_clock%rowtype;
  v_steps integer := 0;
begin
  select q.* into v_clock
  from public.quidditch_live_clock q
  where q.clock_id=1
  for update;

  if not found then
    insert into public.quidditch_live_clock(clock_id,match_id,phase,phase_started_at,phase_ends_at,updated_at)
    values(1,floor(extract(epoch from v_now)/235)::bigint,'lineup',v_now,v_now+interval '25 seconds',v_now)
    returning * into v_clock;
  end if;

  -- If the site has been completely offline for a long period, begin a clean
  -- lineup rather than iterating through thousands of unseen historical phases.
  if v_clock.phase_ends_at < v_now - interval '1 hour' then
    v_clock.match_id := greatest(v_clock.match_id + 1, floor(extract(epoch from v_now)/235)::bigint);
    v_clock.phase := 'lineup';
    v_clock.phase_started_at := v_now;
    v_clock.phase_ends_at := v_now + interval '25 seconds';
  else
    while v_clock.phase_ends_at <= v_now and v_steps < 100 loop
      v_steps := v_steps + 1;
      if v_clock.phase='lineup' then
        v_clock.phase := 'live';
        v_clock.phase_started_at := v_clock.phase_ends_at;
        v_clock.phase_ends_at := v_clock.phase_ends_at + interval '180 seconds';
      elsif v_clock.phase='live' then
        v_clock.phase := 'post';
        v_clock.phase_started_at := v_clock.phase_ends_at;
        v_clock.phase_ends_at := v_clock.phase_ends_at + interval '30 seconds';
      else
        v_clock.match_id := v_clock.match_id + 1;
        v_clock.phase := 'lineup';
        v_clock.phase_started_at := v_clock.phase_ends_at;
        v_clock.phase_ends_at := v_clock.phase_ends_at + interval '25 seconds';
      end if;
    end loop;
  end if;

  update public.quidditch_live_clock q
  set match_id=v_clock.match_id,
      phase=v_clock.phase,
      phase_started_at=v_clock.phase_started_at,
      phase_ends_at=v_clock.phase_ends_at,
      updated_at=v_now
  where q.clock_id=1
  returning q.* into v_clock;

  return v_clock;
end $$;

-- The existing project already has these tables. The guarded definitions make
-- this migration safe on an older install too.
create table if not exists public.quidditch_predictions (
  match_id bigint not null,
  user_id uuid not null,
  picked_side text not null check (picked_side in ('left','right','draw')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(match_id,user_id)
);
create table if not exists public.quidditch_viewers (
  viewer_key text primary key,
  user_id uuid,
  last_seen timestamptz not null default now()
);
create table if not exists public.quidditch_goals (
  id bigint generated by default as identity primary key,
  match_id bigint not null,
  event_key text not null unique,
  side text not null check (side in ('left','right')),
  pet_name text not null,
  scored_at timestamptz not null default clock_timestamp()
);
create index if not exists quidditch_goals_match_idx on public.quidditch_goals(match_id,scored_at,id);
alter table public.quidditch_predictions enable row level security;
alter table public.quidditch_viewers enable row level security;
alter table public.quidditch_goals enable row level security;
revoke all on public.quidditch_predictions from public;
revoke all on public.quidditch_viewers from public;
revoke all on public.quidditch_goals from public;

-- Ordinary goals must validate against the new shared clock rather than the old
-- wall-clock match id. Stable event keys keep every viewer idempotent.
drop function if exists public.record_live_quidditch_goal(bigint,text,text,text);
create function public.record_live_quidditch_goal(
  p_match_id bigint,
  p_side text,
  p_pet_name text,
  p_event_key text
)
returns table(goal_id bigint,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_now timestamptz := clock_timestamp();
  v_id bigint;
begin
  v_clock := public.advance_quidditch_live_clock();
  if p_match_id<>v_clock.match_id or v_clock.phase<>'live' then
    raise exception 'This match is not live';
  end if;
  if p_side not in ('left','right') then raise exception 'Invalid scoring side'; end if;
  if length(trim(coalesce(p_pet_name,'')))<1 then raise exception 'Missing scorer'; end if;

  perform pg_advisory_xact_lock(hashtext('repo-live-quidditch:'||p_match_id::text));
  insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
  values(p_match_id,left(coalesce(nullif(trim(p_event_key),''),gen_random_uuid()::text),180),p_side,left(trim(p_pet_name),80),v_now)
  on conflict(event_key) do update set event_key=excluded.event_key
  returning id into v_id;

  return query
  with grouped as(
    select g.side,g.pet_name,count(*)::integer goals
    from public.quidditch_goals g where g.match_id=p_match_id
    group by g.side,g.pet_name
  )
  select v_id,
    count(*) filter(where g.side='left')::integer,
    count(*) filter(where g.side='right')::integer,
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
  from public.quidditch_goals g where g.match_id=p_match_id;
end $$;

-- One atomic, idempotent server operation for a Snitch catch. It guarantees the
-- catching side leads, stores the catcher, and changes the authoritative phase
-- to POST with a fresh 30-second deadline. Repeated calls from other viewers only
-- return the same canonical result.
drop function if exists public.finish_live_quidditch_by_snitch(text,text,text);
create function public.finish_live_quidditch_by_snitch(
  p_match_id text,
  p_winner_side text,
  p_winner_pet text
)
returns table(
  goal_id bigint,
  left_score integer,
  right_score integer,
  left_scorers jsonb,
  right_scorers jsonb,
  match_id bigint,
  phase text,
  phase_seconds integer,
  ended_by_snitch boolean,
  snitch_winner_side text,
  snitch_winner_pet text,
  post_ends_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_match bigint;
  v_side text := lower(trim(coalesce(p_winner_side,'')));
  v_pet text := left(coalesce(nullif(trim(p_winner_pet),''),'Pet'),80);
  v_now timestamptz := clock_timestamp();
  v_left integer := 0;
  v_right integer := 0;
  v_needed integer := 0;
  v_i integer;
  v_applied boolean := false;
  v_goal_id bigint;
  v_result public.quidditch_snitch_match_results%rowtype;
begin
  begin
    v_match := trim(p_match_id)::bigint;
  exception when others then
    raise exception 'Invalid match id';
  end;
  if v_side not in ('left','right') then raise exception 'Invalid Snitch winner'; end if;

  v_clock := public.advance_quidditch_live_clock();
  perform pg_advisory_xact_lock(hashtext('repo-live-quidditch:'||v_match::text));

  if v_clock.match_id=v_match and v_clock.phase='live' then
    select count(*) filter(where g.side='left')::integer,
           count(*) filter(where g.side='right')::integer
      into v_left,v_right
    from public.quidditch_goals g where g.match_id=v_match;

    v_needed := case when v_side='left' then greatest(1,v_right-v_left+1)
                     else greatest(1,v_left-v_right+1) end;
    v_needed := least(v_needed,30);

    for v_i in 1..v_needed loop
      insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
      values(v_match,'snitch:'||v_match::text||':'||v_side||':'||v_i::text,v_side,v_pet,v_now)
      on conflict(event_key) do nothing;
    end loop;

    insert into public.quidditch_snitch_match_results(match_id,winner_side,winner_pet,caught_at,post_ends_at)
    values(v_match,v_side,v_pet,v_now,v_now+interval '30 seconds')
    on conflict(match_id) do nothing;

    update public.quidditch_live_clock q
    set phase='post',phase_started_at=v_now,phase_ends_at=v_now+interval '30 seconds',updated_at=v_now
    where q.clock_id=1 and q.match_id=v_match and q.phase='live';
    v_applied := found;
  end if;

  select r.* into v_result
  from public.quidditch_snitch_match_results r
  where r.match_id=v_match;

  select g.id into v_goal_id
  from public.quidditch_goals g where g.match_id=v_match
  order by g.id desc limit 1;

  return query
  with grouped as(
    select g.side,g.pet_name,count(*)::integer goals
    from public.quidditch_goals g where g.match_id=v_match
    group by g.side,g.pet_name
  ),scores as(
    select count(*) filter(where g.side='left')::integer l,
           count(*) filter(where g.side='right')::integer r
    from public.quidditch_goals g where g.match_id=v_match
  )
  select v_goal_id,s.l,s.r,
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb),
    v_match,
    case when v_result.match_id is not null then 'post' else v_clock.phase end,
    case when v_result.match_id is not null then greatest(0,ceil(extract(epoch from(v_result.post_ends_at-clock_timestamp())))::integer)
         else greatest(0,ceil(extract(epoch from(v_clock.phase_ends_at-clock_timestamp())))::integer) end,
    (v_result.match_id is not null),
    coalesce(v_result.winner_side,v_side),
    coalesce(v_result.winner_pet,v_pet),
    coalesce(v_result.post_ends_at,v_clock.phase_ends_at),
    v_applied
  from scores s;
end $$;

-- Predictions now use the same authoritative phase clock.
drop function if exists public.predict_live_quidditch(bigint,text);
create function public.predict_live_quidditch(p_match_id bigint,p_side text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_pick text;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction'; end if;
  v_clock := public.advance_quidditch_live_clock();
  if p_match_id<>v_clock.match_id or v_clock.phase<>'lineup' then
    raise exception 'Predictions are closed for this match';
  end if;
  if p_side not in('left','right','draw') then raise exception 'Invalid team'; end if;
  insert into public.quidditch_predictions(match_id,user_id,picked_side)
  values(p_match_id,auth.uid(),p_side)
  on conflict(match_id,user_id) do nothing;
  select qp.picked_side into v_pick
  from public.quidditch_predictions qp
  where qp.match_id=p_match_id and qp.user_id=auth.uid();
  return v_pick;
end $$;

-- Authoritative state consumed by every Quidditch viewer.
drop function if exists public.get_live_quidditch_state(text);
create function public.get_live_quidditch_state(p_viewer_key text)
returns table(
  match_id bigint,phase text,phase_seconds integer,match_started_at timestamptz,match_ends_at timestamptz,
  left_name text,right_name text,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb,
  roster jsonb,viewer_count integer,viewer_names jsonb,my_prediction text,can_predict boolean,reward_paid integer,
  left_predictions integer,draw_predictions integer,right_predictions integer,total_predictions integer,
  match_stats jsonb,mvp jsonb,left_possession_pct integer,right_possession_pct integer,
  latest_goal_id bigint,latest_goal_side text,latest_goal_pet text,
  ended_by_snitch boolean,snitch_winner_side text,snitch_winner_pet text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_clock public.quidditch_live_clock%rowtype;
  v_match bigint;
  v_phase text;
  v_seconds integer;
  v_match_elapsed integer := 0;
  v_roster jsonb := '[]'::jsonb;
  v_viewer_names jsonb := '[]'::jsonb;
  v_left_score integer := 0;
  v_right_score integer := 0;
  v_left_scorers jsonb := '{}'::jsonb;
  v_right_scorers jsonb := '{}'::jsonb;
  v_prediction text;
  v_reward integer := 0;
  v_prev bigint;
  v_prev_pick text;
  v_prev_left integer := 0;
  v_prev_right integer := 0;
  v_prev_winner text;
  v_lp integer := 0;
  v_dp integer := 0;
  v_rp integer := 0;
  v_stats jsonb := '[]'::jsonb;
  v_mvp jsonb := '{}'::jsonb;
  v_left_pos integer := 50;
  v_right_pos integer := 50;
  v_latest_id bigint;
  v_latest_side text;
  v_latest_pet text;
  v_snitch public.quidditch_snitch_match_results%rowtype;
begin
  v_clock := public.advance_quidditch_live_clock();
  v_match := v_clock.match_id;
  v_phase := v_clock.phase;
  v_seconds := greatest(0,ceil(extract(epoch from(v_clock.phase_ends_at-v_now)))::integer);
  v_prev := v_match-1;
  v_match_elapsed := case when v_phase='lineup' then 0
                          when v_phase='live' then greatest(0,least(180,floor(extract(epoch from(v_now-v_clock.phase_started_at)))::integer))
                          else 180 end;

  insert into public.quidditch_viewers(viewer_key,user_id,last_seen)
  values(left(coalesce(nullif(trim(p_viewer_key),''),gen_random_uuid()::text),120),auth.uid(),v_now)
  on conflict(viewer_key) do update set user_id=excluded.user_id,last_seen=excluded.last_seen;
  delete from public.quidditch_viewers qv where qv.last_seen<v_now-interval '35 seconds';
  delete from public.quidditch_goals g where g.match_id<v_match-20;

  if auth.uid() is not null then
    select qp.picked_side into v_prev_pick
    from public.quidditch_predictions qp
    where qp.match_id=v_prev and qp.user_id=auth.uid() and qp.paid=false;
    if v_prev_pick is not null then
      select count(*) filter(where g.side='left')::integer,
             count(*) filter(where g.side='right')::integer
        into v_prev_left,v_prev_right
      from public.quidditch_goals g where g.match_id=v_prev;
      select r.winner_side into v_prev_winner
      from public.quidditch_snitch_match_results r where r.match_id=v_prev;
      if v_prev_winner is null then
        v_prev_winner := case when v_prev_left>v_prev_right then 'left'
                              when v_prev_right>v_prev_left then 'right' else 'draw' end;
      end if;
      if v_prev_pick=v_prev_winner then
        update public.characters c set gp=coalesce(c.gp,0)+1000 where c.user_id=auth.uid();
        v_reward:=1000;
      end if;
      update public.quidditch_predictions qp set paid=true
      where qp.match_id=v_prev and qp.user_id=auth.uid();
    end if;
  end if;

  with ranked as(
    select c.username,c.username owner_username,c.active_pet,
      coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,
      c.equipped_pet_cosmetic,
      row_number() over(order by md5(v_match::text||':'||c.username)) rn
    from public.characters c
    where c.active_pet is not null and c.active_pet like 'pet_%'
    limit 30
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'username',username,'owner_username',owner_username,'active_pet',active_pet,'pet_id',active_pet,
    'pet_name',pet_name,'equipped_pet_cosmetic',equipped_pet_cosmetic,
    'side',case when rn%2=1 then 'left' else 'right' end,
    'slot',ceil(rn/2.0)::integer
  ) order by rn),'[]'::jsonb)
  into v_roster from ranked;

  with grouped as(
    select g.side,g.pet_name,count(*)::integer goals
    from public.quidditch_goals g where g.match_id=v_match
    group by g.side,g.pet_name
  )
  select count(*) filter(where g.side='left')::integer,
         count(*) filter(where g.side='right')::integer,
         coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
         coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
  into v_left_score,v_right_score,v_left_scorers,v_right_scorers
  from public.quidditch_goals g where g.match_id=v_match;

  select g.id,g.side,g.pet_name into v_latest_id,v_latest_side,v_latest_pet
  from public.quidditch_goals g where g.match_id=v_match
  order by g.id desc limit 1;

  select count(*) filter(where qp.picked_side='left')::integer,
         count(*) filter(where qp.picked_side='draw')::integer,
         count(*) filter(where qp.picked_side='right')::integer
  into v_lp,v_dp,v_rp
  from public.quidditch_predictions qp where qp.match_id=v_match;

  select coalesce(jsonb_agg(c.username order by qv.last_seen desc),'[]'::jsonb)
  into v_viewer_names
  from public.quidditch_viewers qv
  join public.characters c on c.user_id=qv.user_id
  where qv.last_seen>=v_now-interval '20 seconds';

  v_left_pos:=greatest(42,least(58,50+(v_left_score-v_right_score)*2+(abs(hashtext(v_match::text||':pos'))%5)-2));
  v_right_pos:=100-v_left_pos;

  with players as(
    select x->>'pet_name' pet_name,x->>'side' side,x->>'username' username
    from jsonb_array_elements(v_roster) x
  ),base as(
    select p.*,
      coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0) goals,
      greatest(coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0),
        floor((1+abs(hashtext(v_match::text||':shots:'||p.username))%6)*greatest(.15,v_match_elapsed/180.0))::integer) shots,
      floor((abs(hashtext(v_match::text||':rebounds:'||p.username))%5)*greatest(.15,v_match_elapsed/180.0))::integer rebounds,
      20+abs(hashtext(v_match::text||':weight:'||p.username))%81 weight
    from players p
  ),weighted as(
    select b.*,sum(weight) over(partition by side) team_weight from base b
  ),calculated as(
    select *,case when side='left' then round(v_left_pos*weight/greatest(1,team_weight))::integer
                  else round(v_right_pos*weight/greatest(1,team_weight))::integer end possession_pct
    from weighted
  ),scored as(
    select *,goals*14+shots*3+rebounds*2+possession_pct*.35 mvp_score from calculated
  )
  select coalesce(jsonb_agg(jsonb_build_object('pet_name',pet_name,'side',side,'goals',goals,'shots',shots,'rebounds',rebounds,'possession_pct',possession_pct) order by side,pet_name),'[]'::jsonb),
    coalesce((select jsonb_build_object('pet_name',s.pet_name,'side',s.side,
      'team_name',case when s.side='left' then public.quidditch_team_name(v_match,0) else public.quidditch_team_name(v_match,1) end,
      'goals',s.goals,'shots',s.shots,'rebounds',s.rebounds,'possession_pct',s.possession_pct)
      from scored s order by s.mvp_score desc,s.pet_name limit 1),'{}'::jsonb)
  into v_stats,v_mvp from scored;

  if auth.uid() is not null then
    select qp.picked_side into v_prediction
    from public.quidditch_predictions qp
    where qp.match_id=v_match and qp.user_id=auth.uid();
  end if;

  select r.* into v_snitch
  from public.quidditch_snitch_match_results r where r.match_id=v_match;

  return query select
    v_match,v_phase,v_seconds,
    case when v_phase='lineup' then v_clock.phase_ends_at else v_clock.phase_started_at end,
    v_clock.phase_ends_at,
    public.quidditch_team_name(v_match,0),public.quidditch_team_name(v_match,1),
    coalesce(v_left_score,0),coalesce(v_right_score,0),v_left_scorers,v_right_scorers,v_roster,
    (select count(*)::integer from public.quidditch_viewers qv where qv.last_seen>=v_now-interval '20 seconds'),
    v_viewer_names,v_prediction,(v_phase='lineup' and auth.uid() is not null and v_prediction is null),v_reward,
    v_lp,v_dp,v_rp,v_lp+v_dp+v_rp,v_stats,v_mvp,v_left_pos,v_right_pos,
    v_latest_id,v_latest_side,v_latest_pet,
    (v_snitch.match_id is not null),v_snitch.winner_side,v_snitch.winner_pet;
end $$;

-- One open browser anywhere on the site safely advances the clock and produces
-- the deterministic ordinary goals for the shared live broadcast. Event keys
-- make this safe even though several browsers may heartbeat at once.
drop function if exists public.advance_live_quidditch_background(text);
create function public.advance_live_quidditch_background(p_viewer_key text)
returns table(is_host boolean,match_id bigint,phase text,phase_seconds integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_clock public.quidditch_live_clock%rowtype;
  v_elapsed integer := 0;
  v_i integer;
  v_goal_second integer;
  v_side text;
  v_pet text;
begin
  v_clock := public.advance_quidditch_live_clock();

  if v_clock.phase='live' then
    v_elapsed := greatest(0,least(180,floor(extract(epoch from(v_now-v_clock.phase_started_at)))::integer));
    for v_i in 1..10 loop
      v_goal_second := 12+(v_i-1)*15+abs(hashtext(v_clock.match_id::text||':time:'||v_i::text))%8;
      if v_goal_second<=v_elapsed then
        v_side := case when abs(hashtext(v_clock.match_id::text||':goal:'||v_i::text))%2=0 then 'left' else 'right' end;
        with ranked as(
          select coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,
                 case when row_number() over(order by md5(v_clock.match_id::text||':'||c.username))%2=1 then 'left' else 'right' end side,
                 row_number() over(order by md5(v_clock.match_id::text||':'||c.username)) rn
          from public.characters c
          where c.active_pet is not null and c.active_pet like 'pet_%'
          limit 30
        )
        select r.pet_name into v_pet
        from ranked r where r.side=v_side
        order by md5(v_clock.match_id::text||':'||v_i::text||':'||r.rn::text)
        limit 1;
        v_pet := coalesce(nullif(v_pet,''),'Unknown Pet');

        insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
        values(v_clock.match_id,'background:'||v_clock.match_id::text||':'||v_i::text,v_side,left(v_pet,80),v_now)
        on conflict(event_key) do nothing;
      end if;
    end loop;
  end if;

  return query select true,v_clock.match_id,v_clock.phase,
    greatest(0,ceil(extract(epoch from(v_clock.phase_ends_at-clock_timestamp())))::integer);
end $$;

grant execute on function public.advance_quidditch_live_clock() to anon,authenticated;
grant execute on function public.record_live_quidditch_goal(bigint,text,text,text) to anon,authenticated;
grant execute on function public.finish_live_quidditch_by_snitch(text,text,text) to anon,authenticated;
grant execute on function public.predict_live_quidditch(bigint,text) to authenticated;
grant execute on function public.get_live_quidditch_state(text) to anon,authenticated;
grant execute on function public.advance_live_quidditch_background(text) to anon,authenticated;

notify pgrst,'reload schema';
