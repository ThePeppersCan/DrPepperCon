-- Repo Company: keep Quidditch career leaderboard names in sync with pet renames.
create table if not exists public.quidditch_pet_name_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  pet_id text not null,
  previous_name text,
  pet_name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, pet_id)
);

alter table public.quidditch_pet_name_overrides enable row level security;

drop policy if exists "Public can read Quidditch pet names" on public.quidditch_pet_name_overrides;
create policy "Public can read Quidditch pet names"
on public.quidditch_pet_name_overrides for select
using (true);

drop policy if exists "Players can insert own Quidditch pet names" on public.quidditch_pet_name_overrides;
create policy "Players can insert own Quidditch pet names"
on public.quidditch_pet_name_overrides for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Players can update own Quidditch pet names" on public.quidditch_pet_name_overrides;
create policy "Players can update own Quidditch pet names"
on public.quidditch_pet_name_overrides for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.quidditch_pet_name_overrides to anon, authenticated;
grant insert, update on public.quidditch_pet_name_overrides to authenticated;
