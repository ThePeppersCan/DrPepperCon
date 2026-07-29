-- REPO COMPANY: GNOME BALL AGILITY MINIGAME
-- Run once in Supabase -> SQL Editor. Existing accounts and XP are preserved.

alter table public.characters
  add column if not exists gnome_ball_best integer not null default 0 check (gnome_ball_best >= 0);

create or replace function public.complete_gnome_ball(p_streak integer)
returns table(new_xp integer, xp_gained integer, best_streak integer, is_personal_best boolean)
language plpgsql security definer set search_path = public as $$
declare
  gain integer;
  updated_xp integer;
  previous_best integer;
  updated_best integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_streak < 1 or p_streak > 500 then raise exception 'Invalid streak'; end if;

  -- Strong streaks earn substantially more, without making tiny attempts useless.
  gain := least(900, 30 + (p_streak * 12) + (greatest(0, p_streak - 10) * 5));

  select c.gnome_ball_best into previous_best
  from public.characters c where c.user_id = auth.uid() limit 1;

  update public.characters
  set agility_xp = agility_xp + gain,
      gnome_ball_best = greatest(gnome_ball_best, p_streak)
  where user_id = auth.uid()
  returning agility_xp, gnome_ball_best into updated_xp, updated_best;

  if updated_xp is null then raise exception 'Character not found'; end if;
  return query select updated_xp, gain, updated_best, p_streak > coalesce(previous_best, 0);
end;
$$;

create or replace function public.get_gnome_ball_leaderboard()
returns table(username text, best_streak integer)
language sql security definer set search_path = public as $$
  select c.username, c.gnome_ball_best
  from public.characters c
  where c.gnome_ball_best > 0
  order by c.gnome_ball_best desc, c.username asc
  limit 10;
$$;

grant execute on function public.complete_gnome_ball(integer) to authenticated;
grant execute on function public.get_gnome_ball_leaderboard() to anon, authenticated;
