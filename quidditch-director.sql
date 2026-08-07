-- Repo Company: Quidditch Director
-- Optional cloud persistence. The game still works with local browser saves if this is not installed.

create table if not exists public.quidditch_director_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.quidditch_director_profiles enable row level security;

revoke all on table public.quidditch_director_profiles from anon;
grant select, insert, update on table public.quidditch_director_profiles to authenticated;

drop policy if exists "qd_select_own" on public.quidditch_director_profiles;
create policy "qd_select_own"
on public.quidditch_director_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "qd_insert_own" on public.quidditch_director_profiles;
create policy "qd_insert_own"
on public.quidditch_director_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "qd_update_own" on public.quidditch_director_profiles;
create policy "qd_update_own"
on public.quidditch_director_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists quidditch_director_profiles_updated_idx
  on public.quidditch_director_profiles(updated_at desc);
