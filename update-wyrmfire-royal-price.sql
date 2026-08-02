-- Run once in Supabase SQL Editor after add-dreamies-nametag.sql.
-- Updates the existing Gertrude purchase function so Fyrmfire Royal costs 65,000 GP.

create or replace function public.buy_gertrude_nametag(p_item text)
returns table(new_gp integer, bank_items jsonb, purchased_item text)
language plpgsql security definer set search_path=public as $$
declare v_gp integer; v_items jsonb; v_price integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_item not in (
    'nametag_hunter_jungle','nametag_ice_mountain','nametag_lava','nametag_metal_steel','nametag_moneybags','nametag_moonlight','nametag_nether_portal','nametag_nuclear','nametag_ocean','nametag_angel_wings','nametag_army','nametag_autumn','nametag_blue_crown','nametag_blue_crystal','nametag_cloud_sun','nametag_combat','nametag_desert','nametag_emerald','nametag_gold_wings','nametag_cherrybloom_charm','nametag_black_flag_bounty','nametag_voidbound','nametag_shadowflame_torches','nametag_wyrmfire_royal','nametag_varrock_banner','nametag_ancient_parchment','nametag_champions_decree','nametag_toxic_revenant','nametag_bloodhorn','nametag_sunset_grove','nametag_venomcore','nametag_druids_embrace','nametag_tidecaller','nametag_lunar_sorcerer','nametag_frozen_clan_banner','nametag_dreamies'
  ) then raise exception 'Unknown name tag.'; end if;
  v_price := case when p_item='nametag_dreamies' then 75000 when p_item='nametag_wyrmfire_royal' then 65000 else 50000 end;
  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb) into v_gp,v_items from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found.'; end if;
  if coalesce((v_items->>p_item)::integer,0)>0 then raise exception 'You already own this name tag.'; end if;
  if v_gp<v_price then raise exception 'You need % GP to buy this name tag.',to_char(v_price,'FM999,999,999'); end if;
  v_items:=jsonb_set(v_items,array[p_item],'1'::jsonb,true);
  update public.characters set gp=v_gp-v_price,bank_items=v_items where user_id=auth.uid();
  return query select v_gp-v_price,v_items,p_item;
end;$$;
grant execute on function public.buy_gertrude_nametag(text) to authenticated;
notify pgrst,'reload schema';
