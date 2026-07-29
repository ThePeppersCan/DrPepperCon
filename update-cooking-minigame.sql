-- Run once in the Supabase SQL Editor.
-- Safely installs/reinstalls Cooking XP rewards for solo and online shifts.
alter table public.characters
  add column if not exists cooking_xp integer not null default 0;

drop function if exists public.complete_cooking_shift(integer, integer, integer);

create function public.complete_cooking_shift(
  p_score integer,
  p_orders integer,
  p_xp integer
)
returns table(cooking_xp integer, cooking_gained integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gain integer := least(2500, greatest(0, coalesce(p_xp, 0)));
begin
  if v_uid is null then
    raise exception 'You must be signed in to receive Cooking XP';
  end if;

  update public.characters c
     set cooking_xp = least(13034431, greatest(0, coalesce(c.cooking_xp, 0)) + v_gain)
   where c.user_id = v_uid;

  if not found then
    raise exception 'No character was found for the signed-in account';
  end if;

  return query
  select c.cooking_xp, v_gain
    from public.characters c
   where c.user_id = v_uid
   limit 1;
end;
$$;

revoke all on function public.complete_cooking_shift(integer, integer, integer) from public;
grant execute on function public.complete_cooking_shift(integer, integer, integer) to authenticated;
