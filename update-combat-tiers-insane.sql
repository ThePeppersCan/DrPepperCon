-- Repo Company: longer Combat tiers + INSANE difficulty
-- Run this once in the Supabase SQL Editor after uploading the updated site.

drop function if exists public.complete_combat_run(boolean,integer,integer,integer,text);
create function public.complete_combat_run(
  p_survived boolean,
  p_kills integer,
  p_damage integer,
  p_seconds integer,
  p_difficulty text default 'medium'
)
returns table(
  attack_xp integer,
  strength_xp integer,
  defence_xp integer,
  attack_gained integer,
  strength_gained integer,
  defence_gained integer
)
language plpgsql security definer set search_path=public as $$
declare
  expected_seconds integer := case p_difficulty when 'easy' then 60 when 'medium' then 120 when 'hard' then 180 when 'insane' then 240 else 120 end;
  mult numeric := case p_difficulty when 'easy' then .75 when 'medium' then 1.10 when 'hard' then 1.55 when 'insane' then 2.35 else 1.10 end;
  completion numeric;
  a integer;
  s integer;
  d integer;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if p_difficulty not in ('easy','medium','hard','insane') then raise exception 'Invalid difficulty'; end if;
  if p_kills < 0 or p_kills > 2500 or p_damage < 0 or p_damage > 750000 or p_seconds < 1 or p_seconds > expected_seconds then
    raise exception 'Invalid combat run';
  end if;
  if p_survived and p_seconds < expected_seconds - 4 then raise exception 'Run ended too quickly'; end if;

  completion := least(1.0, greatest(0.05, p_seconds::numeric / expected_seconds));
  a := greatest(1, floor((18 + least(p_kills,1200)*2.4 + case when p_survived then 75 else 0 end) * mult * completion));
  s := greatest(1, floor((18 + least(p_damage,500000)/14.0 + case when p_survived then 90 else 0 end) * mult * completion));
  d := greatest(1, floor((12 + p_seconds*1.45 + case when p_survived then 110 else 0 end) * mult));

  update public.characters
  set attack_xp=characters.attack_xp+a,
      strength_xp=characters.strength_xp+s,
      defence_xp=characters.defence_xp+d
  where user_id=auth.uid()
  returning characters.attack_xp,characters.strength_xp,characters.defence_xp
  into attack_xp,strength_xp,defence_xp;

  if attack_xp is null then raise exception 'Character not found'; end if;
  attack_gained:=a; strength_gained:=s; defence_gained:=d;
  return next;
end$$;

grant execute on function public.complete_combat_run(boolean,integer,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
