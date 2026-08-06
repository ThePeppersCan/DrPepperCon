-- Repo Company: Abyssal protector Grand Exchange pet
-- Price: 20,000 GP
-- Safe to run more than once.

create or replace function public.buy_abyssal_protector()
returns table(new_gp integer, bank_items jsonb)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_gp integer;
  v_items jsonb;
  v_pet_id constant text := 'pet_abyssal_protector';
  v_price constant integer := 20000;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb)
    into v_gp,v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then
    raise exception 'Character not found.';
  end if;

  if greatest(0,coalesce((v_items->>v_pet_id)::integer,0)) >= 1 then
    raise exception 'You already own the Abyssal protector.';
  end if;

  if v_gp < v_price then
    raise exception 'You need 20,000 GP to buy the Abyssal protector.';
  end if;

  v_gp := v_gp - v_price;
  v_items := jsonb_set(v_items,array[v_pet_id],'1'::jsonb,true);

  update public.characters c
     set gp=v_gp,
         bank_items=v_items
   where c.user_id=auth.uid();

  return query select v_gp,v_items;
end;
$$;

grant execute on function public.buy_abyssal_protector() to authenticated;
notify pgrst,'reload schema';
