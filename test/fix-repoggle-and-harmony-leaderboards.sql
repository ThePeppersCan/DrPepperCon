-- REPO COMPANY — REPOGGLE REWARD + HARMONIZE LEADERBOARD FIX
-- Run this entire file once in Supabase -> SQL Editor.
-- Additive/non-destructive: it preserves existing accounts, XP, GP and progress.

begin;

-- ---------------------------------------------------------------------------
-- 1) Repoggle reward save
-- ---------------------------------------------------------------------------
-- The function returns a field named best_score. PostgreSQL therefore treats an
-- unqualified best_score reference inside PL/pgSQL as ambiguous. This version
-- explicitly qualifies the progress-table columns and keeps the existing
-- one-time reward protection.

create or replace function public.complete_repoggle_level(
  p_session_id uuid,
  p_level_number integer,
  p_score bigint,
  p_star_rating integer,
  p_orbs_remaining integer,
  p_selected_power text,
  p_biggest_combo integer,
  p_catches integer,
  p_completion_ms bigint,
  p_power_activated boolean
)
returns table(
  rewards_awarded boolean,
  gold_awarded integer,
  xp_awarded integer,
  new_gp bigint,
  new_runecrafting_xp bigint,
  previous_best_score bigint,
  best_score bigint,
  best_star_rating integer,
  next_level_unlocked boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_session public.repoggle_sessions%rowtype;
  v_cfg public.repoggle_level_config%rowtype;
  v_existing public.repoggle_progress%rowtype;
  v_had_progress boolean := false;
  v_duration_seconds integer;
  v_duration_ms bigint;
  v_score bigint;
  v_stars integer;
  v_orbs integer;
  v_power text;
  v_combo integer;
  v_catches integer;
  v_reward boolean := false;
  v_new_gp bigint;
  v_new_xp bigint;
  v_best bigint;
  v_best_stars integer;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_level_number not between 1 and 50 then raise exception 'Invalid Repoggle level'; end if;

  select * into v_cfg from public.repoggle_level_config where level_number=p_level_number;
  if not found then raise exception 'Repoggle level configuration missing'; end if;

  select * into v_session
    from public.repoggle_sessions
   where id=p_session_id and user_id=v_user and level_number=p_level_number
   for update;
  if not found then raise exception 'Repoggle session not found'; end if;

  select * into v_existing
    from public.repoggle_progress
   where user_id=v_user and level_number=p_level_number
   for update;
  v_had_progress := found;

  -- Idempotent retry path: a repeated request never grants rewards again.
  if v_session.claimed then
    if not v_had_progress then raise exception 'Completed session has no progress record'; end if;
    select gp,runecrafting_xp into v_new_gp,v_new_xp from public.characters where user_id=v_user;
    return query select false,0,0,v_new_gp,v_new_xp,v_existing.best_score,v_existing.best_score,v_existing.best_star_rating,(p_level_number<50);
    return;
  end if;

  v_duration_seconds := floor(extract(epoch from (now()-v_session.started_at)))::integer;
  if v_duration_seconds < v_cfg.min_completion_seconds then
    raise exception 'Repoggle completion submitted too quickly';
  end if;
  v_duration_seconds := least(7200,greatest(v_cfg.min_completion_seconds,v_duration_seconds));
  v_duration_ms := v_duration_seconds::bigint*1000;

  -- Browser values are treated as performance claims, never as reward amounts.
  v_score := least(greatest(coalesce(p_score,0),0),v_cfg.star_3_score*20 + v_duration_seconds::bigint*50000);
  v_stars := case when v_score>=v_cfg.star_3_score then 3 when v_score>=v_cfg.star_2_score then 2 else 1 end;
  v_orbs := least(20,greatest(0,coalesce(p_orbs_remaining,0)));
  v_power := case when p_selected_power in ('air','water','earth','nature','law','chaos') then p_selected_power else 'air' end;
  v_combo := least(250,greatest(0,coalesce(p_biggest_combo,0)));
  v_catches := least(30,greatest(0,coalesce(p_catches,0)));
  -- Older Repoggle builds could save a completion row while leaving the reward
  -- unclaimed. Treat that row as eligible exactly once instead of permanently
  -- locking the player out of the level reward.
  v_reward := (not v_had_progress) or not coalesce(v_existing.reward_claimed,false);

  if v_had_progress then
    -- Qualify every source column with an alias. The function also returns a
    -- column named best_score, so unqualified references are ambiguous in PL/pgSQL.
    update public.repoggle_progress as rp set
      updated_at=now(),
      best_score=greatest(rp.best_score,v_score),
      best_star_rating=greatest(rp.best_star_rating,v_stars),
      best_orbs_remaining=greatest(rp.best_orbs_remaining,v_orbs),
      selected_power=case when v_score>=rp.best_score then v_power else rp.selected_power end,
      completion_count=rp.completion_count+1,
      reward_claimed=true,
      best_combo=greatest(rp.best_combo,v_combo),
      best_catches=greatest(rp.best_catches,v_catches),
      best_completion_ms=case when rp.best_completion_ms is null then v_duration_ms else least(rp.best_completion_ms,v_duration_ms) end,
      power_activated=rp.power_activated or coalesce(p_power_activated,false)
    where rp.user_id=v_user and rp.level_number=p_level_number
    returning rp.best_score,rp.best_star_rating into v_best,v_best_stars;
  else
    insert into public.repoggle_progress as rp(
      user_id,level_number,best_score,best_star_rating,best_orbs_remaining,
      selected_power,completion_count,reward_claimed,best_combo,best_catches,
      best_completion_ms,power_activated
    ) values(
      v_user,p_level_number,v_score,v_stars,v_orbs,v_power,1,true,v_combo,v_catches,
      v_duration_ms,coalesce(p_power_activated,false)
    ) returning rp.best_score,rp.best_star_rating into v_best,v_best_stars;
  end if;

  if v_reward then
    update public.characters as ch
       set gp=coalesce(ch.gp,0)+v_cfg.gold_reward,
           runecrafting_xp=coalesce(ch.runecrafting_xp,0)+v_cfg.xp_reward
     where ch.user_id=v_user
     returning ch.gp,ch.runecrafting_xp into v_new_gp,v_new_xp;
    if not found then raise exception 'Character not found'; end if;
  else
    select ch.gp,ch.runecrafting_xp into v_new_gp,v_new_xp
      from public.characters as ch where ch.user_id=v_user;
  end if;

  update public.repoggle_player_stats as rps set
    biggest_combo=greatest(rps.biggest_combo,v_combo),
    total_catches=rps.total_catches+v_catches,
    campaign_completed_at=case when p_level_number=50 and rps.campaign_completed_at is null then now() else rps.campaign_completed_at end,
    updated_at=now()
  where rps.user_id=v_user;

  update public.repoggle_sessions as rs
     set claimed=true,finished_at=now()
   where rs.id=p_session_id;

  return query select v_reward,
    case when v_reward then v_cfg.gold_reward else 0 end,
    case when v_reward then v_cfg.xp_reward else 0 end,
    v_new_gp,v_new_xp,
    case when v_had_progress then v_existing.best_score else 0 end,
    v_best,v_best_stars,(p_level_number<50);
end;
$$;

grant execute on function public.complete_repoggle_level(uuid,integer,bigint,integer,integer,text,integer,integer,bigint,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Attribute each signed-in Harmonize click to its player
-- ---------------------------------------------------------------------------
-- Harmony remains a shared skill through public.counter. These two small tables
-- separately record who contributed the +3 XP so it can be merged into the
-- daily and global XP leaderboards.

create table if not exists public.counter (
  id integer primary key,
  count integer not null default 0 check (count >= 0)
);

insert into public.counter (id, count)
values (1, 0)
on conflict (id) do nothing;

create table if not exists public.harmony_xp_contributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.harmony_xp_daily_contributions (
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_date date not null,
  xp_earned bigint not null default 0 check (xp_earned >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, xp_date)
);

create index if not exists harmony_xp_daily_date_idx
  on public.harmony_xp_daily_contributions (xp_date, xp_earned desc);

alter table public.harmony_xp_contributions enable row level security;
alter table public.harmony_xp_daily_contributions enable row level security;

revoke all on public.harmony_xp_contributions from anon, authenticated;
revoke all on public.harmony_xp_daily_contributions from anon, authenticated;

create or replace function public.harmonize_once_v3()
returns table(
  previous_xp integer,
  xp_gained integer,
  new_xp integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_previous integer;
  v_new integer;
begin
  -- One atomic upsert keeps simultaneous clicks safe.
  insert into public.counter as ctr (id, count)
  values (1, 3)
  on conflict (id) do update
    set count = ctr.count + 3
  returning ctr.count - 3, ctr.count
    into v_previous, v_new;

  -- Anonymous Harmonize clicks still advance the shared skill, but only a
  -- signed-in player can receive personal daily/global leaderboard credit.
  if v_user is not null then
    insert into public.harmony_xp_contributions as hc (user_id, total_xp, updated_at)
    values (v_user, 3, now())
    on conflict (user_id) do update
      set total_xp = hc.total_xp + 3,
          updated_at = now();

    insert into public.harmony_xp_daily_contributions as hd (user_id, xp_date, xp_earned, updated_at)
    values (v_user, current_date, 3, now())
    on conflict (user_id, xp_date) do update
      set xp_earned = hd.xp_earned + 3,
          updated_at = now();
  end if;

  return query select v_previous, 3, v_new;
end;
$$;

-- Keep cached/older website builds compatible while they age out.
create or replace function public.harmonize_once_v2()
returns table(
  previous_xp integer,
  xp_gained integer,
  new_xp integer
)
language sql
security definer
set search_path = public, auth
as $$
  select * from public.harmonize_once_v3();
$$;

create or replace function public.gain_harmony_xp()
returns integer
language sql
security definer
set search_path = public, auth
as $$
  select h.new_xp from public.harmonize_once_v3() h;
$$;

revoke all on function public.harmonize_once_v3() from public;
revoke all on function public.harmonize_once_v2() from public;
revoke all on function public.gain_harmony_xp() from public;
grant execute on function public.harmonize_once_v3() to anon, authenticated;
grant execute on function public.harmonize_once_v2() to anon, authenticated;
grant execute on function public.gain_harmony_xp() to anon, authenticated;

create or replace function public.get_harmony_xp_contributions()
returns table(
  username text,
  daily_harmony_xp bigint,
  total_harmony_xp bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.username::text,
    coalesce(d.xp_earned, 0)::bigint as daily_harmony_xp,
    t.total_xp::bigint as total_harmony_xp
  from public.harmony_xp_contributions t
  join public.characters c on c.user_id = t.user_id
  left join public.harmony_xp_daily_contributions d
    on d.user_id = t.user_id
   and d.xp_date = current_date
  order by t.total_xp desc, c.username asc
  limit 1000;
$$;

revoke all on function public.get_harmony_xp_contributions() from public;
grant execute on function public.get_harmony_xp_contributions() to anon, authenticated;

-- Existing leaderboard RPCs often return only five/six rows. Expand their
-- candidate pool so the browser can merge Harmony contributions before choosing
-- the final top five. This preserves the original leaderboard calculations.
do $repo_expand_leaderboards$
declare
  function_name text;
  function_oid regprocedure;
  original_definition text;
  patched_definition text;
begin
  foreach function_name in array array[
    'public.get_daily_xp_leaderboard()',
    'public.get_global_xp_leaderboard()'
  ]
  loop
    function_oid := to_regprocedure(function_name);
    if function_oid is null then
      raise notice 'Optional leaderboard function % was not found; skipping limit expansion.', function_name;
      continue;
    end if;

    original_definition := pg_get_functiondef(function_oid);
    patched_definition := regexp_replace(
      original_definition,
      'limit[[:space:]]+(5|6)[[:>:]]',
      'LIMIT 1000',
      'gi'
    );

    if patched_definition <> original_definition then
      execute patched_definition;
      raise notice 'Expanded % candidate limit for Harmony merging.', function_name;
    else
      raise notice '% already has a larger/no candidate limit.', function_name;
    end if;
  end loop;
end
$repo_expand_leaderboards$;

notify pgrst, 'reload schema';

commit;
