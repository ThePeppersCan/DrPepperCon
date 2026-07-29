-- Add Messy-ron to the Grand Exchange pet shop. Run once in Supabase SQL Editor.
insert into public.grand_exchange_items
(item_id,name,description,price,image_url,sort_order,active)
values
('pet_messy_ron','Messy-ron','Myron in another life',50000,'assets/pets/messy_ron.png',1054,true)
on conflict (item_id) do update set
  name=excluded.name,
  description=excluded.description,
  price=excluded.price,
  image_url=excluded.image_url,
  sort_order=excluded.sort_order,
  active=true;

notify pgrst,'reload schema';
