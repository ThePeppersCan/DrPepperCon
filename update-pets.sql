-- REPO COMPANY PET SHOP AND ACTIVE FOLLOWERS
-- Run after update-grand-exchange.sql and update-bank.sql.

alter table public.characters add column if not exists active_pet text;

insert into public.grand_exchange_items(item_id,name,description,price,image_url,sort_order) values
('pet_abyssal_orphan','Abyssal orphan','A cute follower from Abyssal Sire. Buy it, store it in your Bank, and let one pet wander around the site.',55000,'assets/pets/abyssal_orphan.png',1001),
('pet_baby_mole','Baby mole','A cute follower from Giant Mole. Buy it, store it in your Bank, and let one pet wander around the site.',30000,'assets/pets/baby_mole.png',1002),
('pet_baron','Baron','A cute follower from Duke Sucellus. Buy it, store it in your Bank, and let one pet wander around the site.',90000,'assets/pets/baron.png',1003),
('pet_bran','Bran','A cute follower from Royal Titans. Buy it, store it in your Bank, and let one pet wander around the site.',85000,'assets/pets/bran.png',1004),
('pet_beef','Beef','A cute follower from Brutus. Buy it, store it in your Bank, and let one pet wander around the site.',65000,'assets/pets/beef.png',1005),
('pet_butch','Butch','A cute follower from Vardorvis. Buy it, store it in your Bank, and let one pet wander around the site.',95000,'assets/pets/butch.png',1006),
('pet_callisto_cub','Callisto cub','A cute follower from Callisto and Artio. Buy it, store it in your Bank, and let one pet wander around the site.',70000,'assets/pets/callisto_cub.png',1007),
('pet_dom','Dom','A cute follower from Doom of Mokhaiotl. Buy it, store it in your Bank, and let one pet wander around the site.',90000,'assets/pets/dom.png',1008),
('pet_gull','Gull','A cute follower from Shellbane Gryphon. Buy it, store it in your Bank, and let one pet wander around the site.',60000,'assets/pets/gull.png',1009),
('pet_hellpuppy','Hellpuppy','A cute follower from Cerberus. Buy it, store it in your Bank, and let one pet wander around the site.',70000,'assets/pets/hellpuppy.png',1010),
('pet_huberte','Huberte','A cute follower from The Hueycoatl. Buy it, store it in your Bank, and let one pet wander around the site.',65000,'assets/pets/huberte.png',1011),
('pet_ikkle_hydra','Ikkle hydra','A cute follower from Alchemical Hydra. Buy it, store it in your Bank, and let one pet wander around the site.',85000,'assets/pets/ikkle_hydra.png',1012),
('pet_jal_nib_rek','Jal-nib-rek','A cute follower from Inferno. Buy it, store it in your Bank, and let one pet wander around the site.',250000,'assets/pets/jal_nib_rek.png',1013),
('pet_kalphite_princess','Kalphite princess','A cute follower from Kalphite Queen. Buy it, store it in your Bank, and let one pet wander around the site.',55000,'assets/pets/kalphite_princess.png',1014),
('pet_lil_zik','Lil'' zik','A cute follower from Theatre of Blood. Buy it, store it in your Bank, and let one pet wander around the site.',175000,'assets/pets/lil_zik.png',1015),
('pet_lilviathan','Lil''viathan','A cute follower from The Leviathan. Buy it, store it in your Bank, and let one pet wander around the site.',95000,'assets/pets/lilviathan.png',1016),
('pet_little_nightmare','Little nightmare','A cute follower from The Nightmare and Phosani''s Nightmare. Buy it, store it in your Bank, and let one pet wander around the site.',100000,'assets/pets/little_nightmare.png',1017),
('pet_maggot_marquess','Maggot marquess','A cute follower from Maggot King. Buy it, store it in your Bank, and let one pet wander around the site.',65000,'assets/pets/maggot_marquess.png',1018),
('pet_moxi','Moxi','A cute follower from Amoxliatl. Buy it, store it in your Bank, and let one pet wander around the site.',60000,'assets/pets/moxi.png',1019),
('pet_muphin','Muphin','A cute follower from Phantom Muspah. Buy it, store it in your Bank, and let one pet wander around the site.',75000,'assets/pets/muphin.png',1020),
('pet_nexling','Nexling','A cute follower from Nex. Buy it, store it in your Bank, and let one pet wander around the site.',160000,'assets/pets/nexling.png',1021),
('pet_nid','Nid','A cute follower from Araxxor. Buy it, store it in your Bank, and let one pet wander around the site.',85000,'assets/pets/nid.png',1022),
('pet_noon','Noon','A cute follower from Grotesque Guardians. Buy it, store it in your Bank, and let one pet wander around the site.',55000,'assets/pets/noon.png',1023),
('pet_olmlet','Olmlet','A cute follower from Chambers of Xeric. Buy it, store it in your Bank, and let one pet wander around the site.',150000,'assets/pets/olmlet.png',1024),
('pet_pet_chaos_elemental','Pet chaos elemental','A cute follower from Chaos Elemental and Chaos Fanatic. Buy it, store it in your Bank, and let one pet wander around the site.',40000,'assets/pets/pet_chaos_elemental.png',1025),
('pet_pet_dagannoth_prime','Pet dagannoth prime','A cute follower from Dagannoth Prime. Buy it, store it in your Bank, and let one pet wander around the site.',45000,'assets/pets/pet_dagannoth_prime.png',1026),
('pet_pet_dagannoth_rex','Pet dagannoth rex','A cute follower from Dagannoth Rex. Buy it, store it in your Bank, and let one pet wander around the site.',45000,'assets/pets/pet_dagannoth_rex.png',1027),
('pet_pet_dagannoth_supreme','Pet dagannoth supreme','A cute follower from Dagannoth Supreme. Buy it, store it in your Bank, and let one pet wander around the site.',45000,'assets/pets/pet_dagannoth_supreme.png',1028),
('pet_pet_dark_core','Pet dark core','A cute follower from Corporeal Beast. Buy it, store it in your Bank, and let one pet wander around the site.',100000,'assets/pets/pet_dark_core.png',1029),
('pet_pet_general_graardor','Pet general graardor','A cute follower from General Graardor. Buy it, store it in your Bank, and let one pet wander around the site.',80000,'assets/pets/pet_general_graardor.png',1030),
('pet_pet_kril_tsutsaroth','Pet k''ril tsutsaroth','A cute follower from K''ril Tsutsaroth. Buy it, store it in your Bank, and let one pet wander around the site.',80000,'assets/pets/pet_kril_tsutsaroth.png',1031),
('pet_pet_kraken','Pet kraken','A cute follower from Kraken. Buy it, store it in your Bank, and let one pet wander around the site.',45000,'assets/pets/pet_kraken.png',1032),
('pet_pet_kreearra','Pet kree''arra','A cute follower from Kree''arra. Buy it, store it in your Bank, and let one pet wander around the site.',80000,'assets/pets/pet_kreearra.png',1033),
('pet_pet_smoke_devil','Pet smoke devil','A cute follower from Thermonuclear smoke devil. Buy it, store it in your Bank, and let one pet wander around the site.',50000,'assets/pets/pet_smoke_devil.png',1034),
('pet_pet_snakeling','Pet snakeling','A cute follower from Zulrah. Buy it, store it in your Bank, and let one pet wander around the site.',65000,'assets/pets/pet_snakeling.png',1035),
('pet_pet_zilyana','Pet zilyana','A cute follower from Commander Zilyana. Buy it, store it in your Bank, and let one pet wander around the site.',80000,'assets/pets/pet_zilyana.png',1036),
('pet_phoenix','Phoenix','A cute follower from Wintertodt. Buy it, store it in your Bank, and let one pet wander around the site.',35000,'assets/pets/phoenix.png',1037),
('pet_prince_black_dragon','Prince black dragon','A cute follower from King Black Dragon. Buy it, store it in your Bank, and let one pet wander around the site.',55000,'assets/pets/prince_black_dragon.png',1038),
('pet_scorpias_offspring','Scorpia''s offspring','A cute follower from Scorpia. Buy it, store it in your Bank, and let one pet wander around the site.',40000,'assets/pets/scorpias_offspring.png',1039),
('pet_scurry','Scurry','A cute follower from Scurrius. Buy it, store it in your Bank, and let one pet wander around the site.',30000,'assets/pets/scurry.png',1040),
('pet_skotos','Skotos','A cute follower from Skotizo. Buy it, store it in your Bank, and let one pet wander around the site.',50000,'assets/pets/skotos.png',1041),
('pet_smolcano','Smolcano','A cute follower from Zalcano. Buy it, store it in your Bank, and let one pet wander around the site.',45000,'assets/pets/smolcano.png',1042),
('pet_smol_heredit','Smol heredit','A cute follower from Sol Heredit. Buy it, store it in your Bank, and let one pet wander around the site.',90000,'assets/pets/smol_heredit.png',1043),
('pet_saracha','Sraracha','A cute follower from Sarachnis. Buy it, store it in your Bank, and let one pet wander around the site.',40000,'assets/pets/saracha.png',1044),
('pet_tiny_tempor','Tiny tempor','A cute follower from Tempoross. Buy it, store it in your Bank, and let one pet wander around the site.',35000,'assets/pets/tiny_tempor.png',1045),
('pet_tumekens_guardian','Tumeken''s guardian','A cute follower from Tombs of Amascut. Buy it, store it in your Bank, and let one pet wander around the site.',150000,'assets/pets/tumekens_guardian.png',1046),
('pet_tzrek_jad','Tzrek-jad','A cute follower from TzHaar Fight Cave. Buy it, store it in your Bank, and let one pet wander around the site.',120000,'assets/pets/tzrek_jad.png',1047),
('pet_venenatis_spiderling','Venenatis spiderling','A cute follower from Venenatis and Spindel. Buy it, store it in your Bank, and let one pet wander around the site.',70000,'assets/pets/venenatis_spiderling.png',1048),
('pet_vetion_jr','Vet''ion jr.','A cute follower from Vet''ion and Calvar''ion. Buy it, store it in your Bank, and let one pet wander around the site.',70000,'assets/pets/vetion_jr.png',1049),
('pet_vorki','Vorki','A cute follower from Vorkath. Buy it, store it in your Bank, and let one pet wander around the site.',75000,'assets/pets/vorki.png',1050),
('pet_wisp','Wisp','A cute follower from The Whisperer. Buy it, store it in your Bank, and let one pet wander around the site.',95000,'assets/pets/wisp.png',1051),
('pet_yami','Yami','A cute follower from Yama. Buy it, store it in your Bank, and let one pet wander around the site.',100000,'assets/pets/yami.png',1052),
('pet_youngllef','Youngllef','A cute follower from The Gauntlet. Buy it, store it in your Bank, and let one pet wander around the site.',110000,'assets/pets/youngllef.png',1053)
on conflict (item_id) do update set name=excluded.name,description=excluded.description,price=greatest(excluded.price,30000),image_url=excluded.image_url,sort_order=excluded.sort_order,active=true;

create or replace function public.get_my_active_pet()
returns table(active_pet text) language sql security definer set search_path=public as $$
 select c.active_pet from public.characters c where c.user_id=auth.uid() limit 1;
$$;

create or replace function public.set_active_pet(p_pet_id text default null)
returns table(active_pet text) language plpgsql security definer set search_path=public as $$
declare v_items jsonb;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 select coalesce(c.bank_items,'{}'::jsonb) into v_items from public.characters c where c.user_id=auth.uid() for update;
 if p_pet_id is not null then
   if not (p_pet_id like 'pet_%') then raise exception 'Invalid pet'; end if;
   if coalesce((v_items->>p_pet_id)::integer,0)<1 then raise exception 'That pet is not in your Bank'; end if;
 end if;
 update public.characters c set active_pet=p_pet_id where c.user_id=auth.uid();
 return query select p_pet_id;
end;$$;

create or replace function public.get_active_pets()
returns table(username text,active_pet text) language sql security definer set search_path=public as $$
 select c.username,c.active_pet from public.characters c where c.active_pet is not null and c.active_pet like 'pet_%' order by c.username limit 50;
$$;

grant execute on function public.get_my_active_pet() to authenticated;
grant execute on function public.set_active_pet(text) to authenticated;
grant execute on function public.get_active_pets() to anon,authenticated;
notify pgrst,'reload schema';


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
