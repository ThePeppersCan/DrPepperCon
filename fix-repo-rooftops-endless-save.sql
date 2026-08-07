-- REPO COMPANY — REPO ROOFTOPS ENDLESS SAVE / LEADERBOARD FIX
-- Fixes long Endless runs falling into PENDING SAVE before repo_rooftops_claim_run.
-- The client patch stops replaying every rooftop RPC at run end; this server patch
-- safely reconciles a believable missing tail of rooftop validations in one
-- idempotent claim. Existing claimed runs/rewards are not changed.
-- Safe to run after the existing Repo Rooftops SQL/hotfixes.

create or replace function public.repo_rooftops_start_run(p_mode text, p_seed text default null)
returns table(run_id uuid, seed text, server_started_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text := lower(trim(coalesce(p_mode,'')));
  v_seed text;
  v_id uuid;
  v_started timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;
  if v_mode not in ('endless','daily','hardcore','timetrial') then raise exception 'Invalid Repo Rooftops mode'; end if;

  update public.repo_rooftops_runs r set status='abandoned',ended_at=coalesce(ended_at,now())
   where r.user_id=v_uid and r.status='active' and r.started_at < now()-interval '8 hours';

  if v_mode='daily' then
    v_seed := 'daily-'||to_char(now() at time zone 'Europe/London','YYYY-MM-DD');
  else
    v_seed := left(coalesce(nullif(trim(p_seed),''),v_mode||'-'||replace(gen_random_uuid()::text,'-','')),120);
  end if;

  insert into public.repo_rooftops_runs(user_id,mode,seed,started_at)
  values(v_uid,v_mode,v_seed,v_started)
  returning id into v_id;

  insert into public.repo_rooftops_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  return query select v_id,v_seed,v_started;
end;
$$;

create or replace function public.repo_rooftops_claim_run(
  p_run_id uuid,
  p_height integer,
  p_rooftop_level integer,
  p_score bigint,
  p_client_duration_ms bigint,
  p_district text,
  p_momentum integer,
  p_collectable_gp integer,
  p_risk_gp integer,
  p_marks_collected integer default 0
)
returns table(
  height_gp integer,
  level_gp integer,
  difficulty_gp integer,
  collectable_gp integer,
  risk_gp integer,
  momentum_gp integer,
  personal_best_gp integer,
  milestone_gp integer,
  agility_xp_gained integer,
  total_gp integer,
  new_gp integer,
  new_agility_xp integer,
  is_personal_best boolean,
  already_claimed boolean,
  mark_balance integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.repo_rooftops_runs%rowtype;
  v_profile public.repo_rooftops_profiles%rowtype;
  v_character public.characters%rowtype;
  v_server_ms bigint;
  v_recorded_levels integer;
  v_recorded_height integer;
  v_height integer;
  v_levels integer;
  v_score bigint;
  v_collect integer;
  v_risk integer;
  v_momentum integer;
  v_marks integer;
  v_height_gp integer := 0;
  v_level_gp integer := 0;
  v_difficulty_gp integer := 0;
  v_momentum_gp integer := 0;
  v_pb_gp integer := 0;
  v_milestone_gp integer := 0;
  v_agility integer := 0;
  v_repeatable integer := 0;
  v_total integer := 0;
  v_pb boolean := false;
  v_pct numeric := 0;
  v_remaining integer;
  v_band integer;
  v_m integer;
  v_bonus integer;
  v_new_gp integer;
  v_new_xp integer;
  v_stats jsonb;
  v_ach jsonb;
  v_districts jsonb;
  v_items jsonb;
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;

  select * into v_run from public.repo_rooftops_runs r
   where r.id=p_run_id and r.user_id=v_uid for update;
  if not found then raise exception 'Repo Rooftops run not found'; end if;

  select * into v_character from public.characters c where c.user_id=v_uid for update;
  if not found then raise exception 'Character not found'; end if;
  insert into public.repo_rooftops_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  select * into v_profile from public.repo_rooftops_profiles p where p.user_id=v_uid for update;

  if v_run.status='claimed' then
    return query select v_run.height_gp,v_run.level_gp,v_run.difficulty_gp,v_run.collectable_gp,
      v_run.risk_gp,v_run.momentum_gp,v_run.personal_best_gp,v_run.milestone_gp,
      v_run.agility_xp_gained,v_run.total_gp,v_character.gp,v_character.agility_xp,
      v_run.is_personal_best,true,v_profile.mark_balance;
    return;
  end if;
  if v_run.status<>'active' then raise exception 'This run can no longer be rewarded'; end if;

  v_server_ms := greatest(1000,(extract(epoch from(clock_timestamp()-v_run.started_at))*1000)::bigint);
  if p_client_duration_ms is null or p_client_duration_ms < 500 then raise exception 'Invalid run duration'; end if;
  if p_client_duration_ms > v_server_ms+120000 then raise exception 'Run duration failed validation'; end if;

  select coalesce(max(l.level_number),0),coalesce(max(l.completed_height),0)
    into v_recorded_levels,v_recorded_height
  from public.repo_rooftops_levels l where l.run_id=p_run_id and l.completed_at is not null;

  v_height := greatest(0,coalesce(p_height,0));
  v_levels := greatest(0,least(coalesce(p_rooftop_level,0),v_recorded_levels));

  -- New clients synchronise every completed rooftop before claiming. This guarded
  -- fallback recovers older pending runs where completion RPCs were lost, while
  -- still enforcing believable server time, height and rooftop counts.
  if coalesce(p_rooftop_level,0)>v_recorded_levels then
    if coalesce(p_rooftop_level,0) <= greatest(0,floor(v_server_ms/2500.0)::integer)
       and coalesce(p_rooftop_level,0) <= greatest(0,floor((v_height+180)/40.0)::integer)
       and v_height <= 250+floor((v_server_ms/1000.0)*130)::integer then
      v_levels := greatest(0,coalesce(p_rooftop_level,0));
      v_recorded_height := greatest(v_recorded_height,v_height);
      update public.repo_rooftops_runs r
         set completed_levels=greatest(r.completed_levels,v_levels),
             highest_height=greatest(r.highest_height,v_height)
       where r.id=p_run_id;
    else
      raise exception 'One or more rooftop levels were not validated';
    end if;
  end if;

  if v_height > greatest(120,v_recorded_height+120) then raise exception 'Final height exceeds the validated route'; end if;
  if v_height > 250+floor((v_server_ms/1000.0)*130)::integer then raise exception 'Run speed failed validation'; end if;

  v_score := greatest(0,least(coalesce(p_score,0),greatest(10000::bigint,v_height::bigint*2500+v_levels::bigint*25000)));
  v_momentum := greatest(0,least(coalesce(p_momentum,0),100));
  v_collect := greatest(0,least(coalesce(p_collectable_gp,0),floor((v_levels*1200+5000)*0.05)::integer));
  v_risk := greatest(0,least(coalesce(p_risk_gp,0),floor((v_levels*2500+6000)*0.05)::integer));
  select count(*)::integer into v_marks from public.repo_rooftops_marks m
   where m.run_id=p_run_id and m.user_id=v_uid and m.collected_at is not null;

  if v_height>=50 or v_levels>=5 then
    v_remaining:=v_height;
    v_band:=least(v_remaining,500);v_height_gp:=v_height_gp+floor(v_band*0.5)::integer;v_remaining:=v_remaining-v_band;
    if v_remaining>0 then v_band:=least(v_remaining,500);v_height_gp:=v_height_gp+floor(v_band*0.375)::integer;v_remaining:=v_remaining-v_band;end if;
    if v_remaining>0 then v_band:=least(v_remaining,1000);v_height_gp:=v_height_gp+floor(v_band*0.25)::integer;v_remaining:=v_remaining-v_band;end if;
    if v_remaining>0 then v_height_gp:=v_height_gp+floor(v_remaining*0.15)::integer;end if;

    v_level_gp:=floor(v_levels*3.75)::integer;
    if v_height>=1500 then v_difficulty_gp:=375+floor((v_height-1500)/700.0)::integer*100;
    elsif v_height>=1000 then v_difficulty_gp:=225;
    elsif v_height>=600 then v_difficulty_gp:=125;
    elsif v_height>=300 then v_difficulty_gp:=63;
    elsif v_height>=100 then v_difficulty_gp:=25;
    end if;

    v_pct:=case when v_momentum>=85 then .12 when v_momentum>=65 then .09 when v_momentum>=45 then .06 when v_momentum>=25 then .03 else 0 end;
    v_momentum_gp:=least(1250,floor((v_height_gp+v_level_gp+v_difficulty_gp+v_collect+v_risk)*v_pct)::integer);
    v_repeatable:=least(6250,v_height_gp+v_level_gp+v_difficulty_gp+v_collect+v_risk+v_momentum_gp);

    v_pb:=v_height>v_profile.best_height;
    if v_pb then v_pb_gp:=least(2500,floor(125+greatest(0,v_height-v_profile.best_height)*1.25)::integer);end if;

    for v_m,v_bonus in select * from (values
      (100,250),(250,625),(500,1250),(750,1875),(1000,2500),
      (1500,3750),(2000,5000),(3000,7500),(5000,12500)
    ) as milestones(height,gp)
    loop
      if v_height>=v_m then
        insert into public.repo_rooftops_milestones(user_id,height,gp_awarded,run_id)
        values(v_uid,v_m,v_bonus,p_run_id) on conflict(user_id,height) do nothing;
        if found then v_milestone_gp:=v_milestone_gp+v_bonus;end if;
      end if;
    end loop;

    v_agility:=least(25000,greatest(1,floor(v_height*2.5)::integer+v_levels*35+v_momentum*5));
  else
    v_collect:=0;v_risk:=0;
  end if;

  v_total:=v_repeatable+v_pb_gp+v_milestone_gp;
  v_new_gp:=coalesce(v_character.gp,0)+v_total;
  v_new_xp:=coalesce(v_character.agility_xp,0)+v_agility;
  v_items:=coalesce(v_character.bank_items,'{}'::jsonb);
  v_items:=jsonb_set(v_items,'{marks_of_grace}',to_jsonb(v_profile.mark_balance),true);

  update public.characters c set gp=v_new_gp,agility_xp=v_new_xp,bank_items=v_items where c.user_id=v_uid;
  if v_agility>0 then
    insert into public.repo_rooftops_xp_ledger(user_id,run_id,xp_gained)
    values(v_uid,p_run_id,v_agility) on conflict(run_id) do nothing;
  end if;

  v_stats:=coalesce(v_profile.stats,'{}'::jsonb);
  v_districts:=case when jsonb_typeof(v_stats->'districts')='array' then v_stats->'districts' else '[]'::jsonb end;
  if not v_districts ? left(coalesce(p_district,'Old Town Rooftops'),80) then
    v_districts:=v_districts||to_jsonb(left(coalesce(p_district,'Old Town Rooftops'),80));
  end if;
  v_stats:=v_stats||jsonb_build_object(
    'districts',v_districts,
    'deaths',coalesce((v_stats->>'deaths')::integer,0)+1,
    'best_momentum',greatest(coalesce((v_stats->>'best_momentum')::integer,0),v_momentum),
    'marks_collected',v_profile.mark_balance,
    'daily_completed',coalesce((v_stats->>'daily_completed')::integer,0)+case when v_run.mode='daily' then 1 else 0 end
  );

  v_ach:=coalesce(v_profile.achievements,'{}'::jsonb);
  if v_height>=100 then v_ach:=jsonb_set(v_ach,'{height_100}','true'::jsonb,true);end if;
  if v_height>=500 then v_ach:=jsonb_set(v_ach,'{height_500}','true'::jsonb,true);end if;
  if v_height>=1000 then v_ach:=jsonb_set(v_ach,'{height_1000}','true'::jsonb,true);end if;
  if v_height>=2000 then v_ach:=jsonb_set(v_ach,'{height_2000}','true'::jsonb,true);end if;
  if v_levels>=100 then v_ach:=jsonb_set(v_ach,'{levels_100}','true'::jsonb,true);end if;
  if v_profile.mark_balance>=1 then v_ach:=jsonb_set(v_ach,'{first_mark}','true'::jsonb,true);end if;
  if v_marks>=2 then v_ach:=jsonb_set(v_ach,'{multi_mark}','true'::jsonb,true);end if;
  if v_height>=1500 then v_ach:=jsonb_set(v_ach,'{nightmare}','true'::jsonb,true);end if;
  if v_run.mode='daily' then v_ach:=jsonb_set(v_ach,'{daily}','true'::jsonb,true);end if;
  if jsonb_array_length(v_districts)>=7 then v_ach:=jsonb_set(v_ach,'{districts}','true'::jsonb,true);end if;

  update public.repo_rooftops_profiles p set
    best_height=greatest(p.best_height,v_height),best_level=greatest(p.best_level,v_levels),
    total_runs=p.total_runs+1,total_gp_earned=p.total_gp_earned+v_total,total_metres=p.total_metres+v_height,
    total_playtime_ms=p.total_playtime_ms+v_server_ms,stats=v_stats,achievements=v_ach,updated_at=now()
   where p.user_id=v_uid;

  update public.repo_rooftops_runs r set status='claimed',ended_at=clock_timestamp(),claimed_at=clock_timestamp(),
    highest_height=v_height,completed_levels=v_levels,score=v_score,district=left(coalesce(p_district,'Old Town Rooftops'),80),
    max_momentum=v_momentum,collectable_gp=v_collect,risk_gp=v_risk,marks_collected=v_marks,duration_ms=v_server_ms,
    height_gp=v_height_gp,level_gp=v_level_gp,difficulty_gp=v_difficulty_gp,momentum_gp=v_momentum_gp,
    personal_best_gp=v_pb_gp,milestone_gp=v_milestone_gp,agility_xp_gained=v_agility,total_gp=v_total,is_personal_best=v_pb
   where r.id=p_run_id;

  return query select v_height_gp,v_level_gp,v_difficulty_gp,v_collect,v_risk,v_momentum_gp,
    v_pb_gp,v_milestone_gp,v_agility,v_total,v_new_gp,v_new_xp,v_pb,false,v_profile.mark_balance;
end;
$$;


grant execute on function public.repo_rooftops_start_run(text,text) to authenticated;
grant execute on function public.repo_rooftops_claim_run(uuid,integer,integer,bigint,bigint,text,integer,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
