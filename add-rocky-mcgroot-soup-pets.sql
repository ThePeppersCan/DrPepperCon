-- Add Rocky, Mr McGroot and Soup to the Grand Exchange.
-- Run this once in Supabase SQL Editor if update-grand-exchange.sql was already run previously.

insert into public.grand_exchange_items(item_id,name,description,price,image_url,sort_order,active)
values
  ('pet_rocky_badger','Rocky','A sturdy badger pet named Rocky.',20000,'assets/pets/rocky_badger.png',210,true),
  ('pet_mr_mcgroot','Mr McGroot','A determined goat pet named Mr McGroot.',40000,'assets/pets/mr_mcgroot.png',220,true),
  ('pet_soup_turtle','Soup','A laid-back turtle pet named Soup.',50000,'assets/pets/soup_turtle.png',230,true)
on conflict (item_id) do update set
  name=excluded.name,
  description=excluded.description,
  price=excluded.price,
  image_url=excluded.image_url,
  sort_order=excluded.sort_order,
  active=true;

notify pgrst,'reload schema';
