-- REPO COMPANY: HARMONY LEVEL 99 PET SKILLCAPE
-- Safe to run in full. Does not reset Harmony XP, character XP, GP, pets or bank items.

alter table public.characters
  add column if not exists bank_items jsonb not null default '{}'::jsonb,
  add column if not exists equipped_pet_cosmetic text;

-- Give the shared reward to every existing account once the clan has reached 99.
update public.characters c
set bank_items = jsonb_set(coalesce(c.bank_items, '{}'::jsonb), '{harmony_skillcape}', '1'::jsonb, true)
where coalesce((select count from public.counter where id = 1), 0) >= 13034431
  and coalesce((c.bank_items->>'harmony_skillcape')::integer, 0) < 1;

-- Keep the existing Harmony click behaviour and grant the cape to all accounts
-- on the exact click that reaches level 99.
drop function if exists public.change_counter(integer);
create function public.change_counter(amount integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
begin
  if amount <> 1 then raise exception 'Harmony can only be trained one XP at a time'; end if;

  update public.counter
     set count = coalesce(count, 0) + 1
   where id = 1
   returning count into new_count;

  if new_count is null then
    insert into public.counter(id, count) values (1, 1)
    on conflict (id) do update set count = public.counter.count + 1
    returning count into new_count;
  end if;

  if auth.uid() is not null and to_regclass('public.daily_xp_totals') is not null then
    insert into public.daily_xp_totals(user_id, xp_date, xp_earned, updated_at)
    values (auth.uid(), (timezone('Europe/London', now()))::date, 1, now())
    on conflict (user_id, xp_date) do update
      set xp_earned = public.daily_xp_totals.xp_earned + 1, updated_at = now();
  end if;

  if new_count >= 13034431 then
    update public.characters c
       set bank_items = jsonb_set(coalesce(c.bank_items, '{}'::jsonb), '{harmony_skillcape}', '1'::jsonb, true)
     where coalesce((c.bank_items->>'harmony_skillcape')::integer, 0) < 1;
  end if;

  return new_count;
end;
$$;

grant execute on function public.change_counter(integer) to anon, authenticated;

-- New accounts also receive the cape automatically after the shared skill is 99.
create or replace function public.get_my_bank()
returns table(gp integer, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_harmony_xp bigint := coalesce((select count from public.counter where id = 1), 0);
begin
  if v_harmony_xp >= 13034431 then
    update public.characters c
       set bank_items = jsonb_set(coalesce(c.bank_items, '{}'::jsonb), '{harmony_skillcape}', '1'::jsonb, true)
     where c.user_id = auth.uid()
       and coalesce((c.bank_items->>'harmony_skillcape')::integer, 0) < 1;
  end if;

  return query
  select coalesce(c.gp, 0)::integer, coalesce(c.bank_items, '{}'::jsonb)
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
end;
$$;

grant execute on function public.get_my_bank() to authenticated;

-- Extend the existing pet cosmetic function without changing any other rewards.
create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_pet text;
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_cosmetic is not null and p_cosmetic not in (
    'chefs_hat','fire_cape','odd_spectacles','infernal_cape','infernal_max_cape',
    'bucket_helm','golden_bucket_helm','harmony_skillcape'
  ) then raise exception 'Unsupported pet cosmetic'; end if;

  select c.active_pet, coalesce(c.bank_items, '{}'::jsonb)
    into v_active_pet, v_items
  from public.characters c
  where c.user_id = auth.uid()
  for update;

  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_cosmetic is not null and coalesce((v_items->>p_cosmetic)::integer, 0) < 1 then
    raise exception 'That reward is not in your Bank';
  end if;

  update public.characters c
     set equipped_pet_cosmetic = p_cosmetic
   where c.user_id = auth.uid();

  return query select p_cosmetic;
end;
$$;

grant execute on function public.set_pet_cosmetic(text) to authenticated;
notify pgrst, 'reload schema';
