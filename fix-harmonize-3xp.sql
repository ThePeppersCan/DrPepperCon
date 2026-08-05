-- REPO COMPANY — HARMONIZE 3 XP SERVER FIX
-- Run this entire file once in Supabase -> SQL Editor.
--
-- The website now calls a fixed, server-authoritative function for Harmonize.
-- Every successful click adds exactly 3 shared Harmony XP.

create table if not exists public.counter (
  id integer primary key,
  count integer not null default 0 check (count >= 0)
);

insert into public.counter (id, count)
values (1, 0)
on conflict (id) do nothing;

create or replace function public.gain_harmony_xp()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.counter
     set count = count + 3
   where id = 1
   returning count into new_count;

  if new_count is null then
    insert into public.counter (id, count)
    values (1, 3)
    on conflict (id) do update
      set count = public.counter.count + 3
    returning count into new_count;
  end if;

  return new_count;
end;
$$;

revoke all on function public.gain_harmony_xp() from public;
grant execute on function public.gain_harmony_xp() to anon, authenticated;

notify pgrst, 'reload schema';
