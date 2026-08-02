-- Pet Cosmetics menu: persistent equipped name tag support.
-- Run once in Supabase SQL Editor, then this file can be deleted.

alter table public.characters
  add column if not exists equipped_pet_nametag text;

drop function if exists public.get_my_active_pet();
drop function if exists public.set_active_pet(text);

create or replace function public.get_my_active_pet()
returns table(active_pet text, pet_names jsonb, equipped_pet_cosmetic text, equipped_pet_nametag text)
language sql security definer set search_path=public as $$
  select c.active_pet,
         coalesce(c.pet_names,'{}'::jsonb),
         case when c.active_pet is not null then c.equipped_pet_cosmetic else null end,
         case when c.active_pet is not null then c.equipped_pet_nametag else null end
  from public.characters c
  where c.user_id=auth.uid()
  limit 1;
$$;

create or replace function public.set_pet_nametag(p_nametag text default null)
returns table(equipped_pet_nametag text)
language plpgsql security definer set search_path=public as $$
declare
  v_items jsonb;
  v_active_pet text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;

  select coalesce(c.bank_items,'{}'::jsonb),c.active_pet
    into v_items,v_active_pet
    from public.characters c
   where c.user_id=auth.uid()
   for update;

  if not found then raise exception 'Character not found'; end if;
  if p_nametag is not null and p_nametag not like 'nametag_%' then raise exception 'Unsupported name tag'; end if;
  if p_nametag is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_nametag is not null and coalesce((v_items->>p_nametag)::integer,0)<1 then
    raise exception 'You do not own that name tag';
  end if;

  update public.characters
     set equipped_pet_nametag=p_nametag
   where user_id=auth.uid();

  return query select p_nametag;
end;$$;

create or replace function public.set_active_pet(p_pet_id text default null)
returns table(active_pet text,pet_names jsonb,equipped_pet_cosmetic text,equipped_pet_nametag text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_names jsonb; v_cosmetic text; v_nametag text;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 select coalesce(c.bank_items,'{}'::jsonb),coalesce(c.pet_names,'{}'::jsonb),c.equipped_pet_cosmetic,c.equipped_pet_nametag
 into v_items,v_names,v_cosmetic,v_nametag from public.characters c where c.user_id=auth.uid() for update;
 if p_pet_id is not null then
   if not (p_pet_id like 'pet_%') then raise exception 'Invalid pet'; end if;
   if coalesce((v_items->>p_pet_id)::integer,0)<1 then raise exception 'That pet is not in your Bank'; end if;
 end if;
 update public.characters c set active_pet=p_pet_id where c.user_id=auth.uid();
 return query select p_pet_id,v_names,case when p_pet_id is null then null else v_cosmetic end,case when p_pet_id is null then null else v_nametag end;
end;$$;

revoke all on function public.get_my_active_pet() from public;
revoke all on function public.set_pet_nametag(text) from public;
revoke all on function public.set_active_pet(text) from public;
grant execute on function public.get_my_active_pet() to authenticated;
grant execute on function public.set_pet_nametag(text) to authenticated;
grant execute on function public.set_active_pet(text) to authenticated;
notify pgrst,'reload schema';
