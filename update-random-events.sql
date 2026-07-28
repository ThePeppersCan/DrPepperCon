-- CON OF DR PEPPER: COLLECTION LOG ODDS UPDATE
-- Run this once in Supabase -> SQL Editor.
-- This preserves all accounts, XP, collections and the can counter.

create or replace function public.collect_resource(p_skill text)
returns table(new_xp integer, xp_gained integer, drop_name text)
language plpgsql security definer set search_path = public as $$
declare
  gain integer;
  updated_xp integer;
  drop_id text := null;
  drop_label text := null;
  roll double precision := random();
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;

  gain := case p_skill when 'woodcutting' then 25 when 'mining' then 35 when 'fishing' then 40 else null end;
  if gain is null then raise exception 'Invalid skill'; end if;

  if p_skill = 'woodcutting' then
    update public.characters set woodcutting_xp = woodcutting_xp + gain where user_id = auth.uid() returning woodcutting_xp into updated_xp;
  elsif p_skill = 'mining' then
    update public.characters set mining_xp = mining_xp + gain where user_id = auth.uid() returning mining_xp into updated_xp;
  else
    update public.characters set fishing_xp = fishing_xp + gain where user_id = auth.uid() returning fishing_xp into updated_xp;
  end if;

  if updated_xp is null then raise exception 'Character not found'; end if;

  -- Overall collection-log chance: 4% (about 1 in 25 successful events).
  if roll < 0.04 then
    if roll < 0.002 then drop_id := 'golden_dr_pepper'; drop_label := 'Golden Dr Pepper';
    elsif roll < 0.007 then drop_id := 'reinforced_chair'; drop_label := 'Reinforced Chair';
    elsif roll < 0.015 then drop_id := 'membership_card'; drop_label := 'Membership Card';
    elsif roll < 0.025 then drop_id := 'chair_fragment'; drop_label := 'Chair Fragment';
    else drop_id := 'mini_dr_pepper'; drop_label := 'Mini Dr Pepper'; end if;

    update public.characters
    set collection = case when drop_id = any(collection) then collection else array_append(collection, drop_id) end
    where user_id = auth.uid();
  end if;

  return query select updated_xp, gain, drop_label;
end; $$;

grant execute on function public.collect_resource(text) to authenticated;
