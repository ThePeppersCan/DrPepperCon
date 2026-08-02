-- Makes every player's equipped pet name tag available to the shared homepage pet rooms.
-- Run once in Supabase SQL Editor. This keeps the existing active-pet behaviour unchanged.

alter table public.characters
  add column if not exists equipped_pet_nametag text;

drop function if exists public.get_active_pets();
create or replace function public.get_active_pets()
returns table(
  username text,
  active_pet text,
  pet_name text,
  equipped_pet_cosmetic text,
  equipped_pet_nametag text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    c.username,
    c.active_pet,
    coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) as pet_name,
    c.equipped_pet_cosmetic,
    c.equipped_pet_nametag
  from public.characters c
  where c.active_pet is not null
    and c.active_pet like 'pet_%'
  order by lower(c.username);
$$;

revoke all on function public.get_active_pets() from public;
grant execute on function public.get_active_pets() to anon, authenticated;
notify pgrst,'reload schema';
