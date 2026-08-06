-- Run once in the Supabase SQL Editor.
-- Adds the weapon used to each Endless Horde personal best and creates the
-- unopened 1-in-4,500 Repo Combat purple chest drop.

alter table public.endless_horde_scores
  add column if not exists best_weapon text;

-- New five-argument score function. The older four-argument overload can remain
-- for backwards compatibility with cached clients.
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
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania') then raise exception 'Invalid map'; end if;
  if p_weapon not in ('greataxe','blowpipe','shadow') then raise exception 'Invalid weapon'; end if;

  select * into v_existing
  from public.endless_horde_scores
  where user_id=auth.uid() and map_id=p_map_id
  for update;

  if not found then
    insert into public.endless_horde_scores(user_id,map_id,best_wave,best_kills,best_seconds,best_weapon)
    values(auth.uid(),p_map_id,greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds),p_weapon);
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

drop function if exists public.get_endless_horde_leaderboard();
create function public.get_endless_horde_leaderboard()
returns table(username text,map_id text,best_wave integer,best_kills integer,best_seconds integer,best_weapon text)
language sql
stable
security definer
set search_path=public
as $$
  select c.username,s.map_id,s.best_wave,s.best_kills,s.best_seconds,s.best_weapon
  from public.endless_horde_scores s
  join public.characters c on c.user_id=s.user_id
  order by s.best_wave desc,s.best_kills desc,s.best_seconds desc
  limit 50
$$;

grant execute on function public.submit_endless_horde_score(text,integer,integer,integer,text) to authenticated;
grant execute on function public.get_endless_horde_leaderboard() to anon,authenticated;

-- A modest server-side throttle prevents accidental duplicate calls when two
-- XP orbs are collected at essentially the same instant.
create table if not exists public.repo_combat_rare_drop_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_attempt_at timestamptz not null default to_timestamp(0)
);
alter table public.repo_combat_rare_drop_attempts enable row level security;
revoke all on public.repo_combat_rare_drop_attempts from anon,authenticated;

create or replace function public.roll_repo_combat_rare_drop()
returns table(won boolean, quantity integer)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_items jsonb;
  v_quantity integer;
  v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select last_attempt_at into v_last
  from public.repo_combat_rare_drop_attempts
  where user_id=auth.uid()
  for update;

  if found and v_last > now() - interval '200 milliseconds' then
    return query select false,0;
    return;
  end if;

  insert into public.repo_combat_rare_drop_attempts(user_id,last_attempt_at)
  values(auth.uid(),now())
  on conflict(user_id) do update set last_attempt_at=excluded.last_attempt_at;

  if random() >= (1.0/4500.0) then
    return query select false,0;
    return;
  end if;

  select coalesce(c.bank_items,'{}'::jsonb) into v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;
  if v_items is null then raise exception 'Character not found'; end if;

  v_quantity := coalesce((v_items->>'repo_combat_rare_drop')::integer,0)+1;
  update public.characters
     set bank_items=v_items || jsonb_build_object('repo_combat_rare_drop',v_quantity)
   where user_id=auth.uid();

  return query select true,v_quantity;
end;
$$;

grant execute on function public.roll_repo_combat_rare_drop() to authenticated;

-- Give the Admin username one unopened purple chest for testing.
-- This is idempotent: re-running the script keeps at least one chest rather
-- than adding another every time.
update public.characters
set bank_items = coalesce(bank_items,'{}'::jsonb) || jsonb_build_object(
  'repo_combat_rare_drop',
  greatest(1,coalesce((coalesce(bank_items,'{}'::jsonb)->>'repo_combat_rare_drop')::integer,0))
)
where lower(username)='admin';
