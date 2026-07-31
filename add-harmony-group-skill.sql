-- REPO COMPANY: SHARED HARMONY SKILL
-- Run this entire file once in Supabase -> SQL Editor.
-- Harmony uses the existing shared counter value as XP, so no progress is lost.

-- Remove older function signatures first. PostgreSQL cannot change a function's
-- return type through CREATE OR REPLACE.
drop function if exists public.change_counter(integer);
drop function if exists public.get_leaderboard();

-- The shared value is Harmony XP. Keep it readable by everyone and live-updated.
alter table public.counter alter column count type bigint using count::bigint;
insert into public.counter (id, count) values (1, 0) on conflict (id) do nothing;

-- One click grants one shared Harmony XP. Logged-in clicks are also credited
-- to that player's daily XP total for the Daily Leaderboard.
create or replace function public.change_counter(amount integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if amount <> 1 then
    raise exception 'Harmony can only be trained one XP at a time';
  end if;

  update public.counter
  set count = coalesce(count, 0) + 1
  where id = 1
  returning count into new_count;

  if auth.uid() is not null and to_regclass('public.daily_xp_totals') is not null then
    insert into public.daily_xp_totals(user_id, xp_date, xp_earned, updated_at)
    values (auth.uid(), (timezone('Europe/London', now()))::date, 1, now())
    on conflict (user_id, xp_date) do update
      set xp_earned = public.daily_xp_totals.xp_earned + 1,
          updated_at = now();
  end if;

  return new_count;
end;
$$;

grant execute on function public.change_counter(integer) to anon, authenticated;


-- Bigint overload for the shared Harmony counter. The regular character skills
-- use integer XP columns, while Harmony is stored as bigint so it can continue
-- accumulating safely after level 99.
create or replace function public.level_from_xp(p_xp bigint)
returns integer
language plpgsql
immutable
as $$
declare
  points bigint := 0;
  lvl integer;
  checked_xp bigint := greatest(coalesce(p_xp, 0), 0);
begin
  for lvl in 1..98 loop
    points := points + floor(lvl + 300 * power(2::numeric, lvl / 7.0))::bigint;
    if checked_xp < floor(points / 4.0) then
      return lvl;
    end if;
  end loop;
  return 99;
end;
$$;

-- Harmony follows the exact RuneScape XP curve and is shared by every player.
-- It contributes the same Harmony level to every player's total level.
create or replace function public.get_leaderboard()
returns table(username text, total_level integer)
language sql
stable
security definer
set search_path = public
as $$
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
      public.level_from_xp(coalesce(c.cooking_xp,0)) +
      public.level_from_xp(coalesce(c.farming_xp,0)) +
      public.level_from_xp(coalesce(h.count,0))
    )::integer as total_level
  from public.characters c
  cross join public.counter h
  where h.id = 1
  order by total_level desc,
    (coalesce(c.woodcutting_xp,0)+coalesce(c.mining_xp,0)+coalesce(c.fishing_xp,0)+
     coalesce(c.agility_xp,0)+coalesce(c.slayer_xp,0)+coalesce(c.attack_xp,0)+
     coalesce(c.strength_xp,0)+coalesce(c.defence_xp,0)+coalesce(c.magic_xp,0)+
     coalesce(c.ranged_xp,0)+coalesce(c.sailing_xp,0)+coalesce(c.runecrafting_xp,0)+
     coalesce(c.cooking_xp,0)+coalesce(c.farming_xp,0)) desc,
    c.username asc
  limit 100;
$$;

grant execute on function public.get_leaderboard() to anon, authenticated;
notify pgrst, 'reload schema';
