-- REPO COMBAT: PERSONAL FIGHTER CUSTOMISATION
-- Run this entire file once in Supabase -> SQL Editor.
-- It preserves every account, XP total, GP balance, bank item and existing setting.

alter table public.characters
  add column if not exists repo_combat_appearance jsonb not null default jsonb_build_object(
    'skin', 'warm',
    'head', 'classic',
    'hair', 'brown',
    'outfit', 'steel',
    'trim', 'gold',
    'cape', 'burgundy',
    'aura', 'none'
  );

update public.characters
set repo_combat_appearance = jsonb_build_object(
  'skin', 'warm',
  'head', 'classic',
  'hair', 'brown',
  'outfit', 'steel',
  'trim', 'gold',
  'cape', 'burgundy',
  'aura', 'none'
)
where repo_combat_appearance is null
   or jsonb_typeof(repo_combat_appearance) <> 'object';

create or replace function public.repo_combat_clean_appearance(p_appearance jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_source jsonb := coalesce(p_appearance, '{}'::jsonb);
  v_skin text := lower(coalesce(v_source ->> 'skin', 'warm'));
  v_head text := lower(coalesce(v_source ->> 'head', 'classic'));
  v_hair text := lower(coalesce(v_source ->> 'hair', 'brown'));
  v_outfit text := lower(coalesce(v_source ->> 'outfit', 'steel'));
  v_trim text := lower(coalesce(v_source ->> 'trim', 'gold'));
  v_cape text := lower(coalesce(v_source ->> 'cape', 'burgundy'));
  v_aura text := lower(coalesce(v_source ->> 'aura', 'none'));
begin
  if v_skin <> all(array['fair','warm','tan','deep','moon']) then v_skin := 'warm'; end if;
  if v_head <> all(array['classic','spiked','hood','helm','circlet']) then v_head := 'classic'; end if;
  if v_hair <> all(array['brown','black','ginger','blonde','silver','violet']) then v_hair := 'brown'; end if;
  if v_outfit <> all(array['steel','crimson','forest','royal','obsidian','frost']) then v_outfit := 'steel'; end if;
  if v_trim <> all(array['gold','silver','bronze','rune','rose']) then v_trim := 'gold'; end if;
  if v_cape <> all(array['none','burgundy','navy','forest','shadow','ivory']) then v_cape := 'burgundy'; end if;
  if v_aura <> all(array['none','embers','arcane','frost','nature','shadow']) then v_aura := 'none'; end if;

  return jsonb_build_object(
    'skin', v_skin,
    'head', v_head,
    'hair', v_hair,
    'outfit', v_outfit,
    'trim', v_trim,
    'cape', v_cape,
    'aura', v_aura
  );
end;
$$;

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
