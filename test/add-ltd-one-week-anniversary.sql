-- Repo Company: One Week Anniversary LTD Quidditch TCG pack
-- Run this file ONCE in Supabase -> SQL Editor after uploading the website files.
-- Safe to run again: normal accounts that have already opened the pack are not re-granted it.

begin;

-- Persistent server-side status prevents a normal account from claiming twice.
create table if not exists public.ltd_anniversary_pack_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  opened_at timestamptz,
  opens_count integer not null default 0
);

alter table public.ltd_anniversary_pack_status enable row level security;
revoke all on table public.ltd_anniversary_pack_status from anon, authenticated;

-- Ensure the existing TCG collection table is available for the LTD card.
create table if not exists public.quidditch_tcg_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cards text[] not null default '{}'::text[],
  opened_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.quidditch_tcg_collections enable row level security;
revoke all on table public.quidditch_tcg_collections from anon, authenticated;

-- Register every existing account for the event without overwriting an existing status.
insert into public.ltd_anniversary_pack_status(user_id)
select c.user_id
from public.characters c
where c.user_id is not null
on conflict(user_id) do nothing;

-- Give one pack to every existing account that has not already opened it.
-- Admin also carries one visible pack, but the opening RPC restores it after every use.
update public.characters c
set bank_items=jsonb_set(
  coalesce(c.bank_items,'{}'::jsonb),
  '{quidditch_tcg_ltd_week_one_pack}',
  '1'::jsonb,
  true
)
where lower(trim(coalesce(c.username,'')))='admin'
   or exists (
     select 1
     from public.ltd_anniversary_pack_status s
     where s.user_id=c.user_id
       and s.opened_at is null
   );

-- Future accounts automatically receive the same one-time event pack.
create or replace function public.repo_add_ltd_pack_to_new_character()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.bank_items:=jsonb_set(
    coalesce(new.bank_items,'{}'::jsonb),
    '{quidditch_tcg_ltd_week_one_pack}',
    '1'::jsonb,
    true
  );
  return new;
end;
$$;

drop trigger if exists repo_add_ltd_pack_to_new_character_trigger on public.characters;
create trigger repo_add_ltd_pack_to_new_character_trigger
before insert on public.characters
for each row execute function public.repo_add_ltd_pack_to_new_character();

create or replace function public.repo_register_ltd_pack_status_for_new_character()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.ltd_anniversary_pack_status(user_id)
  values(new.user_id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists repo_register_ltd_pack_status_trigger on public.characters;
create trigger repo_register_ltd_pack_status_trigger
after insert on public.characters
for each row execute function public.repo_register_ltd_pack_status_for_new_character();

-- Secure, atomic opening function.
-- Normal users: one opening ever, consumes their pack, grants card + 300,000 GP.
-- Admin: pack remains at one and may be opened repeatedly for testing.
create or replace function public.open_ltd_anniversary_pack()
returns table(
  card_id text,
  new_gp bigint,
  bank_items jsonb,
  owned_cards text[],
  admin_unlimited boolean,
  open_count integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item_key constant text:='quidditch_tcg_ltd_week_one_pack';
  v_card_id constant text:='ltd_week_one_anniversary';
  v_reward constant bigint:=300000;
  v_username text;
  v_gp bigint;
  v_items jsonb;
  v_quantity integer;
  v_opened_at timestamptz;
  v_owned text[];
  v_is_admin boolean;
  v_open_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select lower(trim(coalesce(c.username,''))),coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb)
    into v_username,v_gp,v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then
    raise exception 'Character not found.';
  end if;

  v_is_admin:=(v_username='admin');

  insert into public.ltd_anniversary_pack_status(user_id)
  values(auth.uid())
  on conflict(user_id) do nothing;

  select s.opened_at,s.opens_count
    into v_opened_at,v_open_count
  from public.ltd_anniversary_pack_status s
  where s.user_id=auth.uid()
  for update;

  if not v_is_admin and v_opened_at is not null then
    raise exception 'Your One Week Anniversary LTD pack has already been opened.';
  end if;

  v_quantity:=case
    when coalesce(v_items->>v_item_key,'') ~ '^[0-9]+$' then (v_items->>v_item_key)::integer
    else 0
  end;

  if v_is_admin then
    v_items:=jsonb_set(v_items,array[v_item_key],'1'::jsonb,true);
  else
    if v_quantity<1 then
      raise exception 'You do not have the One Week Anniversary LTD pack in your Bank.';
    end if;
    v_items:=jsonb_set(v_items,array[v_item_key],'0'::jsonb,true);
  end if;

  v_gp:=v_gp+v_reward;

  update public.characters c
  set gp=v_gp,
      bank_items=v_items
  where c.user_id=auth.uid();

  insert into public.quidditch_tcg_collections(user_id,cards)
  values(auth.uid(),'{}'::text[])
  on conflict(user_id) do nothing;

  select coalesce(q.cards,'{}'::text[])
    into v_owned
  from public.quidditch_tcg_collections q
  where q.user_id=auth.uid()
  for update;

  if not (v_card_id=any(v_owned)) then
    v_owned:=array_append(v_owned,v_card_id);
  end if;

  update public.quidditch_tcg_collections q
  set cards=v_owned,
      opened_count=q.opened_count+1,
      updated_at=now()
  where q.user_id=auth.uid();

  update public.ltd_anniversary_pack_status s
  set opened_at=case when v_is_admin then now() else coalesce(s.opened_at,now()) end,
      opens_count=s.opens_count+1
  where s.user_id=auth.uid()
  returning s.opens_count into v_open_count;

  return query select
    v_card_id,
    v_gp,
    v_items,
    v_owned,
    v_is_admin,
    v_open_count;
end;
$$;

grant execute on function public.open_ltd_anniversary_pack() to authenticated;

-- The LTD card becomes card 56 in collection totals.
create or replace function public.get_my_quidditch_tcg_collection()
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql
security definer
set search_path=public
as $$
  select c.username,
         coalesce(q.cards,'{}'::text[]) as cards,
         cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
         56::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where c.user_id=auth.uid()
  limit 1
$$;

grant execute on function public.get_my_quidditch_tcg_collection() to authenticated;

-- Preserve the existing Admin-binder privacy rule while updating the total.
create or replace function public.get_public_quidditch_tcg_collection(p_username text)
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql
security definer
set search_path=public
as $$
  select c.username,
         coalesce(q.cards,'{}'::text[]) as cards,
         cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
         56::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username)=lower(trim(p_username))
    and (
      lower(trim(c.username))<>'admin'
      or c.user_id=auth.uid()
    )
  limit 1
$$;

grant execute on function public.get_public_quidditch_tcg_collection(text) to anon, authenticated;

notify pgrst,'reload schema';
commit;
