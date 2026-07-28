-- CON OF DR PEPPER: AGILITY MINIGAME UPDATE
-- Run this once in Supabase -> SQL Editor.
-- This preserves all accounts, existing XP, collection logs and the can counter.

alter table public.characters
  add column if not exists agility_xp integer not null default 0 check (agility_xp >= 0);

create or replace function public.get_my_character()
returns table(
  username text,
  woodcutting_xp integer,
  mining_xp integer,
  fishing_xp integer,
  agility_xp integer,
  collection text[]
)
language sql security definer set search_path = public as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp, c.agility_xp, c.collection
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.complete_agility_course(p_total_ms integer, p_average_ms integer)
returns table(new_xp integer, xp_gained integer)
language plpgsql security definer set search_path = public as $$
declare
  gain integer;
  updated_xp integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_total_ms < 1200 or p_average_ms < 80 then raise exception 'Invalid course time'; end if;

  gain := case
    when p_average_ms <= 300 then 120
    when p_average_ms <= 450 then 90
    when p_average_ms <= 650 then 70
    else 50
  end;

  update public.characters
  set agility_xp = agility_xp + gain
  where user_id = auth.uid()
  returning agility_xp into updated_xp;

  if updated_xp is null then raise exception 'Character not found'; end if;
  return query select updated_xp, gain;
end;
$$;

create or replace function public.get_leaderboard()
returns table(username text, total_level integer)
language sql security definer set search_path = public as $$
  select c.username,
    public.level_from_xp(c.woodcutting_xp)
    + public.level_from_xp(c.mining_xp)
    + public.level_from_xp(c.fishing_xp)
    + public.level_from_xp(c.agility_xp) as total_level
  from public.characters c
  order by 2 desc, (c.woodcutting_xp + c.mining_xp + c.fishing_xp + c.agility_xp) desc
  limit 10;
$$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.complete_agility_course(integer, integer) to authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;
