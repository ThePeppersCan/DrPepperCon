-- REPO COMPANY ACHIEVEMENT LOG + COOKING CHEF'S HAT REWARD
-- Run this once in Supabase SQL Editor after uploading the updated website.
-- It safely preserves all existing accounts, XP, GP, pets and bank items.

alter table public.characters
  add column if not exists achievements jsonb not null default '{}'::jsonb,
  add column if not exists cooking_xp integer not null default 0,
  add column if not exists bank_items jsonb not null default '{}'::jsonb;

create or replace function public.get_my_achievements()
returns table(achievements jsonb)
language sql
security definer
set search_path = public
as $$
  select coalesce(c.achievements, '{}'::jsonb)
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

drop function if exists public.complete_cooking_shift(integer, integer, integer);

create function public.complete_cooking_shift(
  p_score integer,
  p_orders integer,
  p_xp integer
)
returns table(
  cooking_xp integer,
  cooking_gained integer,
  achievements jsonb,
  achievement_unlocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gain integer := least(2500, greatest(0, coalesce(p_xp, 0)));
  v_unlocked boolean := false;
  v_had_achievement boolean := false;
begin
  if v_uid is null then
    raise exception 'You must be signed in to receive Cooking XP';
  end if;

  select coalesce(c.achievements, '{}'::jsonb) ? 'cooking_serve_5'
    into v_had_achievement
    from public.characters c
   where c.user_id = v_uid
   for update;

  if not found then
    raise exception 'No character was found for the signed-in account';
  end if;

  v_unlocked := coalesce(p_orders,0) >= 5 and not v_had_achievement;

  update public.characters c
     set cooking_xp = least(13034431, greatest(0, coalesce(c.cooking_xp, 0)) + v_gain),
         achievements = case
           when v_unlocked
             then jsonb_set(coalesce(c.achievements, '{}'::jsonb), '{cooking_serve_5}', 'true'::jsonb, true)
           else coalesce(c.achievements, '{}'::jsonb)
         end,
         bank_items = case
           when v_unlocked
             then jsonb_set(coalesce(c.bank_items, '{}'::jsonb), '{chefs_hat}', '1'::jsonb, true)
           else coalesce(c.bank_items, '{}'::jsonb)
         end
   where c.user_id = v_uid;

  if not found then
    raise exception 'No character was found for the signed-in account';
  end if;

  return query
  select c.cooking_xp, v_gain, coalesce(c.achievements,'{}'::jsonb), v_unlocked
  from public.characters c
  where c.user_id = v_uid
  limit 1;
end;
$$;

revoke all on function public.get_my_achievements() from public;
revoke all on function public.complete_cooking_shift(integer, integer, integer) from public;
grant execute on function public.get_my_achievements() to authenticated;
grant execute on function public.complete_cooking_shift(integer, integer, integer) to authenticated;
notify pgrst, 'reload schema';
