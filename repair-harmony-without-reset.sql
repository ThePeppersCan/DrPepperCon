-- REPO COMPANY: SAFE HARMONY REPAIR
-- Run this entire file. It does NOT reset character XP or Harmony XP.

insert into public.counter (id, count)
values (1, 0)
on conflict (id) do nothing;

alter table public.counter
  alter column count type bigint using count::bigint;

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
    if checked_xp < floor(points / 4.0) then return lvl; end if;
  end loop;
  return 99;
end;
$$;

drop function if exists public.change_counter(integer);
create function public.change_counter(amount integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
begin
  if amount <> 1 then raise exception 'Harmony can only be trained one XP at a time'; end if;
  update public.counter
     set count = coalesce(count, 0) + 1
   where id = 1
   returning count into new_count;
  if new_count is null then
    insert into public.counter(id, count) values (1, 1)
    on conflict (id) do update set count = public.counter.count + 1
    returning count into new_count;
  end if;
  if auth.uid() is not null and to_regclass('public.daily_xp_totals') is not null then
    insert into public.daily_xp_totals(user_id, xp_date, xp_earned, updated_at)
    values (auth.uid(), (timezone('Europe/London', now()))::date, 1, now())
    on conflict (user_id, xp_date) do update
      set xp_earned = public.daily_xp_totals.xp_earned + 1, updated_at = now();
  end if;
  return new_count;
end;
$$;
grant execute on function public.change_counter(integer) to anon, authenticated;
notify pgrst, 'reload schema';
