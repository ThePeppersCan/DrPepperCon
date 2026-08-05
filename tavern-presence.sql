-- Dedicated signed-in tavern presence.
-- This is completely separate from Quidditch viewer tracking.
create table if not exists public.tavern_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  identity_key text not null,
  last_seen timestamptz not null default now()
);

alter table public.tavern_presence enable row level security;

drop policy if exists "Signed-in users can read tavern presence" on public.tavern_presence;
create policy "Signed-in users can read tavern presence"
on public.tavern_presence for select
to authenticated
using (true);

drop policy if exists "Users can insert own tavern presence" on public.tavern_presence;
create policy "Users can insert own tavern presence"
on public.tavern_presence for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own tavern presence" on public.tavern_presence;
create policy "Users can update own tavern presence"
on public.tavern_presence for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.tavern_presence to authenticated;
