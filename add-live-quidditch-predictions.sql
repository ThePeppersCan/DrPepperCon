
-- Deterministic server-owned broadcast goals. Every viewer receives the same
-- goal times, scorer and score. Client-side goal attempts cannot create extras.
create or replace function public.ensure_live_quidditch_goals(p_match_id bigint,p_elapsed integer,p_roster jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  i integer; v_count integer:=5+(abs(p_match_id)%2)::integer; v_second integer; v_side text;
  v_names text[]; v_pet text; v_idx integer;
begin
  for i in 0..v_count-1 loop
    v_second:=20+i*floor(158.0/greatest(1,v_count-1))::integer+((abs(p_match_id+i*17)%7)::integer-3);
    if p_elapsed>=v_second then
      v_side:=case when (p_match_id+i)%2=0 then 'left' else 'right' end;
      select array_agg(x->>'pet_name' order by x->>'pet_name') into v_names
      from jsonb_array_elements(coalesce(p_roster,'[]'::jsonb)) x where x->>'side'=v_side;
      if coalesce(array_length(v_names,1),0)>0 then
        v_idx:=1+(abs(p_match_id*31+i*13)%array_length(v_names,1))::integer;
        v_pet:=v_names[v_idx];
        insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
        values(p_match_id,'broadcast-goal:'||p_match_id::text||':'||i::text,v_side,v_pet,
          to_timestamp(p_match_id*235)+interval '25 seconds'+make_interval(secs=>v_second))
        on conflict(event_key) do nothing;
      end if;
    end if;
  end loop;
end;$$;

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
    'Toyohashi Tengu','Gryffindor','Hufflepuff','Ravenclaw','Slytherin',
    'Gimbi Giant-Slayers','Patonga Proudsticks','Sumbawanga Sunrays','Tchamba Charmers',
    'Fitchburg Finches','Haileybury Hammers','Moose Jaw Meteorites','Stonewall Stormers',
    'Tarapoto Tree-Skimmers','Barnton','Bigonville Bombers','Braga Broomfleet','Cork',
    'Gorodok Gargoyles','Grodzisk Goblins','Heidelberg Harriers','Ilkley','Karasjok Kites',
    'Lancashire','Quiberon Quafflepunchers','Yorkshire','Moutohora Macaws',
    'Thundelarra Thunderers','Wollongong Warriors'
  ])[1 + abs(hashtext(p_match_id::text || ':' || p_side::text)) % 44];
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
      floor((abs(hashtext(v_match::text||':interceptions:'||p.username))%6)*greatest(.20,v_match_elapsed/180.0))::integer interceptions,
      floor((18+abs(hashtext(v_match::text||':possession:'||p.username))%78)*greatest(.20,v_match_elapsed/180.0))::integer possession_seconds
    from players p
  ),with_score as(
    select *,goals*12+shots*3+rebounds*2+interceptions*3+possession_seconds/12.0 mvp_score from calculated
  )
  select coalesce(jsonb_agg(jsonb_build_object('pet_name',pet_name,'side',side,'goals',goals,'shots',shots,'rebounds',rebounds,'interceptions',interceptions,'possession_seconds',possession_seconds) order by side,pet_name),'[]'::jsonb),
    coalesce((select jsonb_build_object('pet_name',w.pet_name,'side',w.side,'team_name',case when w.side='left' then public.quidditch_team_name(v_match,0) else public.quidditch_team_name(v_match,1) end,'goals',w.goals,'shots',w.shots,'rebounds',w.rebounds,'interceptions',w.interceptions,'possession_seconds',w.possession_seconds) from with_score w order by w.mvp_score desc,w.pet_name limit 1),'{}'::jsonb)
  into v_stats,v_mvp from with_score;

  if auth.uid() is not null then select qp.picked_side into v_prediction from public.quidditch_predictions qp where qp.match_id=v_match and qp.user_id=auth.uid();end if;

  return query select v_match,v_phase,
    case when v_phase='lineup' then 25-v_elapsed when v_phase='live' then 180-v_match_elapsed else 235-v_elapsed end,
    v_cycle_start+interval '25 seconds',v_cycle_start+interval '205 seconds',public.quidditch_team_name(v_match,0),public.quidditch_team_name(v_match,1),
    coalesce(v_left_score,0),coalesce(v_right_score,0),v_left_scorers,v_right_scorers,v_roster,
    (select count(*)::integer from public.quidditch_viewers qv where qv.last_seen>=v_now-interval '20 seconds'),
    v_prediction,(v_phase='lineup' and auth.uid() is not null),v_reward,v_lp,v_dp,v_rp,v_lp+v_dp+v_rp,v_stats,v_mvp;
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

  perform public.ensure_live_quidditch_goals(v_match,v_match_elapsed,v_roster);

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
      floor((abs(hashtext(v_match::text||':interceptions:'||p.username))%7)*greatest(.15,v_match_elapsed/180.0))::integer interceptions,
      20+abs(hashtext(v_match::text||':weight:'||p.username))%81 weight
    from players p
  ),weighted as(
    select b.*,sum(weight)over(partition by side) team_weight from base b
  ),calculated as(
    select *,case when side='left' then round(v_left_pos*weight/greatest(1,team_weight))::integer else round(v_right_pos*weight/greatest(1,team_weight))::integer end possession_pct from weighted
  ),scored as(
    select *,goals*14+shots*3+rebounds*2+interceptions*3+possession_pct*.35 mvp_score from calculated
  )
  select coalesce(jsonb_agg(jsonb_build_object('pet_name',pet_name,'side',side,'goals',goals,'shots',shots,'rebounds',rebounds,'interceptions',interceptions,'possession_pct',possession_pct) order by side,pet_name),'[]'::jsonb),
    coalesce((select jsonb_build_object('pet_name',s.pet_name,'side',s.side,'team_name',case when s.side='left' then public.quidditch_team_name(v_match,0) else public.quidditch_team_name(v_match,1) end,'goals',s.goals,'shots',s.shots,'rebounds',s.rebounds,'interceptions',s.interceptions,'possession_pct',s.possession_pct) from scored s order by s.mvp_score desc,s.pet_name limit 1),'{}'::jsonb)
  into v_stats,v_mvp from scored;

  if auth.uid() is not null then select qp.picked_side into v_prediction from public.quidditch_predictions qp where qp.match_id=v_match and qp.user_id=auth.uid();end if;

  return query select v_match,v_phase,
    case when v_phase='lineup' then 25-v_elapsed when v_phase='live' then 180-v_match_elapsed else 235-v_elapsed end,
    v_cycle_start+interval '25 seconds',v_cycle_start+interval '205 seconds',public.quidditch_team_name(v_match,0),public.quidditch_team_name(v_match,1),
    coalesce(v_left_score,0),coalesce(v_right_score,0),v_left_scorers,v_right_scorers,v_roster,
    (select count(*)::integer from public.quidditch_viewers qv where qv.last_seen>=v_now-interval '20 seconds'),
    v_prediction,(v_phase='lineup' and auth.uid() is not null),v_reward,v_lp,v_dp,v_rp,v_lp+v_dp+v_rp,v_stats,v_mvp,
    v_left_pos,v_right_pos,v_latest_id,v_latest_side,v_latest_pet;
end;$$;

grant execute on function public.record_live_quidditch_goal(bigint,text,text,text) to authenticated,anon;
grant execute on function public.get_live_quidditch_state(text) to anon,authenticated;
notify pgrst,'reload schema';


-- ============================================================
-- QUIDDITCH SPECTATOR AGILITY XP
-- Awards 450 Agility XP for each complete minute actively watching live play.
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
    v_award:=v_units*450;
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


-- Ignore client-side goal attempts: the broadcast timeline above is the sole authority.
drop function if exists public.record_live_quidditch_goal(bigint,text,text,text);
create function public.record_live_quidditch_goal(p_match_id bigint,p_side text,p_pet_name text,p_event_key text)
returns table(goal_id bigint,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb)
language plpgsql security definer set search_path=public as $$
begin
  return query
  with grouped as(select g.side,g.pet_name,count(*)::integer goals from public.quidditch_goals g where g.match_id=p_match_id group by g.side,g.pet_name)
  select max(g.id),count(*)filter(where g.side='left')::integer,count(*)filter(where g.side='right')::integer,
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
    coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
  from public.quidditch_goals g where g.match_id=p_match_id;
end;$$;
grant execute on function public.ensure_live_quidditch_goals(bigint,integer,jsonb) to anon,authenticated;
grant execute on function public.record_live_quidditch_goal(bigint,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';

-- ============================================================
-- ALL-TIME QUIDDITCH MODE CAREER LEADERBOARDS
-- Tracks fullscreen Quidditch Mode from this update onward.
-- ============================================================
create table if not exists public.quidditch_match_history (
  match_id bigint primary key,
  left_name text not null,
  right_name text not null,
  left_score integer not null default 0,
  right_score integer not null default 0,
  roster jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);
create table if not exists public.quidditch_pet_career (
  pet_name text primary key,
  owner_name text,
  goals bigint not null default 0,
  matches bigint not null default 0,
  wins bigint not null default 0,
  draws bigint not null default 0,
  losses bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.quidditch_team_career (
  team_name text primary key,
  matches bigint not null default 0,
  wins bigint not null default 0,
  draws bigint not null default 0,
  losses bigint not null default 0,
  goals_for bigint not null default 0,
  goals_against bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.quidditch_match_history enable row level security;
alter table public.quidditch_pet_career enable row level security;
alter table public.quidditch_team_career enable row level security;
revoke all on public.quidditch_match_history,public.quidditch_pet_career,public.quidditch_team_career from public;

create or replace function public.finalize_quidditch_career_match(p_match_id bigint)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_roster jsonb;v_left text;v_right text;v_ls integer;v_rs integer;v_inserted integer:=0;
begin
  if p_match_id is null or p_match_id<1 then return; end if;
  perform pg_advisory_xact_lock(hashtext('repo-quidditch-career:'||p_match_id::text));
  if exists(select 1 from public.quidditch_match_history h where h.match_id=p_match_id) then return; end if;

  with ranked as (
    select c.username,c.active_pet,coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,
      row_number() over(order by md5(p_match_id::text||':'||c.username)) rn
    from public.characters c where c.active_pet is not null and c.active_pet like 'pet_%' limit 30
  ) select coalesce(jsonb_agg(jsonb_build_object('username',username,'active_pet',active_pet,'pet_name',pet_name,
      'side',case when rn%2=1 then 'left' else 'right' end) order by rn),'[]'::jsonb) into v_roster from ranked;

  v_left:=public.quidditch_team_name(p_match_id,0);v_right:=public.quidditch_team_name(p_match_id,1);
  v_ls:=public.quidditch_final_score(p_match_id,'left');v_rs:=public.quidditch_final_score(p_match_id,'right');
  insert into public.quidditch_match_history(match_id,left_name,right_name,left_score,right_score,roster)
  values(p_match_id,v_left,v_right,v_ls,v_rs,v_roster) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return; end if;

  insert into public.quidditch_pet_career(pet_name,owner_name,goals,matches,wins,draws,losses,updated_at)
  select x->>'pet_name',x->>'username',
    (select count(*) from public.quidditch_goals g where g.match_id=p_match_id and g.pet_name=x->>'pet_name'),
    1,
    case when (x->>'side'='left' and v_ls>v_rs) or (x->>'side'='right' and v_rs>v_ls) then 1 else 0 end,
    case when v_ls=v_rs then 1 else 0 end,
    case when (x->>'side'='left' and v_ls<v_rs) or (x->>'side'='right' and v_rs<v_ls) then 1 else 0 end,
    now()
  from jsonb_array_elements(v_roster)x
  on conflict(pet_name) do update set
    owner_name=excluded.owner_name,goals=public.quidditch_pet_career.goals+excluded.goals,
    matches=public.quidditch_pet_career.matches+1,wins=public.quidditch_pet_career.wins+excluded.wins,
    draws=public.quidditch_pet_career.draws+excluded.draws,losses=public.quidditch_pet_career.losses+excluded.losses,updated_at=now();

  insert into public.quidditch_team_career(team_name,matches,wins,draws,losses,goals_for,goals_against,updated_at)
  values
    (v_left,1,case when v_ls>v_rs then 1 else 0 end,case when v_ls=v_rs then 1 else 0 end,case when v_ls<v_rs then 1 else 0 end,v_ls,v_rs,now()),
    (v_right,1,case when v_rs>v_ls then 1 else 0 end,case when v_ls=v_rs then 1 else 0 end,case when v_rs<v_ls then 1 else 0 end,v_rs,v_ls,now())
  on conflict(team_name) do update set
    matches=public.quidditch_team_career.matches+1,wins=public.quidditch_team_career.wins+excluded.wins,
    draws=public.quidditch_team_career.draws+excluded.draws,losses=public.quidditch_team_career.losses+excluded.losses,
    goals_for=public.quidditch_team_career.goals_for+excluded.goals_for,
    goals_against=public.quidditch_team_career.goals_against+excluded.goals_against,updated_at=now();
end;$$;

drop function if exists public.get_quidditch_career_leaderboards();
create function public.get_quidditch_career_leaderboards()
returns table(goal_leaders jsonb,winrate_leaders jsonb,team_leaders jsonb)
language plpgsql security definer set search_path=public as $$
declare v_match bigint:=floor(extract(epoch from clock_timestamp())/235)::bigint;v_elapsed integer:=floor(extract(epoch from(clock_timestamp()-to_timestamp(v_match*235))))::integer;
begin
  perform public.finalize_quidditch_career_match(v_match-1);
  if v_elapsed>=205 then perform public.finalize_quidditch_career_match(v_match);end if;
  return query select
    coalesce((select jsonb_agg(to_jsonb(q) order by q.goals desc,q.matches asc,q.pet_name) from(
      select pet_name,owner_name,goals,matches from public.quidditch_pet_career order by goals desc,matches asc,pet_name limit 5)q),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(w) order by w.win_rate desc,w.wins desc,w.matches desc,w.pet_name) from(
      select pet_name,owner_name,matches,wins,round((wins::numeric/greatest(matches,1))*100,1) win_rate
      from public.quidditch_pet_career where matches>=3 order by win_rate desc,wins desc,matches desc,pet_name limit 5)w),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t) order by t.wins desc,t.matches asc,t.team_name) from(
      select team_name,matches,wins,draws,losses,goals_for from public.quidditch_team_career order by wins desc,matches asc,team_name limit 5)t),'[]'::jsonb);
end;$$;
grant execute on function public.get_quidditch_career_leaderboards() to anon,authenticated;
notify pgrst,'reload schema';

-- ============================================================
-- BACKGROUND QUIDDITCH HOST ELECTION
-- Any browser with the clan website open can keep the shared league advancing,
-- even when nobody has Quidditch Mode open. Only one browser holds the lease.
-- Safe to run repeatedly. Does not reset any existing Quidditch data.
-- ============================================================
create table if not exists public.quidditch_background_host (
  singleton boolean primary key default true check (singleton),
  viewer_key text not null,
  user_id uuid,
  lease_expires_at timestamptz not null,
  last_heartbeat timestamptz not null default clock_timestamp()
);
alter table public.quidditch_background_host enable row level security;
revoke all on public.quidditch_background_host from public;

create or replace function public.quidditch_roster_for_match(p_match_id bigint)
returns jsonb language sql stable security definer set search_path=public as $$
  with ranked as (
    select c.username,c.active_pet,
      coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,
      c.equipped_pet_cosmetic,
      row_number() over(order by md5(p_match_id::text||':'||c.username)) rn
    from public.characters c
    where c.active_pet is not null and c.active_pet like 'pet_%'
    limit 30
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'username',username,'active_pet',active_pet,'pet_name',pet_name,
    'equipped_pet_cosmetic',equipped_pet_cosmetic,
    'side',case when rn%2=1 then 'left' else 'right' end,
    'slot',ceil(rn/2.0)::integer
  ) order by rn),'[]'::jsonb) from ranked;
$$;

create or replace function public.advance_live_quidditch_background(p_viewer_key text)
returns table(
  is_host boolean,
  host_key text,
  lease_expires_at timestamptz,
  match_id bigint,
  phase text
)
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_key text:=left(coalesce(nullif(trim(p_viewer_key),''),gen_random_uuid()::text),120);
  v_host text;v_expiry timestamptz;v_is_host boolean:=false;
  v_cycle bigint:=235;v_match bigint:=floor(extract(epoch from v_now)/235)::bigint;
  v_start timestamptz:=to_timestamp(v_match*235);
  v_elapsed integer:=floor(extract(epoch from(v_now-v_start)))::integer;
  v_match_elapsed integer:=greatest(0,least(180,v_elapsed-25));
  v_phase text:=case when v_elapsed<25 then 'lineup' when v_elapsed<205 then 'live' else 'post' end;
  v_roster jsonb;v_previous_roster jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('repo-quidditch-background-host'));

  select h.viewer_key,h.lease_expires_at into v_host,v_expiry
  from public.quidditch_background_host h where h.singleton=true;

  if v_host is null or v_expiry<=v_now or v_host=v_key then
    insert into public.quidditch_background_host(singleton,viewer_key,user_id,lease_expires_at,last_heartbeat)
    values(true,v_key,auth.uid(),v_now+interval '14 seconds',v_now)
    on conflict(singleton) do update set
      viewer_key=excluded.viewer_key,user_id=excluded.user_id,
      lease_expires_at=excluded.lease_expires_at,last_heartbeat=excluded.last_heartbeat;
    v_host:=v_key;v_expiry:=v_now+interval '14 seconds';v_is_host:=true;
  end if;

  if v_is_host then
    -- Advance the current game according to the shared server clock.
    v_roster:=public.quidditch_roster_for_match(v_match);
    if v_phase='live' or v_phase='post' then
      perform public.ensure_live_quidditch_goals(v_match,v_match_elapsed,v_roster);
    end if;

    -- Fully generate and finalise the previous game before career totals are updated.
    v_previous_roster:=public.quidditch_roster_for_match(v_match-1);
    perform public.ensure_live_quidditch_goals(v_match-1,180,v_previous_roster);
    perform public.finalize_quidditch_career_match(v_match-1);
    if v_phase='post' then perform public.finalize_quidditch_career_match(v_match);end if;
  end if;

  return query select v_is_host,v_host,v_expiry,v_match,v_phase;
end;$$;

grant execute on function public.quidditch_roster_for_match(bigint) to anon,authenticated;
grant execute on function public.advance_live_quidditch_background(text) to anon,authenticated;
notify pgrst,'reload schema';


-- FINAL RULES: no draw predictions and no drawn completed matches.
delete from public.quidditch_predictions where picked_side='draw';
alter table public.quidditch_predictions drop constraint if exists quidditch_predictions_picked_side_check;
alter table public.quidditch_predictions add constraint quidditch_predictions_picked_side_check check (picked_side in ('left','right'));

create or replace function public.predict_live_quidditch(p_match_id bigint,p_side text)
returns text language plpgsql security definer set search_path=public as $$
declare v_now_match bigint:=floor(extract(epoch from clock_timestamp())/235)::bigint;v_elapsed integer:=floor(extract(epoch from clock_timestamp()))::integer%235;v_pick text;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction';end if;
  if p_match_id<>v_now_match or v_elapsed>=25 then raise exception 'Predictions are closed for this match';end if;
  if p_side not in('left','right') then raise exception 'Choose one of the two teams';end if;
  insert into public.quidditch_predictions(match_id,user_id,picked_side,paid,created_at)
  values(p_match_id,auth.uid(),p_side,false,clock_timestamp())
  on conflict(match_id,user_id) do update set
    picked_side=excluded.picked_side,
    paid=false,
    created_at=excluded.created_at;
  select qp.picked_side into v_pick from public.quidditch_predictions qp where qp.match_id=p_match_id and qp.user_id=auth.uid();
  return v_pick;
end;$$;

-- If regulation would finish level, the final authoritative goal acts as sudden death.
create or replace function public.ensure_live_quidditch_goals(p_match_id bigint,p_elapsed integer,p_roster jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare i integer;v_count integer:=5+(abs(p_match_id)%2)::integer;v_second integer;v_side text;v_names text[];v_pet text;v_idx integer;v_left integer;v_right integer;
begin
  for i in 0..v_count-1 loop
    v_second:=20+i*floor(158.0/greatest(1,v_count-1))::integer+((abs(p_match_id+i*17)%7)::integer-3);
    if p_elapsed>=v_second then
      v_side:=case when (p_match_id+i)%2=0 then 'left' else 'right' end;
      select array_agg(x->>'pet_name' order by x->>'pet_name') into v_names from jsonb_array_elements(coalesce(p_roster,'[]'::jsonb))x where x->>'side'=v_side;
      if coalesce(array_length(v_names,1),0)>0 then v_idx:=1+(abs(p_match_id*31+i*13)%array_length(v_names,1))::integer;v_pet:=v_names[v_idx];insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at) values(p_match_id,'broadcast-goal:'||p_match_id||':'||i,v_side,v_pet,to_timestamp(p_match_id*235)+interval '25 seconds'+make_interval(secs=>v_second)) on conflict(event_key) do nothing;end if;
    end if;
  end loop;
  if p_elapsed>=180 then
    select count(*)filter(where side='left'),count(*)filter(where side='right') into v_left,v_right from public.quidditch_goals where match_id=p_match_id;
    if v_left=v_right then
      v_side:=case when abs(hashtext(p_match_id::text||':sudden-death'))%2=0 then 'left' else 'right' end;
      select array_agg(x->>'pet_name' order by x->>'pet_name') into v_names from jsonb_array_elements(coalesce(p_roster,'[]'::jsonb))x where x->>'side'=v_side;
      if coalesce(array_length(v_names,1),0)>0 then v_pet:=v_names[1+(abs(hashtext(p_match_id::text||':winner'))%array_length(v_names,1))];insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at) values(p_match_id,'broadcast-sudden-death:'||p_match_id,v_side,v_pet,to_timestamp(p_match_id*235)+interval '204 seconds') on conflict(event_key) do nothing;end if;
    end if;
  end if;
end;$$;

grant execute on function public.predict_live_quidditch(bigint,text) to authenticated;
grant execute on function public.ensure_live_quidditch_goals(bigint,integer,jsonb) to anon,authenticated;
notify pgrst,'reload schema';

-- Throw 200 GP to the Repo Sports commentator once per Quidditch match.
-- A new match ID automatically unlocks the button again for every user.
create table if not exists public.quidditch_commentator_tips (
  id bigint generated by default as identity primary key,
  user_id uuid not null,
  character_name text,
  match_id bigint,
  amount integer not null default 200 check (amount=200),
  tipped_at timestamptz not null default clock_timestamp()
);
alter table public.quidditch_commentator_tips add column if not exists match_id bigint;
create unique index if not exists quidditch_commentator_tips_user_match_uidx
  on public.quidditch_commentator_tips(user_id,match_id) where match_id is not null;
alter table public.quidditch_commentator_tips enable row level security;
revoke all on public.quidditch_commentator_tips from public;

drop function if exists public.tip_quidditch_commentator();
drop function if exists public.tip_quidditch_commentator(bigint);
create function public.tip_quidditch_commentator(p_match_id bigint)
returns table(remaining_gp bigint,total_tips bigint,lifetime_tip_gp bigint)
language plpgsql security definer set search_path=public as $$
declare
  v_character public.characters%rowtype;
  v_total bigint;
  v_current_match bigint:=floor(extract(epoch from clock_timestamp())/235)::bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to throw coins';end if;
  if p_match_id is null or p_match_id<>v_current_match then raise exception 'That match has ended. Try again in the current match';end if;
  perform pg_advisory_xact_lock(hashtext('quidditch-tip:'||auth.uid()::text||':'||p_match_id::text));
  if exists(select 1 from public.quidditch_commentator_tips where user_id=auth.uid() and match_id=p_match_id) then
    raise exception 'You have already tipped the commentator this match';
  end if;
  select * into v_character from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found';end if;
  if coalesce(v_character.gp,0)<200 then raise exception 'You need 200 GP to throw coins';end if;
  update public.characters set gp=coalesce(gp,0)-200 where id=v_character.id returning * into v_character;
  insert into public.quidditch_commentator_tips(user_id,character_name,match_id,amount)
    values(auth.uid(),v_character.username,p_match_id,200);
  select count(*) into v_total from public.quidditch_commentator_tips where match_id=p_match_id;
  return query select coalesce(v_character.gp,0)::bigint,v_total,
    coalesce((select sum(amount)::bigint from public.quidditch_commentator_tips),0::bigint);
end;$$;
grant execute on function public.tip_quidditch_commentator(bigint) to authenticated;

drop function if exists public.get_quidditch_commentator_total_tips();
create function public.get_quidditch_commentator_total_tips()
returns bigint language sql stable security definer set search_path=public as $$
  select coalesce(sum(amount),0)::bigint from public.quidditch_commentator_tips;
$$;
grant execute on function public.get_quidditch_commentator_total_tips() to anon,authenticated;

drop function if exists public.has_tipped_quidditch_commentator();
drop function if exists public.has_tipped_quidditch_commentator(bigint);
create function public.has_tipped_quidditch_commentator(p_match_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(
    select 1 from public.quidditch_commentator_tips
    where user_id=auth.uid() and match_id=p_match_id
  );
$$;
grant execute on function public.has_tipped_quidditch_commentator(bigint) to authenticated;
notify pgrst,'reload schema';


-- ============================================================
-- NATURAL MATCH SCORE DISTRIBUTION
-- Replaces the old alternating 3-2 / 3-3-heavy goal schedule.
-- Results remain deterministic and identical for every viewer.
-- ============================================================
create or replace function public.ensure_live_quidditch_goals(p_match_id bigint,p_elapsed integer,p_roster jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  i integer;
  v_roll integer:=abs(hashtext(p_match_id::text||':score-profile'))%1000;
  v_profile integer:=abs(hashtext(p_match_id::text||':match-style'))%1000;
  v_count integer;
  v_second integer;
  v_side text;
  v_favoured text:=case when abs(hashtext(p_match_id::text||':favoured'))%2=0 then 'left' else 'right' end;
  v_names text[];
  v_pet text;
  v_idx integer;
  v_left integer;
  v_right integer;
  v_gap integer;
  v_base integer;
  v_jitter integer;
begin
  -- Rough distribution:
  --  8% low-scoring (1-3 regulation goals)
  -- 70% normal matches (4-6)
  -- 17% lively matches (7-8)
  --  4% high-scoring matches (9-10)
  --  1% rare chaos (11-13)
  if v_roll<80 then
    v_count:=1+(abs(hashtext(p_match_id::text||':low'))%3);
  elsif v_roll<780 then
    v_count:=4+(abs(hashtext(p_match_id::text||':normal'))%3);
  elsif v_roll<950 then
    v_count:=7+(abs(hashtext(p_match_id::text||':lively'))%2);
  elsif v_roll<990 then
    v_count:=9+(abs(hashtext(p_match_id::text||':high'))%2);
  else
    v_count:=11+(abs(hashtext(p_match_id::text||':chaos'))%3);
  end if;

  for i in 0..v_count-1 loop
    -- About 9% of matches have a memorable 20-30 second goal flurry.
    if v_profile<90 and i>=greatest(1,v_count/3) and i<greatest(1,v_count/3)+least(3,v_count-1) then
      v_base:=62+(abs(hashtext(p_match_id::text||':flurry-start'))%55);
      v_second:=v_base+(i-greatest(1,v_count/3))*8+(abs(hashtext(p_match_id::text||':flurry:'||i))%4);
    else
      v_gap:=floor(158.0/greatest(1,v_count-1))::integer;
      v_jitter:=(abs(hashtext(p_match_id::text||':time:'||i))%greatest(3,least(10,v_gap/3+1)))-3;
      v_second:=greatest(9,least(178,16+i*v_gap+v_jitter));
    end if;

    if p_elapsed>=v_second then
      -- Rare blowouts favour one side strongly; most games remain competitive
      -- without mechanically alternating every goal.
      if v_profile>=90 and v_profile<155 then
        v_side:=case when abs(hashtext(p_match_id::text||':side:'||i))%100<76 then v_favoured
                     when v_favoured='left' then 'right' else 'left' end;
      else
        v_side:=case when abs(hashtext(p_match_id::text||':side:'||i))%2=0 then 'left' else 'right' end;
      end if;

      select array_agg(x->>'pet_name' order by x->>'pet_name') into v_names
      from jsonb_array_elements(coalesce(p_roster,'[]'::jsonb)) x
      where x->>'side'=v_side;

      if coalesce(array_length(v_names,1),0)>0 then
        v_idx:=1+(abs(hashtext(p_match_id::text||':scorer:'||i))%array_length(v_names,1));
        v_pet:=v_names[v_idx];
        insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
        values(
          p_match_id,
          'broadcast-goal:'||p_match_id::text||':'||i::text,
          v_side,
          v_pet,
          to_timestamp(p_match_id*235)+interval '25 seconds'+make_interval(secs=>v_second)
        ) on conflict(event_key) do nothing;
      end if;
    end if;
  end loop;

  -- Regulation draws proceed to next-goal-wins sudden death.
  if p_elapsed>=180 then
    select count(*) filter(where side='left'),count(*) filter(where side='right')
      into v_left,v_right
    from public.quidditch_goals where match_id=p_match_id;
    if v_left=v_right then
      v_side:=case when abs(hashtext(p_match_id::text||':sudden-death'))%2=0 then 'left' else 'right' end;
      select array_agg(x->>'pet_name' order by x->>'pet_name') into v_names
      from jsonb_array_elements(coalesce(p_roster,'[]'::jsonb)) x where x->>'side'=v_side;
      if coalesce(array_length(v_names,1),0)>0 then
        v_pet:=v_names[1+(abs(hashtext(p_match_id::text||':sudden-scorer'))%array_length(v_names,1))];
        insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
        values(p_match_id,'broadcast-sudden-death:'||p_match_id::text,v_side,v_pet,
          to_timestamp(p_match_id*235)+interval '205 seconds'+make_interval(secs=>4+(abs(hashtext(p_match_id::text||':sd-delay'))%16)))
        on conflict(event_key) do nothing;
      end if;
    end if;
  end if;
end;$$;

grant execute on function public.ensure_live_quidditch_goals(bigint,integer,jsonb) to anon,authenticated;
notify pgrst,'reload schema';

-- Compatibility leaderboard endpoint. This version only reads the career tables,
-- so a temporary match-finalisation issue cannot stop the panels loading.
drop function if exists public.get_quidditch_career_leaderboards_v2();
create function public.get_quidditch_career_leaderboards_v2()
returns table(goal_leaders jsonb,winrate_leaders jsonb,team_leaders jsonb)
language sql security definer set search_path=public as $$
  select
    coalesce((select jsonb_agg(to_jsonb(q) order by q.goals desc,q.matches asc,q.pet_name) from(
      select pet_name,owner_name,goals,matches from public.quidditch_pet_career
      order by goals desc,matches asc,pet_name limit 5)q),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(w) order by w.win_rate desc,w.wins desc,w.matches desc,w.pet_name) from(
      select pet_name,owner_name,matches,wins,round((wins::numeric/greatest(matches,1))*100,1) win_rate
      from public.quidditch_pet_career where matches>=1
      order by win_rate desc,wins desc,matches desc,pet_name limit 5)w),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t) order by t.wins desc,t.matches asc,t.team_name) from(
      select team_name,matches,wins,draws,losses,goals_for from public.quidditch_team_career
      order by wins desc,matches asc,team_name limit 5)t),'[]'::jsonb);
$$;
grant execute on function public.get_quidditch_career_leaderboards_v2() to anon,authenticated;
notify pgrst,'reload schema';

-- ============================================================
-- BARRY BRAMBLE 250,000 GP COMMUNITY MILESTONE
-- Unlocks Barry's Boater globally for all current and future players.
-- Safe to run repeatedly.
-- ============================================================
create or replace function public.grant_barrys_boater_if_unlocked()
returns bigint language plpgsql security definer set search_path=public as $$
declare v_total bigint;
begin
  select coalesce(sum(amount),0)::bigint into v_total from public.quidditch_commentator_tips;
  if v_total>=250000 then
    update public.characters c
       set bank_items=jsonb_set(coalesce(c.bank_items,'{}'::jsonb),'{barrys_boater}','1'::jsonb,true)
     where coalesce((c.bank_items->>'barrys_boater')::integer,0)<1;
  end if;
  return v_total;
end;$$;
grant execute on function public.grant_barrys_boater_if_unlocked() to anon,authenticated;

create or replace function public.apply_barrys_boater_to_new_character()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce((select sum(amount) from public.quidditch_commentator_tips),0)>=250000 then
    new.bank_items:=jsonb_set(coalesce(new.bank_items,'{}'::jsonb),'{barrys_boater}','1'::jsonb,true);
  end if;
  return new;
end;$$;
drop trigger if exists trg_apply_barrys_boater on public.characters;
create trigger trg_apply_barrys_boater
before insert on public.characters
for each row execute function public.apply_barrys_boater_to_new_character();

-- Recreate tipping so crossing the target grants the cosmetic immediately.
drop function if exists public.tip_quidditch_commentator(bigint);
create function public.tip_quidditch_commentator(p_match_id bigint)
returns table(remaining_gp bigint,total_tips bigint,lifetime_tip_gp bigint)
language plpgsql security definer set search_path=public as $$
declare
  v_character public.characters%rowtype;
  v_match_tips bigint;
  v_lifetime bigint;
  v_current_match bigint:=floor(extract(epoch from clock_timestamp())/235)::bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to throw coins';end if;
  if p_match_id is null or p_match_id<>v_current_match then raise exception 'That match has ended. Try again in the current match';end if;
  perform pg_advisory_xact_lock(hashtext('quidditch-tip:'||auth.uid()::text||':'||p_match_id::text));
  if exists(select 1 from public.quidditch_commentator_tips where user_id=auth.uid() and match_id=p_match_id) then
    raise exception 'You have already tipped the commentator this match';
  end if;
  select * into v_character from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found';end if;
  if coalesce(v_character.gp,0)<200 then raise exception 'You need 200 GP to throw coins';end if;
  update public.characters set gp=coalesce(gp,0)-200 where id=v_character.id returning * into v_character;
  insert into public.quidditch_commentator_tips(user_id,character_name,match_id,amount)
  values(auth.uid(),v_character.username,p_match_id,200);
  select count(*) into v_match_tips from public.quidditch_commentator_tips where match_id=p_match_id;
  v_lifetime:=public.grant_barrys_boater_if_unlocked();
  return query select coalesce(v_character.gp,0)::bigint,v_match_tips,v_lifetime;
end;$$;
grant execute on function public.tip_quidditch_commentator(bigint) to authenticated;

-- Ensure an already-completed target is granted immediately when this SQL runs.
select public.grant_barrys_boater_if_unlocked();

-- Allow the newly unlocked cosmetic to be equipped.
create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare v_active_pet text;v_items jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in';end if;
  if p_cosmetic is not null and p_cosmetic not in(
    'chefs_hat','fire_cape','odd_spectacles','infernal_cape','infernal_max_cape',
    'bucket_helm','golden_bucket_helm','harmony_skillcape','barrys_boater'
  ) then raise exception 'Unsupported pet cosmetic';end if;
  select c.active_pet,coalesce(c.bank_items,'{}'::jsonb) into v_active_pet,v_items
  from public.characters c where c.user_id=auth.uid() for update;
  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first';end if;
  if p_cosmetic is not null and coalesce((v_items->>p_cosmetic)::integer,0)<1 then raise exception 'That reward is not in your Bank';end if;
  update public.characters c set equipped_pet_cosmetic=p_cosmetic where c.user_id=auth.uid();
  return query select p_cosmetic;
end;$$;
grant execute on function public.set_pet_cosmetic(text) to authenticated;
notify pgrst,'reload schema';
