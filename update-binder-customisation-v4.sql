-- REPO COMPANY: BINDER CUSTOMISATION V4
-- Run this whole file once in Supabase -> SQL Editor.
-- Keeps the six permanent 10,000 GP legendary animations, clips Inferno/Celestial particles to the binder spread, and adds six new colour themes.
-- Preserves every account, card, GP balance and existing binder setting.

alter table public.characters
  add column if not exists binder_legendary_effects text[] not null default '{}'::text[];

-- Remove any unknown/duplicate entries without touching valid purchases.
update public.characters c
set binder_legendary_effects = coalesce((
  select array_agg(distinct lower(btrim(effect_name)) order by lower(btrim(effect_name)))
  from unnest(coalesce(c.binder_legendary_effects, '{}'::text[])) as effect_name
  where lower(btrim(effect_name)) in (
    'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
  )
), '{}'::text[]);

-- A legendary selection must always correspond to an owned unlock.
update public.characters c
set binder_effect = 'stardust'
where lower(coalesce(c.binder_effect,'')) in (
  'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
)
  and not (lower(c.binder_effect) = any(coalesce(c.binder_legendary_effects, '{}'::text[])));

-- V4-compatible response using the existing V3 RPC name so deployed sites keep working.
create or replace function public.get_my_quidditch_binder_style_v3()
returns table(
  username text,
  theme text,
  effect text,
  finish text,
  unlocked_effects text[],
  gp bigint
)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         case
           when lower(coalesce(c.binder_effect,'')) in (
             'calm','stardust','aurora','embers','goldfall','moonmist',
             'runes','fireflies','comet','ripple',
             'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
           ) then lower(c.binder_effect)
           else 'stardust'
         end::text,
         coalesce(c.binder_finish,'classic')::text,
         coalesce(c.binder_legendary_effects, '{}'::text[])::text[],
         coalesce(c.gp,0)::bigint
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

-- Public viewers can see the selected style, including the new colourways and legendary effects.
-- Admin's binder remains private.
create or replace function public.get_public_quidditch_binder_style_v3(p_username text)
returns table(username text, theme text, effect text, finish text)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         case
           when lower(coalesce(c.binder_effect,'')) in (
             'calm','stardust','aurora','embers','goldfall','moonmist',
             'runes','fireflies','comet','ripple',
             'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
           ) then lower(c.binder_effect)
           else 'stardust'
         end::text,
         coalesce(c.binder_finish,'classic')::text
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
    and lower(c.username) <> 'admin'
  limit 1;
$$;

-- Saves any free effect, or a legendary effect already owned by this account.
create or replace function public.set_my_quidditch_binder_style_v3(
  p_theme text,
  p_effect text,
  p_finish text
)
returns table(
  theme text,
  effect text,
  finish text,
  unlocked_effects text[],
  gp bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text := lower(btrim(coalesce(p_theme,'')));
  v_effect text := lower(btrim(coalesce(p_effect,'')));
  v_finish text := lower(btrim(coalesce(p_finish,'')));
  v_character public.characters%rowtype;
  v_legendary text[] := array[
    'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
  ]::text[];
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  select * into v_character
  from public.characters c
  where c.user_id = auth.uid();

  if not found then
    raise exception 'Character not found';
  end if;

  if v_theme not in (
    'midnight','emerald','royal','crimson','frost','golden',
    'ocean','rose','obsidian','sunfire',
    'sapphire','amethyst','bloodmoon','jade','copper','neon'
  ) then
    raise exception 'Invalid binder colour theme';
  end if;

  if v_effect not in (
    'calm','stardust','aurora','embers','goldfall','moonmist',
    'runes','fireflies','comet','ripple',
    'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
  ) then
    raise exception 'Invalid binder background effect';
  end if;

  if v_finish not in ('classic','crystal','shadow','platinum','enchanted') then
    raise exception 'Invalid binder pocket finish';
  end if;

  if v_effect = any(v_legendary)
     and not (v_effect = any(coalesce(v_character.binder_legendary_effects, '{}'::text[]))) then
    raise exception 'This legendary binder animation has not been purchased';
  end if;

  return query
  update public.characters c
     set binder_theme = v_theme,
         binder_effect = v_effect,
         binder_finish = v_finish
   where c.user_id = auth.uid()
  returning c.binder_theme::text,
            c.binder_effect::text,
            c.binder_finish::text,
            coalesce(c.binder_legendary_effects, '{}'::text[])::text[],
            coalesce(c.gp,0)::bigint;
end;
$$;

-- Secure permanent purchase. The server checks and removes exactly 10,000 GP.
-- Re-clicking an already owned animation equips it but never charges twice.
create or replace function public.purchase_quidditch_binder_legendary_effect(p_effect text)
returns table(
  theme text,
  effect text,
  finish text,
  unlocked_effects text[],
  gp bigint,
  charged boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effect text := lower(btrim(coalesce(p_effect,'')));
  v_character public.characters%rowtype;
  v_price integer := 10000;
  v_already_owned boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  if v_effect not in (
    'inferno','celestial','dragonhoard','phoenix','voidrift','enchantedwilds'
  ) then
    raise exception 'Invalid legendary binder animation';
  end if;

  select * into v_character
  from public.characters c
  where c.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Character not found';
  end if;

  v_already_owned := v_effect = any(coalesce(v_character.binder_legendary_effects, '{}'::text[]));

  if not v_already_owned and coalesce(v_character.gp,0) < v_price then
    raise exception 'You need 10,000 GP to unlock this legendary binder animation';
  end if;

  update public.characters c
     set gp = case
                when v_already_owned then c.gp
                else coalesce(c.gp,0) - v_price
              end,
         binder_legendary_effects = case
                when v_already_owned then coalesce(c.binder_legendary_effects, '{}'::text[])
                else array_append(coalesce(c.binder_legendary_effects, '{}'::text[]), v_effect)
              end,
         binder_effect = v_effect
   where c.user_id = auth.uid()
  returning * into v_character;

  return query select
    coalesce(v_character.binder_theme,'midnight')::text,
    coalesce(v_character.binder_effect,'stardust')::text,
    coalesce(v_character.binder_finish,'classic')::text,
    coalesce(v_character.binder_legendary_effects, '{}'::text[])::text[],
    coalesce(v_character.gp,0)::bigint,
    (not v_already_owned)::boolean;
end;
$$;

revoke all on function public.get_my_quidditch_binder_style_v3() from public;
revoke all on function public.get_public_quidditch_binder_style_v3(text) from public;
revoke all on function public.set_my_quidditch_binder_style_v3(text,text,text) from public;
revoke all on function public.purchase_quidditch_binder_legendary_effect(text) from public;

grant execute on function public.get_my_quidditch_binder_style_v3() to authenticated;
grant execute on function public.get_public_quidditch_binder_style_v3(text) to anon, authenticated;
grant execute on function public.set_my_quidditch_binder_style_v3(text,text,text) to authenticated;
grant execute on function public.purchase_quidditch_binder_legendary_effect(text) to authenticated;

notify pgrst, 'reload schema';
