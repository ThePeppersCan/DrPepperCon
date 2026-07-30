-- FIRE CAPE ACHIEVEMENT + PET COSMETIC
-- Run once in Supabase SQL Editor after uploading this website build.
-- Preserves all existing accounts, XP, GP, pets, achievements and bank items.

alter table public.characters
  add column if not exists achievements jsonb not null default '{}'::jsonb,
  add column if not exists bank_items jsonb not null default '{}'::jsonb,
  add column if not exists equipped_pet_cosmetic text;

-- Award the Fire cape exactly once for completing Insane Jad.
drop function if exists public.complete_jad_simulator(integer);
drop function if exists public.complete_jad_simulator(integer,text);
create function public.complete_jad_simulator(p_hits integer, p_difficulty text default 'medium')
returns table(
  new_xp integer,
  xp_gained integer,
  achievements jsonb,
  achievement_unlocked boolean
)
language plpgsql security definer set search_path=public as $$
declare
  gain integer;
  required_hits integer;
  updated_xp integer;
  v_unlock boolean := false;
  v_achievements jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  case lower(coalesce(p_difficulty,'medium'))
    when 'easy' then required_hits:=8; gain:=90;
    when 'medium' then required_hits:=12; gain:=150;
    when 'hard' then required_hits:=16; gain:=240;
    when 'insane' then required_hits:=28; gain:=500;
    else raise exception 'Invalid difficulty';
  end case;
  if p_hits<>required_hits then raise exception 'Jad was not fully defeated'; end if;

  select not (coalesce(c.achievements,'{}'::jsonb) ? 'jad_insane_complete')
    into v_unlock
    from public.characters c
    where c.user_id=auth.uid()
    for update;
  if not found then raise exception 'Character not found'; end if;
  v_unlock := lower(coalesce(p_difficulty,''))='insane' and v_unlock;

  update public.characters c
     set slayer_xp=least(13034431,coalesce(c.slayer_xp,0)+gain),
         achievements=case when v_unlock then jsonb_set(coalesce(c.achievements,'{}'::jsonb),'{jad_insane_complete}','true'::jsonb,true) else coalesce(c.achievements,'{}'::jsonb) end,
         bank_items=case when v_unlock then jsonb_set(coalesce(c.bank_items,'{}'::jsonb),'{fire_cape}','1'::jsonb,true) else coalesce(c.bank_items,'{}'::jsonb) end
   where c.user_id=auth.uid()
   returning c.slayer_xp,c.achievements into updated_xp,v_achievements;

  return query select updated_xp,gain,v_achievements,v_unlock;
end $$;

-- Permit either permanent achievement cosmetic while keeping it in the Bank.
create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_active_pet text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_cosmetic is not null and p_cosmetic not in ('chefs_hat','fire_cape') then raise exception 'Unsupported pet cosmetic'; end if;
  select coalesce(c.bank_items,'{}'::jsonb),c.active_pet into v_items,v_active_pet
  from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_cosmetic is not null and coalesce((v_items->>p_cosmetic)::integer,0)<1 then raise exception 'That cosmetic is not in your Bank'; end if;
  update public.characters c set equipped_pet_cosmetic=p_cosmetic where c.user_id=auth.uid();
  return query select p_cosmetic;
end $$;

revoke all on function public.complete_jad_simulator(integer,text) from public;
revoke all on function public.set_pet_cosmetic(text) from public;
grant execute on function public.complete_jad_simulator(integer,text) to authenticated;
grant execute on function public.set_pet_cosmetic(text) to authenticated;
notify pgrst,'reload schema';
