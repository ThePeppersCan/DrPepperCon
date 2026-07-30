-- ADD MAGIC + RANGED XP TO LEVEL COMBAT
-- Run this entire file once in Supabase -> SQL Editor.
-- Existing accounts and all current XP are preserved.

alter table public.characters
  add column if not exists magic_xp integer not null default 0,
  add column if not exists ranged_xp integer not null default 0;

update public.characters
set magic_xp = least(13034431, greatest(0, coalesce(magic_xp, 0))),
    ranged_xp = least(13034431, greatest(0, coalesce(ranged_xp, 0)));

-- Return the two new skills when loading the signed-in account.
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
  magic_xp integer,
  ranged_xp integer,
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
         coalesce(c.magic_xp,0), coalesce(c.ranged_xp,0),
         coalesce(c.sailing_xp,0), coalesce(c.runecrafting_xp,0),
         coalesce(c.cooking_xp,0), c.agility_best_ms,
         coalesce(c.collection, array[]::text[]), c.created_at
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

-- Return Magic and Ranged on clicked leaderboard profiles.
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
  magic_xp integer,
  ranged_xp integer,
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
         coalesce(c.magic_xp,0), coalesce(c.ranged_xp,0),
         coalesce(c.sailing_xp,0), coalesce(c.runecrafting_xp,0),
         coalesce(c.cooking_xp,0), c.agility_best_ms,
         coalesce(c.collection, array[]::text[]), c.created_at
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
  limit 1;
$$;

-- Weapon-aware combat rewards.
-- Sword: Attack + Strength + Defence.
-- Bow: all earned combat reward is combined into Ranged.
-- Staff: all earned combat reward is combined into Magic.
drop function if exists public.complete_combat_run(boolean, integer, integer, integer);
drop function if exists public.complete_combat_run(boolean, integer, integer, integer, text);
drop function if exists public.complete_combat_run(boolean, integer, integer, integer, text, text);

create function public.complete_combat_run(
  p_survived boolean,
  p_kills integer,
  p_damage integer,
  p_seconds integer,
  p_difficulty text default 'medium',
  p_weapon text default 'sword'
)
returns table(
  attack_xp integer,
  strength_xp integer,
  defence_xp integer,
  magic_xp integer,
  ranged_xp integer,
  attack_gained integer,
  strength_gained integer,
  defence_gained integer,
  magic_gained integer,
  ranged_gained integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric := case lower(coalesce(p_difficulty, 'medium'))
    when 'easy' then 0.75
    when 'hard' then 1.55
    when 'insane' then 2.35
    else 1.10
  end;
  base_attack integer;
  base_strength integer;
  base_defence integer;
  combined_gain integer;
  weapon text := lower(coalesce(p_weapon, 'sword'));
begin
  if auth.uid() is null then raise exception 'Login required'; end if;

  base_attack := greatest(1, floor((least(greatest(coalesce(p_kills,0),0),500) * 3 + case when p_survived then 45 else 0 end) * mult));
  base_strength := greatest(1, floor((least(greatest(coalesce(p_damage,0),0),50000) / 10.0 + case when p_survived then 55 else 0 end) * mult));
  base_defence := greatest(1, floor((least(greatest(coalesce(p_seconds,0),0),1800) * 2 + case when p_survived then 65 else 0 end) * mult));
  combined_gain := base_attack + base_strength + base_defence;

  attack_gained := case when weapon in ('sword','dharok') then base_attack else 0 end;
  strength_gained := case when weapon in ('sword','dharok') then base_strength else 0 end;
  defence_gained := case when weapon in ('sword','dharok') then base_defence else 0 end;
  magic_gained := case when weapon in ('staff','shadow') then combined_gain else 0 end;
  ranged_gained := case when weapon in ('bow','blowpipe') then combined_gain else 0 end;

  update public.characters c
  set attack_xp = least(13034431, c.attack_xp + attack_gained),
      strength_xp = least(13034431, c.strength_xp + strength_gained),
      defence_xp = least(13034431, c.defence_xp + defence_gained),
      magic_xp = least(13034431, c.magic_xp + magic_gained),
      ranged_xp = least(13034431, c.ranged_xp + ranged_gained)
  where c.user_id = auth.uid()
  returning c.attack_xp, c.strength_xp, c.defence_xp, c.magic_xp, c.ranged_xp
  into attack_xp, strength_xp, defence_xp, magic_xp, ranged_xp;

  if attack_xp is null then raise exception 'Character not found'; end if;
  return next;
end;
$$;

-- Main leaderboard now uses all 13 skills.
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
      public.level_from_xp(coalesce(c.magic_xp,0)) +
      public.level_from_xp(coalesce(c.ranged_xp,0)) +
      public.level_from_xp(coalesce(c.sailing_xp,0)) +
      public.level_from_xp(coalesce(c.runecrafting_xp,0)) +
      public.level_from_xp(coalesce(c.cooking_xp,0))
    )::integer as total_level
  from public.characters c
  order by total_level desc,
    (coalesce(c.woodcutting_xp,0)+coalesce(c.mining_xp,0)+coalesce(c.fishing_xp,0)+
     coalesce(c.agility_xp,0)+coalesce(c.slayer_xp,0)+coalesce(c.attack_xp,0)+
     coalesce(c.strength_xp,0)+coalesce(c.defence_xp,0)+coalesce(c.magic_xp,0)+
     coalesce(c.ranged_xp,0)+coalesce(c.sailing_xp,0)+coalesce(c.runecrafting_xp,0)+
     coalesce(c.cooking_xp,0)) desc,
    c.username asc
  limit 100;
$$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.get_public_character(text) to anon, authenticated;
grant execute on function public.complete_combat_run(boolean, integer, integer, integer, text, text) to authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;

notify pgrst, 'reload schema';
