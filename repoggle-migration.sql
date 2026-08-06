-- REPOGGLE — additive, non-destructive Supabase migration.
-- Run once in the Supabase SQL Editor after copying the Repoggle files.
-- This migration does not drop or replace any existing website table.

create extension if not exists pgcrypto;

create table if not exists public.repoggle_level_config (
  level_number integer primary key check (level_number between 1 and 50),
  level_name text not null,
  gold_reward integer not null check (gold_reward >= 0),
  xp_reward integer not null check (xp_reward >= 0),
  star_2_score bigint not null check (star_2_score > 0),
  star_3_score bigint not null check (star_3_score > star_2_score),
  min_completion_seconds integer not null default 6 check (min_completion_seconds between 3 and 120)
);

insert into public.repoggle_level_config(level_number, level_name, gold_reward, xp_reward, star_2_score, star_3_score, min_completion_seconds) values
  (1, 'First Offering', 1000, 250, 9000, 15000, 6),
  (2, 'Breath of Air', 1100, 300, 11000, 18000, 6),
  (3, 'Twin Deposits', 1200, 350, 13000, 22000, 6),
  (4, 'Mine Tunnel', 1300, 400, 16000, 26000, 7),
  (5, 'Essence Pouch', 1400, 450, 18000, 30000, 7),
  (6, 'Runaway Minecart', 1500, 500, 21000, 34000, 7),
  (7, 'Water Rune Wave', 1600, 550, 24000, 39000, 7),
  (8, 'Sands of Time', 1700, 600, 27000, 44000, 8),
  (9, 'Elemental Ring', 1800, 650, 30000, 49000, 8),
  (10, 'Essence Guardian', 1900, 700, 36000, 58000, 8),
  (11, 'Air Altar', 2000, 800, 40000, 65000, 8),
  (12, 'Mind Altar', 2100, 900, 43000, 70000, 9),
  (13, 'Water Altar', 2200, 1000, 46000, 75000, 9),
  (14, 'Earth Altar', 2300, 1100, 50000, 81000, 9),
  (15, 'Fire Altar', 2400, 1200, 54000, 87000, 9),
  (16, 'Body Altar', 2500, 1300, 58000, 93000, 10),
  (17, 'Cosmic Pathways', 2600, 1400, 62000, 100000, 10),
  (18, 'Elemental Spiral', 2700, 1500, 66000, 107000, 10),
  (19, 'Combination Rune', 2800, 1600, 71000, 115000, 10),
  (20, 'Elemental Guardian', 2900, 1700, 78000, 126000, 11),
  (21, 'Abyssal Face', 3000, 1900, 82000, 133000, 11),
  (22, 'Tentacle Spiral', 3100, 2050, 87000, 141000, 11),
  (23, 'Broken Pathway', 3200, 2200, 92000, 150000, 11),
  (24, 'Twin Chambers', 3300, 2350, 97000, 158000, 12),
  (25, 'Portal Wheel', 3400, 2500, 103000, 167000, 12),
  (26, 'Abyssal Parasite', 3500, 2650, 108000, 175000, 12),
  (27, 'Pouch Gauntlet', 3600, 2800, 114000, 185000, 12),
  (28, 'Demonic Skull', 3700, 2950, 120000, 195000, 13),
  (29, 'Collapsing Rift', 3800, 3100, 128000, 208000, 13),
  (30, 'Abyssal Guardian', 3900, 3250, 138000, 224000, 13),
  (31, 'Scales of Law', 4000, 3500, 145000, 236000, 13),
  (32, 'Nature Tree', 4100, 3750, 151000, 246000, 14),
  (33, 'Death Rune Skull', 4200, 4000, 158000, 257000, 14),
  (34, 'Blood Rune Seal', 4300, 4250, 165000, 268000, 14),
  (35, 'Soul Spiral', 4400, 4500, 173000, 281000, 14),
  (36, 'Ancient Dragon', 4500, 4750, 182000, 295000, 15),
  (37, 'Magical Prison', 4600, 5000, 190000, 308000, 15),
  (38, 'Collapsing Altar', 4700, 5250, 199000, 323000, 15),
  (39, 'Rune Golem', 4800, 5500, 210000, 340000, 15),
  (40, 'Ancient Runecrafter', 4900, 5750, 225000, 365000, 16),
  (41, 'Rift Entrance', 5000, 6500, 238000, 386000, 16),
  (42, 'Shattered Altar', 5100, 7000, 250000, 405000, 16),
  (43, 'Dragon’s Offering', 5200, 7500, 264000, 428000, 16),
  (44, 'The Four Elements', 5300, 8000, 280000, 454000, 17),
  (45, 'Abyssal Heart', 5400, 8500, 298000, 483000, 17),
  (46, 'Law and Chaos', 5500, 9000, 316000, 512000, 17),
  (47, 'The Impossible Pouch', 5600, 9500, 338000, 548000, 17),
  (48, 'Soul Spiral Mastery', 5700, 10000, 360000, 584000, 18),
  (49, 'Altar of Ruin', 5800, 10500, 390000, 632000, 18),
  (50, 'The Repoggle Grandmaster', 5900, 11000, 430000, 700000, 18)
on conflict (level_number) do update set level_name=excluded.level_name, gold_reward=excluded.gold_reward, xp_reward=excluded.xp_reward, star_2_score=excluded.star_2_score, star_3_score=excluded.star_3_score, min_completion_seconds=excluded.min_completion_seconds;

create table if not exists public.repoggle_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_number integer not null references public.repoggle_level_config(level_number),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  best_score bigint not null default 0,
  best_star_rating integer not null default 1 check (best_star_rating between 1 and 3),
  best_orbs_remaining integer not null default 0 check (best_orbs_remaining between 0 and 20),
  selected_power text not null default 'air',
  completion_count integer not null default 1,
  reward_claimed boolean not null default false,
  best_combo integer not null default 0,
  best_catches integer not null default 0,
  best_completion_ms bigint,
  power_activated boolean not null default false,
  primary key (user_id, level_number)
);

create index if not exists repoggle_progress_level_score_idx
  on public.repoggle_progress(level_number, best_score desc);
create index if not exists repoggle_progress_user_stars_idx
  on public.repoggle_progress(user_id, best_star_rating desc);

create table if not exists public.repoggle_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_number integer not null references public.repoggle_level_config(level_number),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  claimed boolean not null default false
);

create index if not exists repoggle_sessions_user_started_idx
  on public.repoggle_sessions(user_id, started_at desc);

create table if not exists public.repoggle_player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  biggest_combo integer not null default 0,
  total_catches bigint not null default 0,
  campaign_started_at timestamptz,
  campaign_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.repoggle_level_config enable row level security;
alter table public.repoggle_progress enable row level security;
alter table public.repoggle_sessions enable row level security;
alter table public.repoggle_player_stats enable row level security;

-- Public level configuration is safe to read. Progress and stats are private.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='repoggle_level_config' and policyname='Repoggle level config is readable') then
    create policy "Repoggle level config is readable" on public.repoggle_level_config for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='repoggle_progress' and policyname='Users read own Repoggle progress') then
    create policy "Users read own Repoggle progress" on public.repoggle_progress for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='repoggle_player_stats' and policyname='Users read own Repoggle stats') then
    create policy "Users read own Repoggle stats" on public.repoggle_player_stats for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

revoke all on public.repoggle_progress from anon, authenticated;
revoke all on public.repoggle_sessions from anon, authenticated;
revoke all on public.repoggle_player_stats from anon, authenticated;
grant select on public.repoggle_level_config to anon, authenticated;
grant select on public.repoggle_progress to authenticated;
grant select on public.repoggle_player_stats to authenticated;

create or replace function public.start_repoggle_level(p_level_number integer)
returns table(session_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_level_number not between 1 and 50 then raise exception 'Invalid Repoggle level'; end if;
  if not exists(select 1 from public.repoggle_level_config where level_number=p_level_number) then
    raise exception 'Repoggle level configuration missing';
  end if;
  if p_level_number > 1 and not exists(
    select 1 from public.repoggle_progress
    where user_id=v_user and level_number=p_level_number-1
  ) then
    raise exception 'Repoggle level is locked';
  end if;

  update public.repoggle_sessions
     set claimed=true, finished_at=coalesce(finished_at,now())
   where user_id=v_user and claimed=false and started_at < now()-interval '4 hours';
  delete from public.repoggle_sessions where started_at < now()-interval '30 days';

  insert into public.repoggle_player_stats(user_id,campaign_started_at)
  values(v_user,case when p_level_number=1 then now() else null end)
  on conflict(user_id) do update set
    campaign_started_at=coalesce(public.repoggle_player_stats.campaign_started_at,excluded.campaign_started_at),
    updated_at=now();

  insert into public.repoggle_sessions(user_id,level_number)
  values(v_user,p_level_number)
  returning id into v_session;

  return query select v_session;
end;
$$;

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
  v_reward := not v_had_progress;

  if v_had_progress then
    update public.repoggle_progress set
      updated_at=now(),
      best_score=greatest(best_score,v_score),
      best_star_rating=greatest(best_star_rating,v_stars),
      best_orbs_remaining=greatest(best_orbs_remaining,v_orbs),
      selected_power=case when v_score>=best_score then v_power else selected_power end,
      completion_count=completion_count+1,
      reward_claimed=true,
      best_combo=greatest(best_combo,v_combo),
      best_catches=greatest(best_catches,v_catches),
      best_completion_ms=case when best_completion_ms is null then v_duration_ms else least(best_completion_ms,v_duration_ms) end,
      power_activated=power_activated or coalesce(p_power_activated,false)
    where user_id=v_user and level_number=p_level_number
    returning best_score,best_star_rating into v_best,v_best_stars;
  else
    insert into public.repoggle_progress(
      user_id,level_number,best_score,best_star_rating,best_orbs_remaining,
      selected_power,completion_count,reward_claimed,best_combo,best_catches,
      best_completion_ms,power_activated
    ) values(
      v_user,p_level_number,v_score,v_stars,v_orbs,v_power,1,true,v_combo,v_catches,
      v_duration_ms,coalesce(p_power_activated,false)
    ) returning best_score,best_star_rating into v_best,v_best_stars;
  end if;

  if v_reward then
    update public.characters
       set gp=coalesce(gp,0)+v_cfg.gold_reward,
           runecrafting_xp=coalesce(runecrafting_xp,0)+v_cfg.xp_reward
     where user_id=v_user
     returning gp,runecrafting_xp into v_new_gp,v_new_xp;
    if not found then raise exception 'Character not found'; end if;
  else
    select gp,runecrafting_xp into v_new_gp,v_new_xp from public.characters where user_id=v_user;
  end if;

  update public.repoggle_player_stats set
    biggest_combo=greatest(biggest_combo,v_combo),
    total_catches=total_catches+v_catches,
    campaign_completed_at=case when p_level_number=50 and campaign_completed_at is null then now() else campaign_completed_at end,
    updated_at=now()
  where user_id=v_user;

  update public.repoggle_sessions set claimed=true,finished_at=now() where id=p_session_id;

  return query select v_reward,
    case when v_reward then v_cfg.gold_reward else 0 end,
    case when v_reward then v_cfg.xp_reward else 0 end,
    v_new_gp,v_new_xp,
    case when v_had_progress then v_existing.best_score else 0 end,
    v_best,v_best_stars,(p_level_number<50);
end;
$$;

create or replace function public.get_repoggle_leaderboards()
returns table(
  username text,
  total_score bigint,
  total_stars bigint,
  level_50_score bigint,
  biggest_combo integer,
  total_catches bigint,
  campaign_ms bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      p.user_id,
      sum(p.best_score)::bigint as total_score,
      sum(p.best_star_rating)::bigint as total_stars,
      max(p.best_score) filter(where p.level_number=50)::bigint as level_50_score
    from public.repoggle_progress p
    group by p.user_id
  )
  select
    c.username,
    coalesce(t.total_score,0),
    coalesce(t.total_stars,0),
    coalesce(t.level_50_score,0),
    s.biggest_combo,
    s.total_catches,
    case when s.campaign_started_at is not null and s.campaign_completed_at is not null
      then floor(extract(epoch from (s.campaign_completed_at-s.campaign_started_at))*1000)::bigint
      else null end as campaign_ms
  from public.repoggle_player_stats s
  join public.characters c on c.user_id=s.user_id
  left join totals t on t.user_id=s.user_id
  order by coalesce(t.total_score,0) desc
  limit 100;
$$;

grant execute on function public.start_repoggle_level(integer) to authenticated;
grant execute on function public.complete_repoggle_level(uuid,integer,bigint,integer,integer,text,integer,integer,bigint,boolean) to authenticated;
grant execute on function public.get_repoggle_leaderboards() to anon,authenticated;

comment on table public.repoggle_progress is 'One row per user per Repoggle level. First-completion rewards are guarded server-side.';
comment on function public.complete_repoggle_level is 'Idempotently records a Repoggle completion and awards fixed server-side gold/Runecrafting XP once.';
