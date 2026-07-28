-- CON OF DR PEPPER: JAD PRAYER-SWAP SIMULATOR / SLAYER SKILL
-- Run once in Supabase -> SQL Editor.
-- Preserves all accounts, existing XP, collections, Dash times and the can counter.

alter table public.characters
  add column if not exists slayer_xp integer not null default 0
  check (slayer_xp >= 0);

-- Return type changes require dropping these functions first.
drop function if exists public.get_my_character();
create function public.get_my_character()
returns table(
  username text,
  woodcutting_xp integer,
  mining_xp integer,
  fishing_xp integer,
  agility_xp integer,
  slayer_xp integer,
  collection text[]
)
language sql
security definer
set search_path = public
as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp,
         c.agility_xp, c.slayer_xp, c.collection
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.complete_jad_simulator(p_hits integer)
returns table(new_xp integer, xp_gained integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  gain integer := 150;
  updated_xp integer;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  if p_hits <> 12 then
    raise exception 'Jad was not fully defeated';
  end if;

  update public.characters
  set slayer_xp = slayer_xp + gain
  where user_id = auth.uid()
  returning slayer_xp into updated_xp;

  if updated_xp is null then
    raise exception 'Character not found';
  end if;

  return query select updated_xp, gain;
end;
$$;

create or replace function public.get_leaderboard()
returns table(username text, total_level integer)
language sql
security definer
set search_path = public
as $$
  select c.username,
    public.level_from_xp(c.woodcutting_xp)
    + public.level_from_xp(c.mining_xp)
    + public.level_from_xp(c.fishing_xp)
    + public.level_from_xp(c.agility_xp)
    + public.level_from_xp(c.slayer_xp) as total_level
  from public.characters c
  order by 2 desc,
    (c.woodcutting_xp + c.mining_xp + c.fishing_xp + c.agility_xp + c.slayer_xp) desc
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
  agility_best_ms integer,
  collection text[],
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp,
         c.agility_xp, c.slayer_xp, c.agility_best_ms, c.collection, c.created_at
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
  limit 1;
$$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.complete_jad_simulator(integer) to authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;
grant execute on function public.get_public_character(text) to anon, authenticated;
