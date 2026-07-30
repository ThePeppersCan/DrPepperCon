-- FIX: COOKING XP + ACCOUNT / LEADERBOARD TOTAL LEVELS
-- Run this entire file once in Supabase -> SQL Editor.
-- Preserves every account and all existing XP.

alter table public.characters
  add column if not exists cooking_xp integer not null default 0;

update public.characters
set cooking_xp = least(13034431, greatest(0, coalesce(cooking_xp, 0)));

-- Ensure the signed-in account payload includes Cooking.
drop function if exists public.get_my_character();
create function public.get_my_character()
returns table(
  username text,
  woodcutting_xp integer,
  mining_xp integer,
  fishing_xp integer,
  agility_xp integer,
  slayer_xp integer,
  attack_xp integer,
  strength_xp integer,
  defence_xp integer,
  sailing_xp integer,
  runecrafting_xp integer,
  cooking_xp integer,
  agility_best_ms integer,
  collection text[],
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select c.username,
         coalesce(c.woodcutting_xp,0), coalesce(c.mining_xp,0),
         coalesce(c.fishing_xp,0), coalesce(c.agility_xp,0),
         coalesce(c.slayer_xp,0), coalesce(c.attack_xp,0),
         coalesce(c.strength_xp,0), coalesce(c.defence_xp,0),
         coalesce(c.sailing_xp,0), coalesce(c.runecrafting_xp,0),
         coalesce(c.cooking_xp,0), c.agility_best_ms,
         coalesce(c.collection, array[]::text[]), c.created_at
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

-- Ensure clicked leaderboard profiles include Cooking too.
drop function if exists public.get_public_character(text);
create function public.get_public_character(p_username text)
returns table(
  username text,
  woodcutting_xp integer,
  mining_xp integer,
  fishing_xp integer,
  agility_xp integer,
  slayer_xp integer,
  attack_xp integer,
  strength_xp integer,
  defence_xp integer,
  sailing_xp integer,
  runecrafting_xp integer,
  cooking_xp integer,
  agility_best_ms integer,
  collection text[],
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select c.username,
         coalesce(c.woodcutting_xp,0), coalesce(c.mining_xp,0),
         coalesce(c.fishing_xp,0), coalesce(c.agility_xp,0),
         coalesce(c.slayer_xp,0), coalesce(c.attack_xp,0),
         coalesce(c.strength_xp,0), coalesce(c.defence_xp,0),
         coalesce(c.sailing_xp,0), coalesce(c.runecrafting_xp,0),
         coalesce(c.cooking_xp,0), c.agility_best_ms,
         coalesce(c.collection, array[]::text[]), c.created_at
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
  limit 1;
$$;

-- One authoritative 11-skill total used by the main leaderboard.
create or replace function public.get_leaderboard()
returns table(username text, total_level integer)
language sql security definer set search_path = public as $$
  select c.username,
    (
      public.level_from_xp(coalesce(c.woodcutting_xp,0)) +
      public.level_from_xp(coalesce(c.mining_xp,0)) +
      public.level_from_xp(coalesce(c.fishing_xp,0)) +
      public.level_from_xp(coalesce(c.agility_xp,0)) +
      public.level_from_xp(coalesce(c.slayer_xp,0)) +
      public.level_from_xp(coalesce(c.attack_xp,0)) +
      public.level_from_xp(coalesce(c.strength_xp,0)) +
      public.level_from_xp(coalesce(c.defence_xp,0)) +
      public.level_from_xp(coalesce(c.sailing_xp,0)) +
      public.level_from_xp(coalesce(c.runecrafting_xp,0)) +
      public.level_from_xp(coalesce(c.cooking_xp,0))
    )::integer as total_level
  from public.characters c
  order by total_level desc,
    (coalesce(c.woodcutting_xp,0)+coalesce(c.mining_xp,0)+coalesce(c.fishing_xp,0)+
     coalesce(c.agility_xp,0)+coalesce(c.slayer_xp,0)+coalesce(c.attack_xp,0)+
     coalesce(c.strength_xp,0)+coalesce(c.defence_xp,0)+coalesce(c.sailing_xp,0)+
     coalesce(c.runecrafting_xp,0)+coalesce(c.cooking_xp,0)) desc,
    c.username asc
  limit 100;
$$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.get_public_character(text) to anon, authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;

notify pgrst, 'reload schema';
