-- REPO COMPANY: WILDERNESS HORDE + LEADERBOARDS
-- Run this whole file once in Supabase -> SQL Editor.
-- Non-destructive: existing Horde scores, characters, GP and custom fighters are preserved.

-- ---------------------------------------------------------------------------
-- SINGLE-PLAYER ENDLESS HORDE SCORES
-- ---------------------------------------------------------------------------
create table if not exists public.endless_horde_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  map_id text not null,
  best_wave integer not null default 0,
  best_kills integer not null default 0,
  best_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, map_id)
);

alter table public.endless_horde_scores
  add column if not exists best_weapon text,
  add column if not exists best_run_level integer not null default 1,
  add column if not exists best_rare_picks integer not null default 0,
  add column if not exists best_upgrades jsonb not null default '[]'::jsonb;

alter table public.endless_horde_scores enable row level security;
revoke all on public.endless_horde_scores from anon, authenticated;

-- Legacy four-argument scorer, retained for cached clients.
create or replace function public.submit_endless_horde_score(
  p_map_id text,
  p_wave integer,
  p_kills integer,
  p_seconds integer
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania','zombie-wilderness') then
    raise exception 'Invalid map';
  end if;

  insert into public.endless_horde_scores(
    user_id,map_id,best_wave,best_kills,best_seconds
  ) values (
    auth.uid(),p_map_id,greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds)
  )
  on conflict(user_id,map_id) do update
  set best_wave = greatest(endless_horde_scores.best_wave, excluded.best_wave),
      best_kills = case
        when excluded.best_wave > endless_horde_scores.best_wave
          or (excluded.best_wave = endless_horde_scores.best_wave and excluded.best_kills > endless_horde_scores.best_kills)
        then excluded.best_kills else endless_horde_scores.best_kills end,
      best_seconds = case
        when excluded.best_wave > endless_horde_scores.best_wave
          or (excluded.best_wave = endless_horde_scores.best_wave and excluded.best_kills > endless_horde_scores.best_kills)
          or (excluded.best_wave = endless_horde_scores.best_wave and excluded.best_kills = endless_horde_scores.best_kills and excluded.best_seconds > endless_horde_scores.best_seconds)
        then excluded.best_seconds else endless_horde_scores.best_seconds end,
      updated_at = now();
end;
$$;

-- Five-argument scorer used as the modern client's fallback.
create or replace function public.submit_endless_horde_score(
  p_map_id text,
  p_wave integer,
  p_kills integer,
  p_seconds integer,
  p_weapon text
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_existing public.endless_horde_scores%rowtype;
  v_is_better boolean;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania','zombie-wilderness') then
    raise exception 'Invalid map';
  end if;
  if p_weapon not in ('sword','dharok','greataxe','bow','blowpipe','staff','shadow') then
    raise exception 'Invalid weapon';
  end if;

  select * into v_existing
  from public.endless_horde_scores
  where user_id=auth.uid() and map_id=p_map_id
  for update;

  if not found then
    insert into public.endless_horde_scores(
      user_id,map_id,best_wave,best_kills,best_seconds,best_weapon
    ) values (
      auth.uid(),p_map_id,greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds),p_weapon
    );
    return;
  end if;

  v_is_better := p_wave > v_existing.best_wave
    or (p_wave = v_existing.best_wave and p_kills > v_existing.best_kills)
    or (p_wave = v_existing.best_wave and p_kills = v_existing.best_kills and p_seconds > v_existing.best_seconds);

  if v_is_better then
    update public.endless_horde_scores
       set best_wave=greatest(1,p_wave),
           best_kills=greatest(0,p_kills),
           best_seconds=greatest(0,p_seconds),
           best_weapon=p_weapon,
           updated_at=now()
     where user_id=auth.uid() and map_id=p_map_id;
  end if;
end;
$$;

-- Full run-summary scorer used by the current website.
create or replace function public.submit_endless_horde_score_v2(
  p_map_id text,
  p_wave integer,
  p_kills integer,
  p_seconds integer,
  p_weapon text,
  p_run_level integer,
  p_rare_picks integer,
  p_upgrades jsonb
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_existing public.endless_horde_scores%rowtype;
  v_is_better boolean;
  v_upgrades jsonb := coalesce(p_upgrades,'[]'::jsonb);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania','zombie-wilderness') then
    raise exception 'Invalid map';
  end if;
  if p_weapon not in ('sword','dharok','greataxe','bow','blowpipe','staff','shadow') then
    raise exception 'Invalid weapon';
  end if;
  if jsonb_typeof(v_upgrades) <> 'array' then v_upgrades := '[]'::jsonb; end if;

  if jsonb_array_length(v_upgrades) > 60 then
    v_upgrades := (
      select coalesce(jsonb_agg(value),'[]'::jsonb)
      from (select value from jsonb_array_elements(v_upgrades) limit 60) limited
    );
  end if;

  select * into v_existing
  from public.endless_horde_scores
  where user_id=auth.uid() and map_id=p_map_id
  for update;

  if not found then
    insert into public.endless_horde_scores(
      user_id,map_id,best_wave,best_kills,best_seconds,best_weapon,
      best_run_level,best_rare_picks,best_upgrades
    ) values (
      auth.uid(),p_map_id,greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds),p_weapon,
      greatest(1,p_run_level),greatest(0,p_rare_picks),v_upgrades
    );
    return;
  end if;

  v_is_better := p_wave > v_existing.best_wave
    or (p_wave = v_existing.best_wave and p_kills > v_existing.best_kills)
    or (p_wave = v_existing.best_wave and p_kills = v_existing.best_kills and p_seconds > v_existing.best_seconds);

  if v_is_better then
    update public.endless_horde_scores
       set best_wave=greatest(1,p_wave),
           best_kills=greatest(0,p_kills),
           best_seconds=greatest(0,p_seconds),
           best_weapon=p_weapon,
           best_run_level=greatest(1,p_run_level),
           best_rare_picks=greatest(0,p_rare_picks),
           best_upgrades=v_upgrades,
           updated_at=now()
     where user_id=auth.uid() and map_id=p_map_id;
  end if;
end;
$$;

-- Recreate the legacy reader with its current six-column shape.
drop function if exists public.get_endless_horde_leaderboard();
create function public.get_endless_horde_leaderboard()
returns table(
  username text,
  map_id text,
  best_wave integer,
  best_kills integer,
  best_seconds integer,
  best_weapon text
)
language sql
stable
security definer
set search_path=public
as $$
  select c.username,s.map_id,s.best_wave,s.best_kills,s.best_seconds,s.best_weapon
  from public.endless_horde_scores s
  join public.characters c on c.user_id=s.user_id
  order by s.map_id,s.best_wave desc,s.best_kills desc,s.best_seconds desc
  limit 120
$$;

create or replace function public.get_endless_horde_leaderboard_v2()
returns table(
  username text,
  map_id text,
  best_wave integer,
  best_kills integer,
  best_seconds integer,
  best_weapon text,
  best_run_level integer,
  best_rare_picks integer,
  best_upgrades jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  select c.username,s.map_id,s.best_wave,s.best_kills,s.best_seconds,s.best_weapon,
         s.best_run_level,s.best_rare_picks,s.best_upgrades
  from public.endless_horde_scores s
  join public.characters c on c.user_id=s.user_id
  order by s.map_id,s.best_wave desc,s.best_kills desc,s.best_seconds desc
  limit 120
$$;

-- ---------------------------------------------------------------------------
-- MULTIPLAYER HORDE SCORES
-- ---------------------------------------------------------------------------
create table if not exists public.multiplayer_horde_scores (
  id bigint generated by default as identity primary key,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null,
  guest_name text not null,
  map_id text not null,
  best_wave integer not null default 1,
  best_kills integer not null default 0,
  best_seconds integer not null default 0,
  host_weapon text not null,
  guest_weapon text not null,
  host_upgrades jsonb not null default '[]'::jsonb,
  guest_upgrades jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique(host_user_id,guest_name,map_id)
);

alter table public.multiplayer_horde_scores enable row level security;
revoke all on public.multiplayer_horde_scores from anon,authenticated;

-- The original constraint allowed only the first three maps.
alter table public.multiplayer_horde_scores
  drop constraint if exists multiplayer_horde_scores_map_id_check;
alter table public.multiplayer_horde_scores
  add constraint multiplayer_horde_scores_map_id_check
  check (map_id in ('zombie-varrock','zombie-falador','zombie-morytania','zombie-wilderness'));

create or replace function public.submit_multiplayer_horde_score(
  p_map_id text,
  p_guest_name text,
  p_wave integer,
  p_kills integer,
  p_seconds integer,
  p_host_weapon text,
  p_guest_weapon text,
  p_host_upgrades jsonb default '[]'::jsonb,
  p_guest_upgrades jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_host_name text;
  v_existing public.multiplayer_horde_scores%rowtype;
  v_better boolean;
  v_host_upgrades jsonb := coalesce(p_host_upgrades,'[]'::jsonb);
  v_guest_upgrades jsonb := coalesce(p_guest_upgrades,'[]'::jsonb);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania','zombie-wilderness') then
    raise exception 'Invalid map';
  end if;
  if p_host_weapon not in ('sword','dharok','greataxe','bow','blowpipe','staff','shadow') then
    raise exception 'Invalid host weapon';
  end if;
  if p_guest_weapon not in ('sword','dharok','greataxe','bow','blowpipe','staff','shadow') then
    raise exception 'Invalid guest weapon';
  end if;
  if jsonb_typeof(v_host_upgrades) <> 'array' then v_host_upgrades := '[]'::jsonb; end if;
  if jsonb_typeof(v_guest_upgrades) <> 'array' then v_guest_upgrades := '[]'::jsonb; end if;

  select username into v_host_name
  from public.characters
  where user_id=auth.uid()
  limit 1;
  if v_host_name is null then raise exception 'Character not found'; end if;

  select * into v_existing
  from public.multiplayer_horde_scores
  where host_user_id=auth.uid()
    and lower(guest_name)=lower(btrim(p_guest_name))
    and map_id=p_map_id
  for update;

  if not found then
    insert into public.multiplayer_horde_scores(
      host_user_id,host_name,guest_name,map_id,best_wave,best_kills,best_seconds,
      host_weapon,guest_weapon,host_upgrades,guest_upgrades
    ) values (
      auth.uid(),v_host_name,btrim(p_guest_name),p_map_id,
      greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds),
      p_host_weapon,p_guest_weapon,v_host_upgrades,v_guest_upgrades
    );
    return;
  end if;

  v_better := p_wave > v_existing.best_wave
    or (p_wave = v_existing.best_wave and p_kills > v_existing.best_kills)
    or (p_wave = v_existing.best_wave and p_kills = v_existing.best_kills and p_seconds > v_existing.best_seconds);

  if v_better then
    update public.multiplayer_horde_scores
       set host_name=v_host_name,
           guest_name=btrim(p_guest_name),
           best_wave=greatest(1,p_wave),
           best_kills=greatest(0,p_kills),
           best_seconds=greatest(0,p_seconds),
           host_weapon=p_host_weapon,
           guest_weapon=p_guest_weapon,
           host_upgrades=v_host_upgrades,
           guest_upgrades=v_guest_upgrades,
           updated_at=now()
     where id=v_existing.id;
  end if;
end;
$$;

create or replace function public.get_multiplayer_horde_leaderboard()
returns table(
  host_name text,
  guest_name text,
  map_id text,
  best_wave integer,
  best_kills integer,
  best_seconds integer,
  host_weapon text,
  guest_weapon text,
  host_upgrades jsonb,
  guest_upgrades jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  select s.host_name,s.guest_name,s.map_id,s.best_wave,s.best_kills,s.best_seconds,
         s.host_weapon,s.guest_weapon,s.host_upgrades,s.guest_upgrades
  from public.multiplayer_horde_scores s
  order by s.map_id,s.best_wave desc,s.best_kills desc,s.best_seconds desc
  limit 160
$$;

-- Function permissions.
grant execute on function public.submit_endless_horde_score(text,integer,integer,integer) to authenticated;
grant execute on function public.submit_endless_horde_score(text,integer,integer,integer,text) to authenticated;
grant execute on function public.submit_endless_horde_score_v2(text,integer,integer,integer,text,integer,integer,jsonb) to authenticated;
grant execute on function public.get_endless_horde_leaderboard() to anon,authenticated;
grant execute on function public.get_endless_horde_leaderboard_v2() to anon,authenticated;
grant execute on function public.submit_multiplayer_horde_score(text,text,integer,integer,integer,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.get_multiplayer_horde_leaderboard() to anon,authenticated;

notify pgrst,'reload schema';
