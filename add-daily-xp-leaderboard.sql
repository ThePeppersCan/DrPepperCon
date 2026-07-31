-- REPO COMPANY: DAILY XP LEADERBOARD
-- Run this once in Supabase -> SQL Editor.
-- It automatically records every positive XP change made to public.characters.

create table if not exists public.daily_xp_totals (
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_date date not null default (timezone('Europe/London', now()))::date,
  xp_earned bigint not null default 0 check (xp_earned >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, xp_date)
);

alter table public.daily_xp_totals enable row level security;

drop policy if exists "Daily XP is publicly readable" on public.daily_xp_totals;
create policy "Daily XP is publicly readable"
on public.daily_xp_totals for select
using (true);

create or replace function public.track_character_daily_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gained bigint := 0;
begin
  gained :=
      greatest(coalesce(new.woodcutting_xp,0) - coalesce(old.woodcutting_xp,0), 0)
    + greatest(coalesce(new.mining_xp,0) - coalesce(old.mining_xp,0), 0)
    + greatest(coalesce(new.fishing_xp,0) - coalesce(old.fishing_xp,0), 0)
    + greatest(coalesce(new.agility_xp,0) - coalesce(old.agility_xp,0), 0)
    + greatest(coalesce(new.slayer_xp,0) - coalesce(old.slayer_xp,0), 0)
    + greatest(coalesce(new.attack_xp,0) - coalesce(old.attack_xp,0), 0)
    + greatest(coalesce(new.strength_xp,0) - coalesce(old.strength_xp,0), 0)
    + greatest(coalesce(new.defence_xp,0) - coalesce(old.defence_xp,0), 0)
    + greatest(coalesce(new.ranged_xp,0) - coalesce(old.ranged_xp,0), 0)
    + greatest(coalesce(new.magic_xp,0) - coalesce(old.magic_xp,0), 0)
    + greatest(coalesce(new.sailing_xp,0) - coalesce(old.sailing_xp,0), 0)
    + greatest(coalesce(new.runecrafting_xp,0) - coalesce(old.runecrafting_xp,0), 0)
    + greatest(coalesce(new.cooking_xp,0) - coalesce(old.cooking_xp,0), 0)
    + greatest(coalesce(new.farming_xp,0) - coalesce(old.farming_xp,0), 0);

  if gained > 0 then
    insert into public.daily_xp_totals(user_id, xp_date, xp_earned, updated_at)
    values (new.user_id, (timezone('Europe/London', now()))::date, gained, now())
    on conflict (user_id, xp_date) do update
      set xp_earned = public.daily_xp_totals.xp_earned + excluded.xp_earned,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists characters_daily_xp_trigger on public.characters;
create trigger characters_daily_xp_trigger
after update on public.characters
for each row execute function public.track_character_daily_xp();

create or replace function public.get_daily_xp_leaderboard()
returns table(username text, xp_earned bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.username, d.xp_earned
  from public.daily_xp_totals d
  join public.characters c on c.user_id = d.user_id
  where d.xp_date = (timezone('Europe/London', now()))::date
    and d.xp_earned > 0
  order by d.xp_earned desc, c.username asc
  limit 5;
$$;

grant execute on function public.get_daily_xp_leaderboard() to anon, authenticated;
