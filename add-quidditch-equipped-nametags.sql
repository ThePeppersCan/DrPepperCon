-- Adds each player's equipped pet name tag to the shared Quidditch roster.
-- Run once in Supabase after add-pet-cosmetics-menu.sql.

create or replace function public.quidditch_roster_for_match(p_match_id bigint)
returns jsonb language sql stable security definer set search_path=public as $$
  with ranked as (
    select c.username,c.active_pet,
      coalesce(nullif(c.pet_names->>c.active_pet,''),c.active_pet) pet_name,
      c.equipped_pet_cosmetic,
      c.equipped_pet_nametag,
      row_number() over(order by md5(p_match_id::text||':'||c.username)) rn
    from public.characters c
    where c.active_pet is not null and c.active_pet like 'pet_%'
    limit 30
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'username',username,
    'active_pet',active_pet,
    'pet_name',pet_name,
    'equipped_pet_cosmetic',equipped_pet_cosmetic,
    'equipped_pet_nametag',equipped_pet_nametag,
    'side',case when rn%2=1 then 'left' else 'right' end,
    'slot',ceil(rn/2.0)::integer
  ) order by rn),'[]'::jsonb) from ranked;
$$;

grant execute on function public.quidditch_roster_for_match(bigint) to anon,authenticated;
notify pgrst,'reload schema';
