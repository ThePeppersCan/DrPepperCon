-- Remove Messy-ron using this website's actual pet storage schema.
-- Safe to run more than once.

update public.characters
set
  active_pet = case when active_pet = 'pet_messy_ron' then null else active_pet end,
  bank_items = coalesce(bank_items, '{}'::jsonb) - 'pet_messy_ron',
  pet_names = coalesce(pet_names, '{}'::jsonb) - 'pet_messy_ron'
where active_pet = 'pet_messy_ron'
   or coalesce(bank_items, '{}'::jsonb) ? 'pet_messy_ron'
   or coalesce(pet_names, '{}'::jsonb) ? 'pet_messy_ron';

delete from public.grand_exchange_items
where item_id = 'pet_messy_ron';

notify pgrst, 'reload schema';
