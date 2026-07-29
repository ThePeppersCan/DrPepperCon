-- Repo Company: RuneScape XP curve and level 99 cap
-- 13,034,431 XP is level 99 and the maximum XP in every skill.

create or replace function public.level_from_xp(p_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  points bigint := 0;
  lvl integer;
  capped_xp bigint := least(greatest(coalesce(p_xp,0),0),13034431);
begin
  for lvl in 1..98 loop
    points := points + floor(lvl + 300 * power(2::numeric, lvl / 7.0))::bigint;
    if capped_xp < floor(points / 4.0) then return lvl; end if;
  end loop;
  return 99;
end;
$$;

-- Cap existing values without removing any levels or other account data.
update public.characters set
  woodcutting_xp = least(greatest(coalesce(woodcutting_xp,0),0),13034431),
  mining_xp = least(greatest(coalesce(mining_xp,0),0),13034431),
  fishing_xp = least(greatest(coalesce(fishing_xp,0),0),13034431),
  agility_xp = least(greatest(coalesce(agility_xp,0),0),13034431),
  slayer_xp = least(greatest(coalesce(slayer_xp,0),0),13034431),
  attack_xp = least(greatest(coalesce(attack_xp,0),0),13034431),
  strength_xp = least(greatest(coalesce(strength_xp,0),0),13034431),
  defence_xp = least(greatest(coalesce(defence_xp,0),0),13034431),
  sailing_xp = least(greatest(coalesce(sailing_xp,0),0),13034431),
  runecrafting_xp = least(greatest(coalesce(runecrafting_xp,0),0),13034431),
  cooking_xp = least(greatest(coalesce(cooking_xp,0),0),13034431);

create or replace function public.cap_character_skill_xp()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.woodcutting_xp := least(greatest(coalesce(new.woodcutting_xp,0),0),13034431);
  new.mining_xp := least(greatest(coalesce(new.mining_xp,0),0),13034431);
  new.fishing_xp := least(greatest(coalesce(new.fishing_xp,0),0),13034431);
  new.agility_xp := least(greatest(coalesce(new.agility_xp,0),0),13034431);
  new.slayer_xp := least(greatest(coalesce(new.slayer_xp,0),0),13034431);
  new.attack_xp := least(greatest(coalesce(new.attack_xp,0),0),13034431);
  new.strength_xp := least(greatest(coalesce(new.strength_xp,0),0),13034431);
  new.defence_xp := least(greatest(coalesce(new.defence_xp,0),0),13034431);
  new.sailing_xp := least(greatest(coalesce(new.sailing_xp,0),0),13034431);
  new.runecrafting_xp := least(greatest(coalesce(new.runecrafting_xp,0),0),13034431);
  new.cooking_xp := least(greatest(coalesce(new.cooking_xp,0),0),13034431);
  return new;
end;
$$;

drop trigger if exists characters_skill_xp_cap on public.characters;
create trigger characters_skill_xp_cap
before insert or update on public.characters
for each row execute function public.cap_character_skill_xp();

notify pgrst, 'reload schema';
