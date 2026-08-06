-- REPO COMPANY — HARMONIZE +3 XP, EXPLICIT RESULT FIX
-- Run this entire file once in Supabase -> SQL Editor.
--
-- Every successful Harmonize click adds exactly 3 shared Harmony XP.
-- The function returns the previous XP, the amount gained, and the new XP so
-- the website cannot accidentally interpret a remaining-XP value as a loss.

create table if not exists public.counter (
  id integer primary key,
  count integer not null default 0 check (count >= 0)
);

insert into public.counter (id, count)
values (1, 0)
on conflict (id) do nothing;

create or replace function public.harmonize_once_v2()
returns table(
  previous_xp integer,
  xp_gained integer,
  new_xp integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous integer;
  v_new integer;
begin
  -- Lock the shared Harmony row so simultaneous clicks cannot overwrite one another.
  select c.count
    into v_previous
    from public.counter c
   where c.id = 1
   for update;

  if v_previous is null then
    insert into public.counter (id, count)
    values (1, 3)
    on conflict (id) do update
      set count = public.counter.count + 3
    returning public.counter.count - 3, public.counter.count
      into v_previous, v_new;
  else
    update public.counter
       set count = v_previous + 3
     where id = 1
     returning count into v_new;
  end if;

  return query
  select v_previous, 3, v_new;
end;
$$;

revoke all on function public.harmonize_once_v2() from public;
grant execute on function public.harmonize_once_v2() to anon, authenticated;

notify pgrst, 'reload schema';
