-- CON OF DR PEPPER: CLICKABLE PLAYER STATS + FASTEST DASH LEADERBOARD
-- Run this once in Supabase -> SQL Editor.
-- It preserves all accounts, XP, collection logs and the shared can counter.

alter table public.characters
  add column if not exists agility_best_ms integer check (agility_best_ms is null or agility_best_ms >= 1200);

create or replace function public.complete_agility_course(p_total_ms integer, p_average_ms integer)
returns table(new_xp integer, xp_gained integer, best_ms integer, is_personal_best boolean)
language plpgsql security definer set search_path = public as $$
declare
  gain integer;
  updated_xp integer;
  previous_best integer;
  updated_best integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_total_ms < 1200 or p_total_ms > 120000 or p_average_ms < 80 then
    raise exception 'Invalid course time';
  end if;

  gain := case
    when p_average_ms <= 300 then 120
    when p_average_ms <= 450 then 90
    when p_average_ms <= 650 then 70
    else 50
  end;

  select c.agility_best_ms into previous_best
  from public.characters c
  where c.user_id = auth.uid();

  update public.characters
  set agility_xp = agility_xp + gain,
      agility_best_ms = case
        when agility_best_ms is null or p_total_ms < agility_best_ms then p_total_ms
        else agility_best_ms
      end
  where user_id = auth.uid()
  returning agility_xp, agility_best_ms into updated_xp, updated_best;

  if updated_xp is null then raise exception 'Character not found'; end if;
  return query select updated_xp, gain, updated_best,
    (previous_best is null or p_total_ms < previous_best);
end;
$$;

create or replace function public.get_public_character(p_username text)
returns table(
  username text,
  woodcutting_xp integer,
  mining_xp integer,
  fishing_xp integer,
  agility_xp integer,
  agility_best_ms integer,
  collection text[],
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select c.username, c.woodcutting_xp, c.mining_xp, c.fishing_xp,
         c.agility_xp, c.agility_best_ms, c.collection, c.created_at
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
  limit 1;
$$;

create or replace function public.get_agility_leaderboard()
returns table(username text, best_ms integer)
language sql security definer set search_path = public as $$
  select c.username, c.agility_best_ms
  from public.characters c
  where c.agility_best_ms is not null
  order by c.agility_best_ms asc, c.created_at asc
  limit 10;
$$;

grant execute on function public.complete_agility_course(integer, integer) to authenticated;
grant execute on function public.get_public_character(text) to anon, authenticated;
grant execute on function public.get_agility_leaderboard() to anon, authenticated;
