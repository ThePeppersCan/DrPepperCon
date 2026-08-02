-- Party Pete's account Watchcard Background shop.
-- Run once in the Supabase SQL Editor before using the shop.

alter table public.characters
  add column if not exists equipped_watchcard_background text;

create or replace function public.get_my_watchcard_background()
returns table(equipped_watchcard_background text)
language sql security definer set search_path=public as $$
  select c.equipped_watchcard_background
  from public.characters c
  where c.user_id=auth.uid()
  limit 1;
$$;

create or replace function public.get_watchcard_backgrounds(p_usernames text[])
returns table(username text,equipped_watchcard_background text)
language sql security definer set search_path=public as $$
  select c.username,c.equipped_watchcard_background
  from public.characters c
  where lower(c.username) in (select lower(unnest(p_usernames)))
    and c.equipped_watchcard_background is not null;
$$;

create or replace function public.set_watchcard_background(p_item text default null)
returns table(equipped_watchcard_background text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select coalesce(c.bank_items,'{}'::jsonb) into v_items
  from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if p_item is not null and p_item not like 'watchcard_%' then raise exception 'Unsupported watchcard background'; end if;
  if p_item is not null and coalesce((v_items->>p_item)::integer,0)<1 then raise exception 'You do not own that background'; end if;
  update public.characters set equipped_watchcard_background=p_item where user_id=auth.uid();
  return query select p_item;
end;$$;

create or replace function public.buy_watchcard_background(p_item text)
returns table(new_gp bigint,bank_items jsonb,equipped_watchcard_background text)
language plpgsql security definer set search_path=public as $$
declare v_gp bigint; v_items jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_item not in (
    'watchcard_crystal_bloom','watchcard_molten_forge','watchcard_moonlit_observatory','watchcard_swamp_witch',
    'watchcard_coral_palace','watchcard_pharaoh_vault','watchcard_cats_cradle','watchcard_frostfang',
    'watchcard_moonspire','watchcard_lumbridge_cellar','watchcard_celestial_study','watchcard_fight_caves',
    'watchcard_abyssal_lounge','watchcard_obsidian_forge','watchcard_nordic_retreat','watchcard_coastal_docks',
    'watchcard_varrock_bank','watchcard_rangers_lodge','watchcard_gods_home'
  ) then raise exception 'Unsupported watchcard background'; end if;

  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb) into v_gp,v_items
  from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if coalesce((v_items->>p_item)::integer,0)>0 then raise exception 'You already own that background'; end if;
  if v_gp<25000 then raise exception 'You need 25,000 GP'; end if;

  v_gp:=v_gp-25000;
  v_items:=jsonb_set(v_items,array[p_item],'1'::jsonb,true);
  update public.characters set gp=v_gp,bank_items=v_items,equipped_watchcard_background=p_item where user_id=auth.uid();
  return query select v_gp,v_items,p_item;
end;$$;

revoke all on function public.get_my_watchcard_background() from public;
revoke all on function public.get_watchcard_backgrounds(text[]) from public;
revoke all on function public.set_watchcard_background(text) from public;
revoke all on function public.buy_watchcard_background(text) from public;
grant execute on function public.get_my_watchcard_background() to authenticated;
grant execute on function public.get_watchcard_backgrounds(text[]) to authenticated;
grant execute on function public.set_watchcard_background(text) to authenticated;
grant execute on function public.buy_watchcard_background(text) to authenticated;
notify pgrst,'reload schema';
