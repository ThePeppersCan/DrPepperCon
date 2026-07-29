

-- PET NAMES + FREE STARTER CAT
alter table public.characters add column if not exists pet_names jsonb not null default '{}'::jsonb;
alter table public.characters alter column bank_items set default '{"pet_free_cat":1}'::jsonb;
update public.characters
set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{pet_free_cat}','1'::jsonb,true)
where coalesce((bank_items->>'pet_free_cat')::integer,0)<1;

create or replace function public.get_my_active_pet()
returns table(active_pet text,pet_names jsonb) language sql security definer set search_path=public as $$
 select c.active_pet,coalesce(c.pet_names,'{}'::jsonb) from public.characters c where c.user_id=auth.uid() limit 1;
$$;

create or replace function public.set_active_pet(p_pet_id text default null)
returns table(active_pet text,pet_names jsonb) language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_names jsonb;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 select coalesce(c.bank_items,'{}'::jsonb),coalesce(c.pet_names,'{}'::jsonb) into v_items,v_names from public.characters c where c.user_id=auth.uid() for update;
 if p_pet_id is not null then
   if not (p_pet_id like 'pet_%') then raise exception 'Invalid pet'; end if;
   if coalesce((v_items->>p_pet_id)::integer,0)<1 then raise exception 'That pet is not in your Bank'; end if;
 end if;
 update public.characters c set active_pet=p_pet_id where c.user_id=auth.uid();
 return query select p_pet_id,v_names;
end;$$;

create or replace function public.set_pet_name(p_pet_id text,p_pet_name text)
returns table(pet_names jsonb) language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_names jsonb; v_name text;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 v_name=trim(coalesce(p_pet_name,''));
 if char_length(v_name)<1 or char_length(v_name)>20 then raise exception 'Pet names must be 1 to 20 characters'; end if;
 if v_name ~ '[[:cntrl:]<>]' then raise exception 'That pet name contains unsupported characters'; end if;
 select coalesce(c.bank_items,'{}'::jsonb),coalesce(c.pet_names,'{}'::jsonb) into v_items,v_names from public.characters c where c.user_id=auth.uid() for update;
 if coalesce((v_items->>p_pet_id)::integer,0)<1 then raise exception 'That pet is not in your Bank'; end if;
 v_names=jsonb_set(v_names,array[p_pet_id],to_jsonb(v_name),true);
 update public.characters c set pet_names=v_names where c.user_id=auth.uid();
 return query select v_names;
end;$$;

create or replace function public.get_active_pets()
returns table(username text,active_pet text,pet_name text) language sql security definer set search_path=public as $$
 select c.username,c.active_pet,nullif(c.pet_names->>c.active_pet,'') from public.characters c where c.active_pet is not null and c.active_pet like 'pet_%' order by c.username limit 50;
$$;

grant execute on function public.get_my_active_pet() to authenticated;
grant execute on function public.set_active_pet(text) to authenticated;
grant execute on function public.set_pet_name(text,text) to authenticated;
grant execute on function public.get_active_pets() to anon,authenticated;
notify pgrst,'reload schema';
