-- Repo Company one-time Cloudflare launch / tester reward.
-- Run this entire file once in Supabase SQL Editor.

create table if not exists public.tester_launch_reward_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.tester_launch_reward_claims enable row level security;
revoke all on table public.tester_launch_reward_claims from anon, authenticated;

create or replace function public.get_my_tester_reward_status()
returns table(claimed boolean)
language sql
security definer
set search_path=public,auth
as $$
  select exists(
    select 1 from public.tester_launch_reward_claims r where r.user_id=auth.uid()
  );
$$;

grant execute on function public.get_my_tester_reward_status() to authenticated;

create or replace function public.claim_tester_launch_reward()
returns table(new_gp integer, bank_items jsonb, pack_quantity integer, nametag_owned boolean)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_gp integer;
  v_items jsonb;
  v_pack_quantity integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb)
    into v_gp,v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then raise exception 'Character not found.'; end if;

  if exists(select 1 from public.tester_launch_reward_claims r where r.user_id=auth.uid()) then
    raise exception 'This reward has already been claimed.';
  end if;

  v_pack_quantity:=greatest(0,coalesce((v_items->>'quidditch_tcg_pack')::integer,0))+1;
  v_items:=jsonb_set(v_items,'{quidditch_tcg_pack}',to_jsonb(v_pack_quantity),true);
  v_items:=jsonb_set(v_items,'{nametag_repo_xp_tester}','1'::jsonb,true);
  v_gp:=v_gp+75000;

  update public.characters c
     set gp=v_gp,
         bank_items=v_items
   where c.user_id=auth.uid();

  insert into public.tester_launch_reward_claims(user_id) values(auth.uid());

  return query select v_gp,v_items,v_pack_quantity,true;
end;
$$;

grant execute on function public.claim_tester_launch_reward() to authenticated;

-- Allows every owned pet name tag, including the reward-only Tester tag, to be equipped.
drop function if exists public.set_pet_nametag(text);
create function public.set_pet_nametag(p_nametag text)
returns table(equipped_pet_nametag text)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select coalesce(c.bank_items,'{}'::jsonb)
    into v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then raise exception 'Character not found.'; end if;

  if p_nametag is not null then
    if p_nametag !~ '^nametag_[a-z0-9_]+$' then raise exception 'Invalid name tag.'; end if;
    if greatest(0,coalesce((v_items->>p_nametag)::integer,0))<1 then
      raise exception 'You do not own this name tag.';
    end if;
  end if;

  update public.characters c
     set equipped_pet_nametag=p_nametag
   where c.user_id=auth.uid();

  return query select p_nametag;
end;
$$;

grant execute on function public.set_pet_nametag(text) to authenticated;
