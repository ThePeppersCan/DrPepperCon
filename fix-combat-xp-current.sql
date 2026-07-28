-- Repo Company: repair Combat XP saving for Easy / Medium / Hard runs
alter table public.characters add column if not exists attack_xp integer not null default 0 check (attack_xp >= 0);
alter table public.characters add column if not exists strength_xp integer not null default 0 check (strength_xp >= 0);
alter table public.characters add column if not exists defence_xp integer not null default 0 check (defence_xp >= 0);

drop function if exists public.complete_combat_run(boolean, integer, integer, integer);
drop function if exists public.complete_combat_run(boolean, integer, integer, integer, text);

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
  mult numeric := case lower(coalesce(p_difficulty, 'medium'))
    when 'easy' then 0.75
    when 'hard' then 1.40
    else 1.00
  end;
  a_gain integer;
  s_gain integer;
  d_gain integer;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;

  a_gain := greatest(1, floor((least(greatest(coalesce(p_kills,0),0),300) * 3 + case when p_survived then 45 else 0 end) * mult));
  s_gain := greatest(1, floor((least(greatest(coalesce(p_damage,0),0),30000) / 10.0 + case when p_survived then 55 else 0 end) * mult));
  d_gain := greatest(1, floor((least(greatest(coalesce(p_seconds,0),0),60) * 2 + case when p_survived then 65 else 0 end) * mult));

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

grant execute on function public.complete_combat_run(boolean, integer, integer, integer, text) to authenticated;
notify pgrst, 'reload schema';
