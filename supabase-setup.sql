-- Run this entire file in Supabase: SQL Editor -> New query -> Run

create table if not exists public.counter (
  id integer primary key,
  count integer not null default 0 check (count >= 0)
);

insert into public.counter (id, count)
values (1, 0)
on conflict (id) do nothing;

alter table public.counter enable row level security;

drop policy if exists "Anyone can read" on public.counter;
create policy "Anyone can read"
on public.counter
for select
to anon, authenticated
using (true);

-- Direct browser updates are intentionally blocked. Changes happen through
-- the two database functions below, preventing simultaneous clicks being lost.

create or replace function public.change_counter(amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.counter
  set count = greatest(0, count + amount)
  where id = 1
  returning count into new_count;

  return new_count;
end;
$$;

create or replace function public.reset_counter()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.counter set count = 0 where id = 1;
  return 0;
end;
$$;

grant execute on function public.change_counter(integer) to anon, authenticated;
grant execute on function public.reset_counter() to anon, authenticated;

-- Allow live updates for this table.
do $$
begin
  alter publication supabase_realtime add table public.counter;
exception
  when duplicate_object then null;
end $$;
