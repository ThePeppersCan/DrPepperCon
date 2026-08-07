-- REPO SPORTS QUIDDITCH GROUND — progression + final QA hardening v4
-- Run ONCE in the Supabase SQL Editor after the original
-- add-repo-sports-quidditch-survivor.sql migration.
--
-- Scope is intentionally isolated to Repo Sports Quidditch Ground.
-- This does NOT alter normal Repo Combat save data, gameplay or leaderboards.

begin;

alter table public.repo_sports_survivor_profiles
  add column if not exists progression jsonb not null default '{}'::jsonb,
  add column if not exists data_version integer not null default 3;

-- Migrate the useful fields from the original profile row into the new versioned JSON
-- only when no v3 progression has been written yet. Missing future fields are supplied
-- safely by the client defaults, so existing players keep their old records.
update public.repo_sports_survivor_profiles
set progression = jsonb_build_object(
      'version',3,
      'runs',coalesce(total_runs,0),
      'bestScore',coalesce(best_score,0),
      'bestTime',coalesce(best_seconds,0),
      'bestKills',0,
      'bestLevel',0,
      'bestSnitches',0,
      'bestHit',0,
      'totals',jsonb_build_object(
        'survival',0,'kills',coalesce(total_kills,0),'elites',coalesce(total_elites,0),
        'bosses',coalesce(total_bosses,0),'snitches',coalesce(total_snitches,0),
        'damage',0,'xp',0,'distance',0,'flights',0,'cards',0,'gp',coalesce(total_gp_earned,0)
      ),
      'records',jsonb_build_object(
        'score',coalesce(best_score,0),'time',coalesce(best_seconds,0),'kills',0,'level',0,
        'elites',0,'bosses',0,'snitches',0,'hit',0,'damage',0,'xp',0,
        'fastestBoss',0,'noDamage',0,'gp',0
      )
    ),
    data_version = 3
where progression = '{}'::jsonb;

create table if not exists public.repo_sports_survivor_runs_v2 (
  run_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  score bigint not null default 0,
  seconds integer not null default 0,
  kills integer not null default 0,
  elites integer not null default 0,
  bosses integer not null default 0,
  snitches integer not null default 0,
  multiplier numeric(5,2) not null default 1.00,
  mode text not null default 'standard',
  modifiers text[] not null default '{}'::text[],
  build jsonb not null default '{}'::jsonb,
  gp_awarded integer not null default 0,
  game_version text not null default 'unknown',
  created_at timestamptz not null default now(),
  constraint repo_sports_survivor_runs_v2_mode_check check (mode in ('standard','custom')),
  constraint repo_sports_survivor_runs_v2_multiplier_check check (multiplier >= 1.00 and multiplier <= 2.50)
);

alter table public.repo_sports_survivor_runs_v2
  add column if not exists game_version text not null default 'unknown';

create index if not exists repo_sports_survivor_runs_v2_score_idx
  on public.repo_sports_survivor_runs_v2 (score desc, created_at asc);
create index if not exists repo_sports_survivor_runs_v2_user_idx
  on public.repo_sports_survivor_runs_v2 (user_id, created_at desc);

alter table public.repo_sports_survivor_runs_v2 enable row level security;
revoke all on public.repo_sports_survivor_runs_v2 from anon, authenticated;

-- Progression is returned only to the signed-in owner via this SECURITY DEFINER RPC.
create or replace function public.get_repo_sports_survivor_progression_v2()
returns table(
  progression jsonb,
  data_version integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(p.progression, '{}'::jsonb),
    coalesce(p.data_version, 3)
  from (select auth.uid() as uid) u
  left join public.repo_sports_survivor_profiles p on p.user_id = u.uid
  where u.uid is not null;
$$;

-- One idempotent submission per run. The run UUID is created when the match starts,
-- so refreshing/reopening results cannot award the same server-side run twice.
create or replace function public.complete_repo_sports_survivor_run_v2(
  p_run_id uuid,
  p_score bigint,
  p_seconds integer,
  p_kills integer,
  p_elites integer,
  p_bosses integer,
  p_snitches integer,
  p_multiplier numeric,
  p_mode text,
  p_modifiers text[],
  p_build jsonb,
  p_progression jsonb,
  p_test boolean default false
)
returns table(
  new_gp bigint,
  awarded_gp integer,
  best_score bigint,
  best_seconds integer,
  run_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_run_id uuid := p_run_id;
  v_seconds integer := greatest(0, least(coalesce(p_seconds,0), 3600));
  v_kills integer := greatest(0, least(coalesce(p_kills,0), 15000));
  v_elites integer := greatest(0, least(coalesce(p_elites,0), 2000));
  v_bosses integer := greatest(0, least(coalesce(p_bosses,0), 3));
  v_snitches integer := greatest(0, least(coalesce(p_snitches,0), 20));
  v_score bigint := greatest(0, least(coalesce(p_score,0), 25000000));
  v_mode text := case when lower(coalesce(p_mode,'standard'))='custom' then 'custom' else 'standard' end;
  v_modifiers text[] := '{}'::text[];
  v_modifier text;
  v_multiplier numeric(5,2) := 1.00;
  v_base_gp integer;
  v_gp integer;
  v_new_gp bigint;
  v_best_score bigint;
  v_best_seconds integer;
  v_existing_gp integer;
  v_existing_uid uuid;
  v_build jsonb := coalesce(p_build, '{}'::jsonb);
  v_progression jsonb := coalesce(p_progression, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'You must be logged in';
  end if;
  if v_run_id is null then
    raise exception 'Missing run id';
  end if;
  if coalesce(p_test,false) then
    raise exception 'Test runs are not submitted';
  end if;

  -- Keep payloads compact and version-safe. These blobs are display/progression data,
  -- never trusted as combat stats or GP authority.
  if jsonb_typeof(v_build) <> 'object' then v_build := '{}'::jsonb; end if;
  if jsonb_typeof(v_progression) <> 'object' then v_progression := '{}'::jsonb; end if;
  if octet_length(v_build::text) > 80000 then
    raise exception 'Run build payload is too large';
  end if;
  if octet_length(v_progression::text) > 300000 then
    raise exception 'Progression payload is too large';
  end if;

  -- Only recognised modifiers contribute to the server-side reward multiplier.
  -- Duplicate modifier ids are ignored.
  foreach v_modifier in array coalesce(p_modifiers, '{}'::text[]) loop
    if v_modifier = any(array[
      'faster_match','elite_league','no_recovery',
      'card_chaos','sudden_death','professional_league'
    ]::text[]) and not (v_modifier = any(v_modifiers)) then
      v_modifiers := array_append(v_modifiers, v_modifier);
      v_multiplier := v_multiplier + case v_modifier
        when 'faster_match' then 0.15
        when 'elite_league' then 0.20
        when 'no_recovery' then 0.18
        when 'card_chaos' then 0.12
        when 'sudden_death' then 0.30
        when 'professional_league' then 0.35
        else 0
      end;
    end if;
  end loop;
  v_multiplier := least(2.50, greatest(1.00, v_multiplier));
  if cardinality(v_modifiers) = 0 then v_mode := 'standard'; else v_mode := 'custom'; end if;

  -- Basic plausibility guards. They are intentionally generous so legitimate late-game
  -- builds are not rejected, while obviously impossible submissions cannot poison records.
  if coalesce(p_seconds,0) < 0 or coalesce(p_kills,0) < 0 or coalesce(p_elites,0) < 0
     or coalesce(p_bosses,0) < 0 or coalesce(p_snitches,0) < 0 or coalesce(p_score,0) < 0 then
    raise exception 'Negative run values are invalid';
  end if;
  if coalesce(p_bosses,0) > 3 then
    raise exception 'Invalid boss count';
  end if;
  if coalesce(p_snitches,0) > 20 then
    raise exception 'Invalid Snitch count';
  end if;
  if v_seconds < 1 and (v_kills > 0 or v_score > 0) then
    raise exception 'Invalid run duration';
  end if;
  if v_kills > greatest(250, v_seconds * 18) then
    raise exception 'Invalid kill count';
  end if;
  if (v_bosses >= 1 and v_seconds < 240)
     or (v_bosses >= 2 and v_seconds < 540)
     or (v_bosses >= 3 and v_seconds < 840) then
    raise exception 'Invalid boss timing';
  end if;
  if v_snitches > greatest(1, (v_seconds / 70) + 2) then
    raise exception 'Invalid Snitch count';
  end if;
  if v_elites > greatest(20, v_kills) then
    raise exception 'Invalid elite count';
  end if;
  if v_score > ceil((v_kills * 35 + v_elites * 250 + v_bosses * 30000 + v_snitches * 5000 + v_seconds * 10 + 5000) * v_multiplier) then
    raise exception 'Invalid score';
  end if;

  -- Idempotency: a browser retry for the same run returns the existing result and pays 0.
  select r.user_id, r.gp_awarded
    into v_existing_uid, v_existing_gp
  from public.repo_sports_survivor_runs_v2 r
  where r.run_id = v_run_id;

  if found then
    if v_existing_uid <> v_uid then
      raise exception 'Run id already belongs to another account';
    end if;
    select c.gp into v_new_gp from public.characters c where c.user_id=v_uid;
    select p.best_score,p.best_seconds into v_best_score,v_best_seconds
      from public.repo_sports_survivor_profiles p where p.user_id=v_uid;
    return query select coalesce(v_new_gp,0), 0, coalesce(v_best_score,0), coalesce(v_best_seconds,0), v_run_id;
    return;
  end if;

  -- Existing Quidditch GP formula, with only 35% of the optional score-modifier uplift
  -- applied to GP. This keeps challenge play rewarding without turning it into a GP farm.
  v_base_gp := least(25000,
    v_seconds * 2
      + v_kills * 3
      + v_elites * 45
      + v_bosses * 450
      + v_snitches * 650
  );
  v_gp := least(25000, floor(v_base_gp * (1 + (v_multiplier - 1) * 0.35))::integer);

  update public.characters
  set gp = coalesce(gp,0) + v_gp
  where user_id = v_uid
  returning gp into v_new_gp;
  if v_new_gp is null then raise exception 'Character not found'; end if;

  insert into public.repo_sports_survivor_profiles(
    user_id,best_score,best_seconds,total_runs,total_kills,total_elites,total_bosses,
    total_snitches,total_gp_earned,progression,data_version,updated_at
  ) values (
    v_uid,v_score,v_seconds,1,v_kills,v_elites,v_bosses,v_snitches,v_gp,
    jsonb_set(v_progression,'{version}','3'::jsonb,true),3,now()
  )
  on conflict (user_id) do update set
    best_score = greatest(repo_sports_survivor_profiles.best_score, excluded.best_score),
    best_seconds = greatest(repo_sports_survivor_profiles.best_seconds, excluded.best_seconds),
    total_runs = repo_sports_survivor_profiles.total_runs + 1,
    total_kills = repo_sports_survivor_profiles.total_kills + excluded.total_kills,
    total_elites = repo_sports_survivor_profiles.total_elites + excluded.total_elites,
    total_bosses = repo_sports_survivor_profiles.total_bosses + excluded.total_bosses,
    total_snitches = repo_sports_survivor_profiles.total_snitches + excluded.total_snitches,
    total_gp_earned = repo_sports_survivor_profiles.total_gp_earned + excluded.total_gp_earned,
    progression = excluded.progression,
    data_version = 3,
    updated_at = now()
  returning repo_sports_survivor_profiles.best_score, repo_sports_survivor_profiles.best_seconds
  into v_best_score, v_best_seconds;

  insert into public.repo_sports_survivor_runs_v2(
    run_id,user_id,score,seconds,kills,elites,bosses,snitches,multiplier,mode,modifiers,build,gp_awarded,game_version
  ) values (
    v_run_id,v_uid,v_score,v_seconds,v_kills,v_elites,v_bosses,v_snitches,
    v_multiplier,v_mode,v_modifiers,v_build,v_gp,left(coalesce(nullif(v_build->>'gameVersion',''),'unknown'),40)
  );

  return query select v_new_gp, v_gp, v_best_score, v_best_seconds, v_run_id;
end;
$$;

-- Public leaderboard exposes only display-safe aggregate run values and username.
-- Best run per player prevents one person filling the whole board.
create or replace function public.get_repo_sports_survivor_leaderboard_v2(p_limit integer default 20)
returns table(
  username text,
  score bigint,
  seconds integer,
  kills integer,
  multiplier numeric,
  mode text
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      r.user_id,r.score,r.seconds,r.kills,r.multiplier,r.mode,r.created_at,
      row_number() over(partition by r.user_id order by r.score desc, r.seconds desc, r.created_at asc) as rn
    from public.repo_sports_survivor_runs_v2 r
    where r.score >= 0 and r.multiplier between 1.00 and 2.50
  )
  select c.username, q.score, q.seconds, q.kills, q.multiplier, q.mode
  from ranked q
  join public.characters c on c.user_id=q.user_id
  where q.rn=1
  order by q.score desc, q.seconds desc, q.created_at asc
  limit greatest(1,least(coalesce(p_limit,20),50));
$$;

revoke all on function public.get_repo_sports_survivor_progression_v2() from public;
revoke all on function public.complete_repo_sports_survivor_run_v2(uuid,bigint,integer,integer,integer,integer,integer,numeric,text,text[],jsonb,jsonb,boolean) from public;
revoke all on function public.get_repo_sports_survivor_leaderboard_v2(integer) from public;

grant execute on function public.get_repo_sports_survivor_progression_v2() to authenticated;
grant execute on function public.complete_repo_sports_survivor_run_v2(uuid,bigint,integer,integer,integer,integer,integer,numeric,text,text[],jsonb,jsonb,boolean) to authenticated;
grant execute on function public.get_repo_sports_survivor_leaderboard_v2(integer) to anon, authenticated;

commit;
