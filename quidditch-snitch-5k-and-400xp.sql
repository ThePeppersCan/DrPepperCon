-- Quidditch: 5,000 GP to the owner of the pet that catches the Snitch,
-- plus a server-authoritative 400 Agility XP per minute spectator rate.

create table if not exists public.quidditch_snitch_rewards (
  match_id text primary key,
  winner_user_id uuid not null,
  owner_username text not null,
  pet_name text not null,
  gp_awarded integer not null default 5000,
  awarded_at timestamptz not null default now()
);

alter table public.quidditch_snitch_rewards enable row level security;

create or replace function public.award_quidditch_snitch_catch(
  p_match_id text,
  p_pet_name text,
  p_owner_username text
)
returns table(awarded boolean,new_gp bigint)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_owner uuid;
  v_gp bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if coalesce(trim(p_match_id),'')='' then raise exception 'Missing match id'; end if;

  select c.user_id into v_owner
  from public.characters c
  where lower(c.username)=lower(trim(p_owner_username))
  limit 1;
  if v_owner is null then raise exception 'Pet owner not found'; end if;

  insert into public.quidditch_snitch_rewards(match_id,winner_user_id,owner_username,pet_name)
  values(trim(p_match_id),v_owner,trim(p_owner_username),left(coalesce(nullif(trim(p_pet_name),''),'Pet'),80))
  on conflict(match_id) do nothing;

  if found then
    update public.characters
       set gp=coalesce(gp,0)+5000
     where user_id=v_owner
     returning gp into v_gp;
    return query select true,v_gp;
  else
    select c.gp into v_gp from public.characters c where c.user_id=v_owner;
    return query select false,coalesce(v_gp,0);
  end if;
end $$;

grant execute on function public.award_quidditch_snitch_catch(text,text,text) to authenticated;

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

  select last_claim_at,fractional_xp into v_last,v_fraction
  from public.quidditch_watch_xp_400_state
  where user_id=v_uid
  for update;

  if not found then
    insert into public.quidditch_watch_xp_400_state(user_id,last_claim_at,fractional_xp)
    values(v_uid,v_now,0)
    on conflict(user_id) do nothing;
    return 0;
  end if;

  -- Cap one heartbeat gap so a sleeping/background tab cannot bank long offline periods.
  v_elapsed:=least(10.0,greatest(0.0,extract(epoch from (v_now-v_last))));
  v_total:=coalesce(v_fraction,0)+(v_elapsed*(400.0/60.0));
  v_award:=floor(v_total)::integer;

  update public.quidditch_watch_xp_400_state
     set last_claim_at=v_now,
         fractional_xp=v_total-v_award
   where user_id=v_uid;

  if v_award>0 then
    update public.characters
       set agility_xp=coalesce(agility_xp,0)+v_award
     where user_id=v_uid;
  end if;

  return v_award;
end $$;

grant execute on function public.claim_quidditch_watch_xp_400() to authenticated;
