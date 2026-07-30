-- EQUIPPABLE CHEF'S HAT FOR ACTIVE PETS
-- Run once in Supabase SQL Editor after update-achievements.sql.
-- The Chef's hat stays in bank_items while this column only records whether it is equipped.

alter table public.characters
  add column if not exists equipped_pet_cosmetic text;

-- PostgreSQL cannot use CREATE OR REPLACE when a function's OUT columns / return row type changed.
-- These drops remove only the RPC functions, not any player, pet, bank, XP or achievement data.
drop function if exists public.get_my_active_pet();
drop function if exists public.set_active_pet(text);
drop function if exists public.get_active_pets();

create or replace function public.get_my_active_pet()
returns table(active_pet text, pet_names jsonb, equipped_pet_cosmetic text)
language sql security definer set search_path=public as $$
  select c.active_pet,
         coalesce(c.pet_names,'{}'::jsonb),
         case when c.active_pet is not null then c.equipped_pet_cosmetic else null end
  from public.characters c
  where c.user_id=auth.uid()
  limit 1;
$$;

create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare
  v_items jsonb;
  v_active_pet text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_cosmetic is not null and p_cosmetic <> 'chefs_hat' then raise exception 'Unsupported pet cosmetic'; end if;

  select coalesce(c.bank_items,'{}'::jsonb),c.active_pet
    into v_items,v_active_pet
    from public.characters c
   where c.user_id=auth.uid()
   for update;

  if not found then raise exception 'Character not found'; end if;
  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_cosmetic='chefs_hat' and coalesce((v_items->>'chefs_hat')::integer,0)<1 then
    raise exception 'The Chef''s hat is not in your Bank';
  end if;

  update public.characters c
     set equipped_pet_cosmetic=p_cosmetic
   where c.user_id=auth.uid();

  return query select p_cosmetic;
end;$$;

create or replace function public.set_active_pet(p_pet_id text default null)
returns table(active_pet text,pet_names jsonb,equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_names jsonb; v_cosmetic text;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 select coalesce(c.bank_items,'{}'::jsonb),coalesce(c.pet_names,'{}'::jsonb),c.equipped_pet_cosmetic
 into v_items,v_names,v_cosmetic from public.characters c where c.user_id=auth.uid() for update;
 if p_pet_id is not null then
   if not (p_pet_id like 'pet_%') then raise exception 'Invalid pet'; end if;
   if coalesce((v_items->>p_pet_id)::integer,0)<1 then raise exception 'That pet is not in your Bank'; end if;
 end if;
 update public.characters c set active_pet=p_pet_id where c.user_id=auth.uid();
 return query select p_pet_id,v_names,case when p_pet_id is null then null else v_cosmetic end;
end;$$;

create or replace function public.get_active_pets()
returns table(username text,active_pet text,pet_name text,equipped_pet_cosmetic text)
language sql security definer set search_path=public as $$
 select c.username,c.active_pet,nullif(c.pet_names->>c.active_pet,''),c.equipped_pet_cosmetic
 from public.characters c
 where c.active_pet is not null and c.active_pet like 'pet_%'
 order by c.username limit 50;
$$;

-- Include cosmetics for live Shooting Star pets.
drop function if exists public.get_active_star_miners();
create function public.get_active_star_miners()
returns table(username text,active_pet text,pet_name text,equipped_pet_cosmetic text)
language sql security definer set search_path=public as $$
  select c.username::text,c.active_pet::text,coalesce(c.pet_names->>c.active_pet::text,'')::text,c.equipped_pet_cosmetic::text
  from public.characters c
  where c.mining_afk_active=true
    and c.active_pet is not null
    and c.mining_cycle_start_at is not null
    and c.mining_cycle_start_at > now()-interval '7 minutes'
  order by c.username
  limit 20;
$$;

-- Include both players' equipped cosmetics in Pet Wars without consuming the bank item.
drop function if exists public.get_pet_war(text);
create function public.get_pet_war(p_room_code text)
returns table(
 room_code text,status text,location text,started_at timestamptz,host_username text,guest_username text,
 host_pet text,guest_pet text,host_pet_name text,guest_pet_name text,host_wager integer,guest_wager integer,
 host_pick smallint,guest_pick smallint,winner_slot smallint,host_payout integer,guest_payout integer,
 host_pet_cosmetic text,guest_pet_cosmetic text
)
language sql security definer set search_path=public as $$
 select w.room_code,w.status,w.location,w.started_at,w.host_username,w.guest_username,w.host_pet,w.guest_pet,
   w.host_pet_name,w.guest_pet_name,w.host_wager,w.guest_wager,w.host_pick,w.guest_pick,w.winner_slot,w.host_payout,w.guest_payout,
   hc.equipped_pet_cosmetic,gc.equipped_pet_cosmetic
 from public.pet_wars w
 left join public.characters hc on hc.user_id=w.host_user_id
 left join public.characters gc on gc.user_id=w.guest_user_id
 where w.room_code=upper(trim(p_room_code)) and auth.uid() in (w.host_user_id,w.guest_user_id)
 limit 1;
$$;

revoke all on function public.get_my_active_pet() from public;
revoke all on function public.set_pet_cosmetic(text) from public;
revoke all on function public.set_active_pet(text) from public;
revoke all on function public.get_active_pets() from public;
revoke all on function public.get_active_star_miners() from public;
revoke all on function public.get_pet_war(text) from public;
grant execute on function public.get_my_active_pet() to authenticated;
grant execute on function public.set_pet_cosmetic(text) to authenticated;
grant execute on function public.set_active_pet(text) to authenticated;
grant execute on function public.get_active_pets() to anon,authenticated;
grant execute on function public.get_active_star_miners() to authenticated;
grant execute on function public.get_pet_war(text) to authenticated;
notify pgrst,'reload schema';
