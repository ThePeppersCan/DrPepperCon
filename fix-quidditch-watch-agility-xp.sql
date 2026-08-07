-- Repo Sports Quidditch spectator Agility XP repair
-- Safe to run more than once in Supabase SQL Editor.

create table if not exists public.quidditch_watch_xp_400_state (
  user_id uuid primary key,
  last_claim_at timestamptz not null default now(),
  fractional_xp numeric not null default 0
);

alter table public.quidditch_watch_xp_400_state enable row level security;

create or replace function public.claim_quidditch_watch_xp_400()
returns integer
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid:=auth.uid();
  v_now timestamptz:=clock_timestamp();
  v_last timestamptz;
  v_fraction numeric:=0;
  v_elapsed numeric;
  v_total numeric;
  v_award integer;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select last_claim_at,fractional_xp
    into v_last,v_fraction
  from public.quidditch_watch_xp_400_state
  where user_id=v_uid
  for update;

  if not found then
    insert into public.quidditch_watch_xp_400_state(user_id,last_claim_at,fractional_xp)
    values(v_uid,v_now,0)
    on conflict(user_id) do update set last_claim_at=excluded.last_claim_at;
    return 0;
  end if;

  -- Short heartbeat cap prevents a sleeping/background tab banking offline XP.
  v_elapsed:=least(10.0,greatest(0.0,extract(epoch from (v_now-v_last))));
  v_total:=coalesce(v_fraction,0)+(v_elapsed*(400.0/60.0));
  v_award:=greatest(0,floor(v_total)::integer);

  update public.quidditch_watch_xp_400_state
     set last_claim_at=v_now,
         fractional_xp=v_total-v_award
   where user_id=v_uid;

  if v_award>0 then
    update public.characters
       set agility_xp=greatest(0,coalesce(agility_xp,0)+v_award)
     where user_id=v_uid;
  end if;

  return v_award;
end $$;

grant execute on function public.claim_quidditch_watch_xp_400() to authenticated;
