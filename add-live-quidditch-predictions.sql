-- Shared live Quidditch broadcast, viewer count, locked predictions and match statistics.
-- Safe to run more than once. Does not reset character, pet, GP or skill data.

create table if not exists public.quidditch_predictions (
  match_id bigint not null,
  user_id uuid not null,
  picked_side text not null check (picked_side in ('left','right','draw')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id,user_id)
);
alter table public.quidditch_predictions drop constraint if exists quidditch_predictions_picked_side_check;
alter table public.quidditch_predictions add constraint quidditch_predictions_picked_side_check check (picked_side in ('left','right','draw'));

create table if not exists public.quidditch_viewers (
  viewer_key text primary key,
  user_id uuid,
  last_seen timestamptz not null default now()
);
alter table public.quidditch_predictions enable row level security;
alter table public.quidditch_viewers enable row level security;
revoke all on public.quidditch_predictions from public;
revoke all on public.quidditch_viewers from public;

create or replace function public.quidditch_team_name(p_match_id bigint,p_side integer)
returns text language sql immutable as $$
  select (array[
    'Appleby Arrows','Ballycastle Bats','Caerphilly Catapults','Chudley Cannons','Falmouth Falcons',
    'Holyhead Harpies','Kenmare Kestrels','Montrose Magpies','Pride of Portree','Puddlemere United',
    'Tutshill Tornados','Wigtown Wanderers','Wimbourne Wasps','Vratsa Vultures','Sweetwater All-Stars',
    'Toyohashi Tengu','Gryffindor','Hufflepuff','Ravenclaw','Slytherin'
  ])[1 + abs(hashtext(p_match_id::text || ':' || p_side::text)) % 20];
$$;

create or replace function public.quidditch_final_score(p_match_id bigint,p_side text)
returns integer language sql immutable as $$
  with goals as (
    select i,case when abs(hashtext(p_match_id::text||':goal:'||i::text))%2=0 then 'left' else 'right' end side
    from generate_series(1,10) i
  ) select count(*)::integer from goals where side=p_side;
$$;

drop function if exists public.get_live_quidditch_state(text);
create function public.get_live_quidditch_state(p_viewer_key text)
returns table(
  match_id bigint,phase text,phase_seconds integer,match_started_at timestamptz,match_ends_at timestamptz,
  left_name text,right_name text,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb,
  roster jsonb,viewer_count integer,my_prediction text,can_predict boolean,reward_paid integer,
  left_predictions integer,draw_predictions integer,right_predictions integer,total_predictions integer,
  match_stats jsonb,mvp jsonb
)
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();v_cycle bigint:=235;v_match bigint:=floor(extract(epoch from v_now)/v_cycle)::bigint;
  v_cycle_start timestamptz:=to_timestamp(v_match*v_cycle);v_elapsed integer:=floor(extract(epoch from(v_now-v_cycle_start)))::integer;
  v_phase text:=case when v_elapsed<25 then 'lineup' when v_elapsed<205 then 'live' else 'post' end;
  v_match_elapsed integer:=greatest(0,least(180,v_elapsed-25));v_roster jsonb;v_left_score integer;v_right_score integer;
  v_left_scorers jsonb;v_right_scorers jsonb;v_prediction text;v_reward integer:=0;v_prev bigint:=v_match-1;
  v_prev_pick text;v_prev_left integer;v_prev_right integer;v_lp integer:=0;v_dp integer:=0;v_rp integer:=0;
  v_stats jsonb:='[]'::jsonb;v_mvp jsonb:='{}'::jsonb;
begin
  insert into public.quidditch_viewers(viewer_key,user_id,last_seen)
  values(left(coalesce(nullif(trim(p_viewer_key),''),gen_random_uuid()::text),120),auth.uid(),v_now)
  on conflict(viewer_key) do update set user_id=excluded.user_id,last_seen=excluded.last_seen;
  delete from public.quidditch_viewers qv where qv.last_seen<v_now-interval '35 seconds';

  if auth.uid() is not null then
    select qp.picked_side into v_prev_pick from public.quidditch_predictions qp where qp.match_id=v_prev and qp.user_id=auth.uid() and qp.paid=false;
    if v_prev_pick is not null then
      v_prev_left:=public.quidditch_final_score(v_prev,'left');v_prev_right:=public.quidditch_final_score(v_prev,'right');
      if (v_prev_left>v_prev_right and v_prev_pick='left') or (v_prev_right>v_prev_left and v_prev_pick='right') or (v_prev_left=v_prev_right and v_prev_pick='draw') then
        update public.characters c set gp=coalesce(c.gp,0)+1000 where c.user_id=auth.uid();v_reward:=1000;
      end if;
      update public.quidditch_predictions qp set paid=true where qp.match_id=v_prev and qp.user_id=auth.uid();
    end if;
  end if;

  with ranked as (
    select c.username,c.active_pet,coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,c.equipped_pet_cosmetic,
      row_number() over(order by md5(v_match::text||':'||c.username)) rn
    from public.characters c where c.active_pet is not null and c.active_pet like 'pet_%' limit 30
  ) select coalesce(jsonb_agg(jsonb_build_object('username',username,'active_pet',active_pet,'pet_name',pet_name,
      'equipped_pet_cosmetic',equipped_pet_cosmetic,'side',case when rn%2=1 then 'left' else 'right' end,'slot',ceil(rn/2.0)::integer) order by rn),'[]'::jsonb)
    into v_roster from ranked;

  with events as (
    select i,(12+(i-1)*15+abs(hashtext(v_match::text||':time:'||i::text))%8)::integer goal_second,
      case when abs(hashtext(v_match::text||':goal:'||i::text))%2=0 then 'left' else 'right' end side
    from generate_series(1,10)i
  ),visible as(select * from events where goal_second<=v_match_elapsed),names as(
    select e.side,coalesce((select x->>'pet_name' from jsonb_array_elements(v_roster)x where x->>'side'=e.side order by md5(v_match::text||':'||e.i::text||':'||(x->>'username')) limit 1),'Unknown Pet') pet_name from visible e
  ),grouped as(select side,pet_name,count(*)::integer goals from names group by side,pet_name)
  select count(*)filter(where e.side='left')::integer,count(*)filter(where e.side='right')::integer,
    coalesce((select jsonb_object_agg(g.pet_name,g.goals)from grouped g where g.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(g.pet_name,g.goals)from grouped g where g.side='right'),'{}'::jsonb)
  into v_left_score,v_right_score,v_left_scorers,v_right_scorers from visible e;

  select count(*)filter(where qp.picked_side='left')::integer,count(*)filter(where qp.picked_side='draw')::integer,
    count(*)filter(where qp.picked_side='right')::integer into v_lp,v_dp,v_rp from public.quidditch_predictions qp where qp.match_id=v_match;

  with players as(
    select x->>'pet_name' pet_name,x->>'side' side,x->>'username' username from jsonb_array_elements(v_roster)x
  ),calculated as(
    select p.pet_name,p.side,
      coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0) goals,
      greatest(coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0),
        floor((1+abs(hashtext(v_match::text||':shots:'||p.username))%5)*greatest(.20,v_match_elapsed/180.0))::integer) shots,
      floor((abs(hashtext(v_match::text||':rebounds:'||p.username))%5)*greatest(.20,v_match_elapsed/180.0))::integer rebounds,
      floor((18+abs(hashtext(v_match::text||':possession:'||p.username))%78)*greatest(.20,v_match_elapsed/180.0))::integer possession_seconds
    from players p
  ),with_score as(
    select *,goals*12+shots*3+rebounds*2+possession_seconds/12.0 mvp_score from calculated
  )
  select coalesce(jsonb_agg(jsonb_build_object('pet_name',pet_name,'side',side,'goals',goals,'shots',shots,'rebounds',rebounds,'possession_seconds',possession_seconds) order by side,pet_name),'[]'::jsonb),
    coalesce((select jsonb_build_object('pet_name',w.pet_name,'side',w.side,'team_name',case when w.side='left' then public.quidditch_team_name(v_match,0) else public.quidditch_team_name(v_match,1) end,'goals',w.goals,'shots',w.shots,'rebounds',w.rebounds,'possession_seconds',w.possession_seconds) from with_score w order by w.mvp_score desc,w.pet_name limit 1),'{}'::jsonb)
  into v_stats,v_mvp from with_score;

  if auth.uid() is not null then select qp.picked_side into v_prediction from public.quidditch_predictions qp where qp.match_id=v_match and qp.user_id=auth.uid();end if;

  return query select v_match,v_phase,
    case when v_phase='lineup' then 25-v_elapsed when v_phase='live' then 180-v_match_elapsed else 235-v_elapsed end,
    v_cycle_start+interval '25 seconds',v_cycle_start+interval '205 seconds',public.quidditch_team_name(v_match,0),public.quidditch_team_name(v_match,1),
    coalesce(v_left_score,0),coalesce(v_right_score,0),v_left_scorers,v_right_scorers,v_roster,
    (select count(*)::integer from public.quidditch_viewers qv where qv.last_seen>=v_now-interval '20 seconds'),
    v_prediction,(v_phase='lineup' and auth.uid() is not null and v_prediction is null),v_reward,v_lp,v_dp,v_rp,v_lp+v_dp+v_rp,v_stats,v_mvp;
end;$$;

create or replace function public.predict_live_quidditch(p_match_id bigint,p_side text)
returns text language plpgsql security definer set search_path=public as $$
declare v_now_match bigint:=floor(extract(epoch from clock_timestamp())/235)::bigint;v_elapsed integer:=floor(extract(epoch from clock_timestamp()))::integer%235;v_pick text;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction';end if;
  if p_match_id<>v_now_match or v_elapsed>=25 then raise exception 'Predictions are closed for this match';end if;
  if p_side not in('left','right','draw') then raise exception 'Invalid team';end if;
  insert into public.quidditch_predictions(match_id,user_id,picked_side)values(p_match_id,auth.uid(),p_side) on conflict(match_id,user_id)do nothing;
  select qp.picked_side into v_pick from public.quidditch_predictions qp where qp.match_id=p_match_id and qp.user_id=auth.uid();
  return v_pick;
end;$$;

grant execute on function public.get_live_quidditch_state(text) to anon,authenticated;
grant execute on function public.predict_live_quidditch(bigint,text) to authenticated;
notify pgrst,'reload schema';

-- ============================================================
-- LIVE SCORE AUTHORITY + PROFESSIONAL POSSESSION STATISTICS
-- Safe to run after the earlier statements in this same file.
-- ============================================================
create table if not exists public.quidditch_goals (
  id bigint generated by default as identity primary key,
  match_id bigint not null,
  event_key text not null unique,
  side text not null check (side in ('left','right')),
  pet_name text not null,
  scored_at timestamptz not null default clock_timestamp()
);
create index if not exists quidditch_goals_match_idx on public.quidditch_goals(match_id,scored_at,id);
alter table public.quidditch_goals enable row level security;
revoke all on public.quidditch_goals from public;

drop function if exists public.record_live_quidditch_goal(bigint,text,text,text);
create function public.record_live_quidditch_goal(p_match_id bigint,p_side text,p_pet_name text,p_event_key text)
returns table(goal_id bigint,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb)
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_match bigint:=floor(extract(epoch from v_now)/235)::bigint;
  v_elapsed integer:=floor(extract(epoch from v_now))::integer%235;
  v_id bigint;
begin
  if p_match_id<>v_match or v_elapsed<25 or v_elapsed>=205 then raise exception 'This match is not live'; end if;
  if p_side not in ('left','right') then raise exception 'Invalid scoring side'; end if;
  if length(trim(coalesce(p_pet_name,'')))<1 then raise exception 'Missing scorer'; end if;
  perform pg_advisory_xact_lock(hashtext('repo-live-quidditch:'||p_match_id::text));
  -- Prevent separate viewers from duplicating the same television moment.
  if exists(select 1 from public.quidditch_goals g where g.match_id=p_match_id and g.scored_at>v_now-interval '3.5 seconds') then
    select g.id into v_id from public.quidditch_goals g where g.match_id=p_match_id order by g.id desc limit 1;
  else
    insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
    values(p_match_id,left(coalesce(nullif(p_event_key,''),gen_random_uuid()::text),180),p_side,left(trim(p_pet_name),80),v_now)
    on conflict(event_key) do update set event_key=excluded.event_key
    returning id into v_id;
  end if;
  return query
  with grouped as(select g.side,g.pet_name,count(*)::integer goals from public.quidditch_goals g where g.match_id=p_match_id group by g.side,g.pet_name)
  select v_id,
    count(*) filter(where g.side='left')::integer,
    count(*) filter(where g.side='right')::integer,
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
  from public.quidditch_goals g where g.match_id=p_match_id;
end;$$;

drop function if exists public.quidditch_final_score(bigint,text);
create function public.quidditch_final_score(p_match_id bigint,p_side text)
returns integer language sql stable as $$
  select count(*)::integer from public.quidditch_goals g where g.match_id=p_match_id and g.side=p_side;
$$;

drop function if exists public.get_live_quidditch_state(text);
create function public.get_live_quidditch_state(p_viewer_key text)
returns table(
  match_id bigint,phase text,phase_seconds integer,match_started_at timestamptz,match_ends_at timestamptz,
  left_name text,right_name text,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb,
  roster jsonb,viewer_count integer,my_prediction text,can_predict boolean,reward_paid integer,
  left_predictions integer,draw_predictions integer,right_predictions integer,total_predictions integer,
  match_stats jsonb,mvp jsonb,left_possession_pct integer,right_possession_pct integer,
  latest_goal_id bigint,latest_goal_side text,latest_goal_pet text
)
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();v_cycle bigint:=235;v_match bigint:=floor(extract(epoch from v_now)/v_cycle)::bigint;
  v_cycle_start timestamptz:=to_timestamp(v_match*v_cycle);v_elapsed integer:=floor(extract(epoch from(v_now-v_cycle_start)))::integer;
  v_phase text:=case when v_elapsed<25 then 'lineup' when v_elapsed<205 then 'live' else 'post' end;
  v_match_elapsed integer:=greatest(0,least(180,v_elapsed-25));v_roster jsonb;v_left_score integer:=0;v_right_score integer:=0;
  v_left_scorers jsonb:='{}'::jsonb;v_right_scorers jsonb:='{}'::jsonb;v_prediction text;v_reward integer:=0;v_prev bigint:=v_match-1;
  v_prev_pick text;v_prev_left integer;v_prev_right integer;v_lp integer:=0;v_dp integer:=0;v_rp integer:=0;
  v_stats jsonb:='[]'::jsonb;v_mvp jsonb:='{}'::jsonb;v_left_pos integer;v_right_pos integer;
  v_latest_id bigint;v_latest_side text;v_latest_pet text;
begin
  insert into public.quidditch_viewers(viewer_key,user_id,last_seen)
  values(left(coalesce(nullif(trim(p_viewer_key),''),gen_random_uuid()::text),120),auth.uid(),v_now)
  on conflict(viewer_key) do update set user_id=excluded.user_id,last_seen=excluded.last_seen;
  delete from public.quidditch_viewers qv where qv.last_seen<v_now-interval '35 seconds';
  delete from public.quidditch_goals g where g.match_id<v_match-20;

  if auth.uid() is not null then
    select qp.picked_side into v_prev_pick from public.quidditch_predictions qp where qp.match_id=v_prev and qp.user_id=auth.uid() and qp.paid=false;
    if v_prev_pick is not null then
      v_prev_left:=public.quidditch_final_score(v_prev,'left');v_prev_right:=public.quidditch_final_score(v_prev,'right');
      if (v_prev_left>v_prev_right and v_prev_pick='left') or (v_prev_right>v_prev_left and v_prev_pick='right') or (v_prev_left=v_prev_right and v_prev_pick='draw') then
        update public.characters c set gp=coalesce(c.gp,0)+1000 where c.user_id=auth.uid();v_reward:=1000;
      end if;
      update public.quidditch_predictions qp set paid=true where qp.match_id=v_prev and qp.user_id=auth.uid();
    end if;
  end if;

  with ranked as (
    select c.username,c.active_pet,coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,c.equipped_pet_cosmetic,
      row_number() over(order by md5(v_match::text||':'||c.username)) rn
    from public.characters c where c.active_pet is not null and c.active_pet like 'pet_%' limit 30
  ) select coalesce(jsonb_agg(jsonb_build_object('username',username,'active_pet',active_pet,'pet_name',pet_name,
      'equipped_pet_cosmetic',equipped_pet_cosmetic,'side',case when rn%2=1 then 'left' else 'right' end,'slot',ceil(rn/2.0)::integer) order by rn),'[]'::jsonb)
    into v_roster from ranked;

  with grouped as(select g.side,g.pet_name,count(*)::integer goals from public.quidditch_goals g where g.match_id=v_match group by g.side,g.pet_name)
  select count(*)filter(where g.side='left')::integer,count(*)filter(where g.side='right')::integer,
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
  into v_left_score,v_right_score,v_left_scorers,v_right_scorers from public.quidditch_goals g where g.match_id=v_match;

  select g.id,g.side,g.pet_name into v_latest_id,v_latest_side,v_latest_pet from public.quidditch_goals g where g.match_id=v_match order by g.id desc limit 1;

  select count(*)filter(where qp.picked_side='left')::integer,count(*)filter(where qp.picked_side='draw')::integer,
    count(*)filter(where qp.picked_side='right')::integer into v_lp,v_dp,v_rp from public.quidditch_predictions qp where qp.match_id=v_match;

  -- Team possession always totals exactly 100%; player percentages total to their team's share.
  v_left_pos:=greatest(42,least(58,50 + (v_left_score-v_right_score)*2 + (abs(hashtext(v_match::text||':pos'))%5)-2));
  v_right_pos:=100-v_left_pos;
  with players as(
    select x->>'pet_name' pet_name,x->>'side' side,x->>'username' username from jsonb_array_elements(v_roster)x
  ),base as(
    select p.*,
      coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0) goals,
      greatest(coalesce(case when p.side='left' then (v_left_scorers->>p.pet_name)::integer else (v_right_scorers->>p.pet_name)::integer end,0),floor((1+abs(hashtext(v_match::text||':shots:'||p.username))%6)*greatest(.15,v_match_elapsed/180.0))::integer) shots,
      floor((abs(hashtext(v_match::text||':rebounds:'||p.username))%5)*greatest(.15,v_match_elapsed/180.0))::integer rebounds,
      20+abs(hashtext(v_match::text||':weight:'||p.username))%81 weight
    from players p
  ),weighted as(
    select b.*,sum(weight)over(partition by side) team_weight from base b
  ),calculated as(
    select *,case when side='left' then round(v_left_pos*weight/greatest(1,team_weight))::integer else round(v_right_pos*weight/greatest(1,team_weight))::integer end possession_pct from weighted
  ),scored as(
    select *,goals*14+shots*3+rebounds*2+possession_pct*.35 mvp_score from calculated
  )
  select coalesce(jsonb_agg(jsonb_build_object('pet_name',pet_name,'side',side,'goals',goals,'shots',shots,'rebounds',rebounds,'possession_pct',possession_pct) order by side,pet_name),'[]'::jsonb),
    coalesce((select jsonb_build_object('pet_name',s.pet_name,'side',s.side,'team_name',case when s.side='left' then public.quidditch_team_name(v_match,0) else public.quidditch_team_name(v_match,1) end,'goals',s.goals,'shots',s.shots,'rebounds',s.rebounds,'possession_pct',s.possession_pct) from scored s order by s.mvp_score desc,s.pet_name limit 1),'{}'::jsonb)
  into v_stats,v_mvp from scored;

  if auth.uid() is not null then select qp.picked_side into v_prediction from public.quidditch_predictions qp where qp.match_id=v_match and qp.user_id=auth.uid();end if;

  return query select v_match,v_phase,
    case when v_phase='lineup' then 25-v_elapsed when v_phase='live' then 180-v_match_elapsed else 235-v_elapsed end,
    v_cycle_start+interval '25 seconds',v_cycle_start+interval '205 seconds',public.quidditch_team_name(v_match,0),public.quidditch_team_name(v_match,1),
    coalesce(v_left_score,0),coalesce(v_right_score,0),v_left_scorers,v_right_scorers,v_roster,
    (select count(*)::integer from public.quidditch_viewers qv where qv.last_seen>=v_now-interval '20 seconds'),
    v_prediction,(v_phase='lineup' and auth.uid() is not null and v_prediction is null),v_reward,v_lp,v_dp,v_rp,v_lp+v_dp+v_rp,v_stats,v_mvp,
    v_left_pos,v_right_pos,v_latest_id,v_latest_side,v_latest_pet;
end;$$;

grant execute on function public.record_live_quidditch_goal(bigint,text,text,text) to authenticated,anon;
grant execute on function public.get_live_quidditch_state(text) to anon,authenticated;
notify pgrst,'reload schema';


-- ============================================================
-- QUIDDITCH SPECTATOR AGILITY XP
-- Awards 750 Agility XP for each complete minute actively watching live play.
-- ============================================================
create table if not exists public.quidditch_watch_progress (
  user_id uuid primary key,
  accrued_seconds numeric not null default 0,
  last_seen timestamptz not null default clock_timestamp()
);
alter table public.quidditch_watch_progress enable row level security;
revoke all on public.quidditch_watch_progress from public;

drop function if exists public.claim_quidditch_watch_xp();
create function public.claim_quidditch_watch_xp()
returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_epoch bigint:=floor(extract(epoch from v_now))::bigint;
  v_elapsed integer:=(v_epoch % 235)::integer;
  v_last timestamptz;
  v_bank numeric:=0;
  v_delta numeric:=0;
  v_units integer:=0;
  v_award integer:=0;
begin
  if auth.uid() is null then return 0; end if;

  insert into public.quidditch_watch_progress(user_id,accrued_seconds,last_seen)
  values(auth.uid(),0,v_now)
  on conflict(user_id) do nothing;

  select q.last_seen,q.accrued_seconds into v_last,v_bank
  from public.quidditch_watch_progress q where q.user_id=auth.uid() for update;

  -- Only count time during the 3-minute live phase. Cap each heartbeat so
  -- closing the screen or losing connection cannot grant offline XP.
  if v_elapsed>=25 and v_elapsed<205 then
    v_delta:=greatest(0,least(20,extract(epoch from (v_now-v_last))));
    v_bank:=v_bank+v_delta;
    v_units:=floor(v_bank/60)::integer;
    v_bank:=v_bank-(v_units*60);
    v_award:=v_units*750;
    if v_award>0 then
      update public.characters c
      set agility_xp=coalesce(c.agility_xp,0)+v_award
      where c.user_id=auth.uid();
    end if;
  end if;

  update public.quidditch_watch_progress
  set accrued_seconds=v_bank,last_seen=v_now
  where user_id=auth.uid();
  return v_award;
end;$$;

grant execute on function public.claim_quidditch_watch_xp() to authenticated;
notify pgrst,'reload schema';
