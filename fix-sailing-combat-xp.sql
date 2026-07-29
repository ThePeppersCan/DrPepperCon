-- FIX: Sailing and Combat minigame XP rewards
-- Run this whole file once in Supabase SQL Editor.

alter table public.characters add column if not exists sailing_xp integer not null default 0 check (sailing_xp >= 0);
alter table public.characters add column if not exists attack_xp integer not null default 0 check (attack_xp >= 0);
alter table public.characters add column if not exists strength_xp integer not null default 0 check (strength_xp >= 0);
alter table public.characters add column if not exists defence_xp integer not null default 0 check (defence_xp >= 0);

-- Remove all older overloads that can confuse PostgREST.
drop function if exists public.complete_sailing_run(boolean, integer, integer, integer);
drop function if exists public.complete_combat_run(boolean, integer, integer, integer);
drop function if exists public.complete_combat_run(boolean, integer, integer, integer, text);

create function public.complete_sailing_run(
  p_survived boolean,
  p_score integer,
  p_gates integer,
  p_seconds integer
)
returns table(sailing_xp integer, sailing_gained integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  gain integer;
  new_xp integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if coalesce(p_score,0) < 0 or coalesce(p_score,0) > 500000 then raise exception 'Invalid sailing score'; end if;
  if coalesce(p_gates,0) < 0 or coalesce(p_gates,0) > 500 then raise exception 'Invalid gate count'; end if;
  if coalesce(p_seconds,0) < 1 or coalesce(p_seconds,0) > 60 then raise exception 'Invalid sailing duration'; end if;
  if p_survived and p_seconds < 57 then raise exception 'Run ended too quickly'; end if;

  gain := greatest(5, least(900,
    10
    + floor(coalesce(p_score,0) / 55.0)::integer
    + coalesce(p_gates,0) * 5
    + case when p_survived then 120 else 0 end
  ));

  update public.characters c
  set sailing_xp = c.sailing_xp + gain
  where c.user_id = auth.uid()
  returning c.sailing_xp into new_xp;

  if new_xp is null then raise exception 'Character not found'; end if;
  return query select new_xp, gain;
end;
$$;

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
language plpgsql
security definer
set search_path = public
as $$
declare
  difficulty text := lower(coalesce(p_difficulty, 'medium'));
  mult numeric;
  max_seconds integer;
  a_gain integer;
  s_gain integer;
  d_gain integer;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if difficulty not in ('easy','medium','hard','insane') then difficulty := 'medium'; end if;

  mult := case difficulty
    when 'easy' then 0.85
    when 'hard' then 1.45
    when 'insane' then 2.10
    else 1.10
  end;
  max_seconds := case difficulty when 'easy' then 60 when 'medium' then 120 when 'hard' then 180 else 240 end;

  if coalesce(p_kills,0) < 0 or coalesce(p_kills,0) > 2000 then raise exception 'Invalid kill count'; end if;
  if coalesce(p_damage,0) < 0 or coalesce(p_damage,0) > 1000000 then raise exception 'Invalid damage'; end if;
  if coalesce(p_seconds,0) < 1 or coalesce(p_seconds,0) > max_seconds then raise exception 'Invalid combat duration'; end if;

  a_gain := greatest(5, floor((coalesce(p_kills,0) * 4 + case when p_survived then 90 else 15 end) * mult));
  s_gain := greatest(5, floor((coalesce(p_damage,0) / 8.0 + case when p_survived then 110 else 20 end) * mult));
  d_gain := greatest(5, floor((coalesce(p_seconds,0) * 2.2 + case when p_survived then 130 else 25 end) * mult));

  update public.characters c
  set attack_xp = c.attack_xp + a_gain,
      strength_xp = c.strength_xp + s_gain,
      defence_xp = c.defence_xp + d_gain
  where c.user_id = auth.uid()
  returning c.attack_xp, c.strength_xp, c.defence_xp
  into attack_xp, strength_xp, defence_xp;

  if attack_xp is null then raise exception 'Character not found'; end if;
  attack_gained := a_gain;
  strength_gained := s_gain;
  defence_gained := d_gain;
  return next;
end;
$$;

grant execute on function public.complete_sailing_run(boolean, integer, integer, integer) to authenticated;
grant execute on function public.complete_combat_run(boolean, integer, integer, integer, text) to authenticated;
notify pgrst, 'reload schema';
