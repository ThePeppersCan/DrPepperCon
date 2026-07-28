-- CON OF DR PEPPER: ONE-MINUTE COMBAT SURVIVAL
-- Run once in Supabase -> SQL Editor.
-- Preserves all existing accounts, XP, Dash times, collection logs and can totals.

alter table public.characters
  add column if not exists attack_xp integer not null default 0 check (attack_xp >= 0),
  add column if not exists strength_xp integer not null default 0 check (strength_xp >= 0),
  add column if not exists defence_xp integer not null default 0 check (defence_xp >= 0);

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
  collection text[]
)
language sql security definer set search_path = public as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp,
         c.agility_xp, c.slayer_xp, c.attack_xp, c.strength_xp,
         c.defence_xp, c.collection
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.complete_combat_run(
  p_survived boolean,
  p_kills integer,
  p_damage integer,
  p_seconds integer
)
returns table(
  attack_xp integer,
  strength_xp integer,
  defence_xp integer,
  attack_gained integer,
  strength_gained integer,
  defence_gained integer
)
language plpgsql security definer set search_path = public as $$
declare
  a_gain integer;
  s_gain integer;
  d_gain integer;
  new_a integer;
  new_s integer;
  new_d integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_kills < 0 or p_kills > 500 or p_damage < 0 or p_damage > 100000 or p_seconds < 1 or p_seconds > 60 then
    raise exception 'Invalid combat run';
  end if;
  if p_survived and p_seconds < 57 then raise exception 'Run ended too quickly'; end if;

  a_gain := least(450, 15 + p_kills * 3 + case when p_survived then 60 else 0 end);
  s_gain := least(450, 15 + floor(p_damage / 8.0)::integer + case when p_survived then 45 else 0 end);
  d_gain := least(300, 10 + p_seconds * 2 + case when p_survived then 70 else 0 end);

  update public.characters as c
  set attack_xp = attack_xp + a_gain,
      strength_xp = strength_xp + s_gain,
      defence_xp = defence_xp + d_gain
  where user_id = auth.uid()
  returning c.attack_xp, c.strength_xp, c.defence_xp
  into new_a, new_s, new_d;

  if new_a is null then raise exception 'Character not found'; end if;
  return query select new_a, new_s, new_d, a_gain, s_gain, d_gain;
end;
$$;

create or replace function public.get_leaderboard()
returns table(username text, total_level integer)
language sql security definer set search_path = public as $$
  select c.username,
    public.level_from_xp(c.woodcutting_xp)
    + public.level_from_xp(c.mining_xp)
    + public.level_from_xp(c.fishing_xp)
    + public.level_from_xp(c.agility_xp)
    + public.level_from_xp(c.slayer_xp)
    + public.level_from_xp(c.attack_xp)
    + public.level_from_xp(c.strength_xp)
    + public.level_from_xp(c.defence_xp) as total_level
  from public.characters c
  order by 2 desc,
    (c.woodcutting_xp + c.mining_xp + c.fishing_xp + c.agility_xp + c.slayer_xp + c.attack_xp + c.strength_xp + c.defence_xp) desc
  limit 10;
$$;

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
  agility_best_ms integer,
  collection text[],
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp,
         c.agility_xp, c.slayer_xp, c.attack_xp, c.strength_xp,
         c.defence_xp, c.agility_best_ms, c.collection, c.created_at
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
  limit 1;
$$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.complete_combat_run(boolean, integer, integer, integer) to authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;
grant execute on function public.get_public_character(text) to anon, authenticated;
