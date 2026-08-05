-- REPO COMBAT: EXPANDED FIGHTER CUSTOMISATION V2
-- Run this entire file once in Supabase -> SQL Editor.
-- Safe to run repeatedly. Existing fighter designs, XP, GP and account data are preserved.

alter table public.characters
  add column if not exists repo_combat_appearance jsonb not null default '{}'::jsonb;

create or replace function public.repo_combat_clean_appearance(p_appearance jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_source jsonb := coalesce(p_appearance, '{}'::jsonb);
  v_gender text := lower(coalesce(v_source ->> 'gender', 'male'));
  v_skin text := lower(coalesce(v_source ->> 'skin', 'warm'));
  v_head text := lower(coalesce(v_source ->> 'head', 'classic'));
  v_hair text := lower(coalesce(v_source ->> 'hair', 'brown'));
  v_eyes text := lower(coalesce(v_source ->> 'eyes', 'brown'));
  v_outfit text := lower(coalesce(v_source ->> 'outfit', 'steel'));
  v_trim text := lower(coalesce(v_source ->> 'trim', 'gold'));
  v_shoulders text := lower(coalesce(v_source ->> 'shoulders', 'leather'));
  v_cape text := lower(coalesce(v_source ->> 'cape', 'burgundy'));
  v_boots text := lower(coalesce(v_source ->> 'boots', 'dark'));
  v_weaponstyle text := lower(coalesce(v_source ->> 'weaponstyle', 'classic'));
  v_aura text := lower(coalesce(v_source ->> 'aura', 'none'));
  v_trail text := lower(coalesce(v_source ->> 'trail', 'none'));
begin
  if v_gender <> all(array['male','female']) then v_gender := 'male'; end if;
  if v_skin <> all(array['porcelain','fair','warm','tan','olive','deep','ebony','moon']) then v_skin := 'warm'; end if;
  if v_head <> all(array['classic','spiked','long','ponytail','braid','bob','curls','mohawk','shaved','bandana','hood','helm','circlet','wizardhat','crown','horns']) then v_head := 'classic'; end if;
  if v_hair <> all(array['brown','black','ginger','blonde','platinum','silver','white','violet','blue','green','pink','red']) then v_hair := 'brown'; end if;
  if v_eyes <> all(array['brown','blue','green','amber','grey','violet','red','glow']) then v_eyes := 'brown'; end if;
  if v_outfit <> all(array['steel','crimson','forest','royal','obsidian','frost','desert','teal','rose','ivory','sunfire','midnight']) then v_outfit := 'steel'; end if;
  if v_trim <> all(array['gold','silver','bronze','rune','rose','emerald','amethyst','blood','ivory','shadow']) then v_trim := 'gold'; end if;
  if v_shoulders <> all(array['none','leather','steel','spiked','ranger','mage','fur','dragon']) then v_shoulders := 'leather'; end if;
  if v_cape <> all(array['none','burgundy','navy','forest','shadow','ivory','crimson','royal','teal','golden','frost','void']) then v_cape := 'burgundy'; end if;
  if v_boots <> all(array['dark','brown','steel','gold','rune','crimson','ivory','shadow']) then v_boots := 'dark'; end if;
  if v_weaponstyle <> all(array['classic','gilded','rune','crystal','infernal','shadow','nature','frost']) then v_weaponstyle := 'classic'; end if;
  if v_aura <> all(array['none','embers','arcane','frost','nature','shadow','lightning','holy','blood','solar','lunar','ocean','wind','hearts','stars','void']) then v_aura := 'none'; end if;
  if v_trail <> all(array['none','sparks','smoke','petals','runes','water','leaves','starlight','lightning','souls']) then v_trail := 'none'; end if;

  return jsonb_build_object(
    'gender', v_gender,
    'skin', v_skin,
    'head', v_head,
    'hair', v_hair,
    'eyes', v_eyes,
    'outfit', v_outfit,
    'trim', v_trim,
    'shoulders', v_shoulders,
    'cape', v_cape,
    'boots', v_boots,
    'weaponstyle', v_weaponstyle,
    'aura', v_aura,
    'trail', v_trail
  );
end;
$$;

alter table public.characters
  alter column repo_combat_appearance set default public.repo_combat_clean_appearance('{}'::jsonb);

update public.characters
set repo_combat_appearance = public.repo_combat_clean_appearance(repo_combat_appearance);

create or replace function public.get_my_repo_combat_appearance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appearance jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'You must be logged in', errcode = 'P0001';
  end if;

  select public.repo_combat_clean_appearance(c.repo_combat_appearance)
    into v_appearance
  from public.characters c
  where c.user_id = auth.uid();

  if v_appearance is null then
    raise exception using message = 'Character not found', errcode = 'P0001';
  end if;

  return v_appearance;
end;
$$;

create or replace function public.set_my_repo_combat_appearance(p_appearance jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'You must be logged in', errcode = 'P0001';
  end if;

  v_clean := public.repo_combat_clean_appearance(p_appearance);

  update public.characters
     set repo_combat_appearance = v_clean
   where user_id = auth.uid();

  if not found then
    raise exception using message = 'Character not found', errcode = 'P0001';
  end if;

  return v_clean;
end;
$$;

revoke all on function public.repo_combat_clean_appearance(jsonb) from public;
revoke all on function public.get_my_repo_combat_appearance() from public;
revoke all on function public.set_my_repo_combat_appearance(jsonb) from public;

grant execute on function public.get_my_repo_combat_appearance() to authenticated;
grant execute on function public.set_my_repo_combat_appearance(jsonb) to authenticated;

notify pgrst, 'reload schema';
