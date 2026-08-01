-- GRACE'S GRACEFUL CLOTHING + MARKS OF GRACE
-- Run once in Supabase SQL Editor. Existing accounts, XP, GP and bank items are preserved.

alter table public.characters
  add column if not exists bank_items jsonb not null default '{}'::jsonb;

create or replace function public.buy_graceful_item(p_item text)
returns table(
  purchased_item text,
  marks_remaining integer,
  bank_items jsonb,
  skipper_unlocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_items jsonb;
  v_marks integer;
  v_all_owned boolean;
  v_skipper_was_owned boolean;
begin
  v_cost := case p_item
    when 'graceful_hood' then 35
    when 'graceful_top' then 55
    when 'graceful_legs' then 60
    when 'graceful_gloves' then 30
    when 'graceful_boots' then 40
    when 'graceful_cape' then 40
    else null
  end;

  if v_cost is null then
    raise exception 'That item is not sold by Grace.';
  end if;

  select coalesce(c.bank_items, '{}'::jsonb)
    into v_items
  from public.characters c
  where c.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Character not found.';
  end if;

  if coalesce((v_items ->> p_item)::integer, 0) > 0 then
    raise exception 'You already own that Graceful item.';
  end if;

  v_marks := coalesce((v_items ->> 'marks_of_grace')::integer, 0);
  if v_marks < v_cost then
    raise exception 'You need % Marks of Grace for that item. You currently have %.', v_cost, v_marks;
  end if;

  v_skipper_was_owned := coalesce((v_items ->> 'pet_skipper')::integer, 0) > 0;
  v_items := jsonb_set(v_items, array['marks_of_grace'], to_jsonb(v_marks - v_cost), true);
  v_items := jsonb_set(v_items, array[p_item], '1'::jsonb, true);

  v_all_owned :=
    coalesce((v_items ->> 'graceful_hood')::integer, 0) > 0 and
    coalesce((v_items ->> 'graceful_top')::integer, 0) > 0 and
    coalesce((v_items ->> 'graceful_legs')::integer, 0) > 0 and
    coalesce((v_items ->> 'graceful_gloves')::integer, 0) > 0 and
    coalesce((v_items ->> 'graceful_boots')::integer, 0) > 0 and
    coalesce((v_items ->> 'graceful_cape')::integer, 0) > 0;

  if v_all_owned and not v_skipper_was_owned then
    v_items := jsonb_set(v_items, array['pet_skipper'], '1'::jsonb, true);
  end if;

  update public.characters c
  set bank_items = v_items
  where c.user_id = auth.uid();

  return query select
    p_item,
    (v_marks - v_cost)::integer,
    v_items,
    (v_all_owned and not v_skipper_was_owned);
end;
$$;

grant execute on function public.buy_graceful_item(text) to authenticated;

-- Rooftop Rumble should award Marks by increasing this stack in bank_items:
-- bank_items = jsonb_set(
--   coalesce(bank_items, '{}'::jsonb),
--   '{marks_of_grace}',
--   to_jsonb(coalesce((bank_items ->> 'marks_of_grace')::integer, 0) + MARKS_EARNED),
--   true
-- )

notify pgrst, 'reload schema';
