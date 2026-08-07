-- REPO SPORTS QUIDDITCH GROUND — isolated Survivor persistence
-- This does not alter Repo Combat gameplay, maps, weapons, enemies, balancing or leaderboards.

create table if not exists public.repo_sports_survivor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  best_score bigint not null default 0,
  best_seconds integer not null default 0,
  total_runs integer not null default 0,
  total_kills bigint not null default 0,
  total_elites integer not null default 0,
  total_bosses integer not null default 0,
  total_snitches integer not null default 0,
  total_gp_earned bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.repo_sports_survivor_profiles enable row level security;
drop policy if exists "Users can read own Repo Sports survivor profile" on public.repo_sports_survivor_profiles;
create policy "Users can read own Repo Sports survivor profile"
on public.repo_sports_survivor_profiles for select to authenticated
using (user_id = auth.uid());

create or replace function public.complete_repo_sports_survivor_run(
  p_score integer,
  p_seconds integer,
  p_kills integer,
  p_elites integer,
  p_bosses integer,
  p_snitches integer
)
returns table(
  new_gp bigint,
  awarded_gp integer,
  best_score bigint,
  best_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seconds integer := greatest(0, least(coalesce(p_seconds,0), 1800));
  v_kills integer := greatest(0, least(coalesce(p_kills,0), 5000));
  v_elites integer := greatest(0, least(coalesce(p_elites,0), 500));
  v_bosses integer := greatest(0, least(coalesce(p_bosses,0), 8));
  v_snitches integer := greatest(0, least(coalesce(p_snitches,0), 20));
  v_score integer := greatest(0, least(coalesce(p_score,0), 5000000));
  v_gp integer;
  v_new_gp bigint;
  v_best_score bigint;
  v_best_seconds integer;
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;

  -- Balanced against a 15–20 minute active run. Starting/AFK time alone is intentionally weak.
  v_gp := least(25000,
    v_seconds * 2
      + v_kills * 3
      + v_elites * 45
      + v_bosses * 450
      + v_snitches * 650
  );

  update public.characters
  set gp = coalesce(gp,0) + v_gp
  where user_id = v_uid
  returning gp into v_new_gp;

  if v_new_gp is null then raise exception 'Character not found'; end if;

  insert into public.repo_sports_survivor_profiles(
    user_id,best_score,best_seconds,total_runs,total_kills,total_elites,total_bosses,total_snitches,total_gp_earned,updated_at
  ) values (
    v_uid,v_score,v_seconds,1,v_kills,v_elites,v_bosses,v_snitches,v_gp,now()
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
    updated_at = now()
  returning repo_sports_survivor_profiles.best_score, repo_sports_survivor_profiles.best_seconds
  into v_best_score, v_best_seconds;

  return query select v_new_gp, v_gp, v_best_score, v_best_seconds;
end;
$$;

grant execute on function public.complete_repo_sports_survivor_run(integer,integer,integer,integer,integer,integer) to authenticated;
