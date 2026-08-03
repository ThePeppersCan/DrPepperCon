-- Run once in Supabase SQL Editor before CovidPanda claims the birthday lamp.
create table if not exists public.birthday_reward_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.birthday_reward_claims enable row level security;

create or replace function public.claim_covidpanda_birthday_reward()
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_name text;
  v_items jsonb;
begin
  select lower(c.username),coalesce(c.bank_items,'{}'::jsonb) into v_name,v_items
  from public.characters c where c.user_id=auth.uid() for update;
  if v_name is null then raise exception 'Account not found'; end if;
  if v_name <> 'covidpanda' then raise exception 'This birthday reward belongs to CovidPanda'; end if;
  if now() < timestamptz '2026-08-03 23:00:00+00' then raise exception 'The lamp is not ready yet'; end if;
  if exists(select 1 from public.birthday_reward_claims where user_id=auth.uid()) then raise exception 'Birthday reward already claimed'; end if;
  update public.characters
     set gp=coalesce(gp,0)+100000,
         bank_items=v_items || jsonb_build_object('nametag_panda_rare',greatest(1,coalesce((v_items->>'nametag_panda_rare')::int,0)))
   where user_id=auth.uid();
  insert into public.birthday_reward_claims(user_id) values(auth.uid());
  return true;
end;
$$;
grant execute on function public.claim_covidpanda_birthday_reward() to authenticated;
