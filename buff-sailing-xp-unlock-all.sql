-- REPO COMPANY: SAILING XP BUFF + ALL DIFFICULTIES UNLOCKED
-- Run once in Supabase SQL Editor after uploading the new website files.

alter table public.characters add column if not exists sailing_xp integer not null default 0 check (sailing_xp >= 0);

drop function if exists public.complete_sailing_run_v2(text,boolean,integer,integer,integer,integer);
create function public.complete_sailing_run_v2(
  p_course text,
  p_survived boolean,
  p_score integer,
  p_gates integer,
  p_seconds integer,
  p_checkpoints integer
)
returns table(sailing_xp integer,sailing_gained integer)
language plpgsql security definer set search_path=public as $$
declare
  base integer; cap integer; duration integer;
  current_xp integer; gain integer; new_xp integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_score<0 or p_score>500000 or p_gates<0 or p_gates>300 or p_checkpoints<0 or p_checkpoints>3 then raise exception 'Invalid sailing run'; end if;

  case p_course
    when 'easy' then base:=40; cap:=85; duration:=42;
    when 'normal' then base:=68; cap:=145; duration:=48;
    when 'hard' then base:=110; cap:=230; duration:=54;
    when 'expert' then base:=175; cap:=350; duration:=60;
    when 'insane' then base:=270; cap:=540; duration:=66;
    else raise exception 'Unknown sailing course';
  end case;

  if p_seconds<1 or p_seconds>duration then raise exception 'Invalid sailing time'; end if;
  if p_survived and p_seconds<duration-2 then raise exception 'Run ended too quickly'; end if;

  select c.sailing_xp into current_xp
  from public.characters c where c.user_id=auth.uid() for update;
  if current_xp is null then raise exception 'Character not found'; end if;

  -- All courses are available immediately. Harder courses pay substantially more, while failed runs still bank checkpoint progress.
  gain := case when p_survived then base else greatest(4, floor(base*(p_checkpoints/4.0))::integer) end;
  gain := gain + least(floor(cap*.34)::integer, floor(p_score/180.0)::integer);
  gain := gain + least(floor(cap*.18)::integer, p_gates*2);
  if p_survived then gain := gain + floor(base*.28)::integer; end if;
  gain := least(cap, greatest(4,gain));

  update public.characters c set sailing_xp=c.sailing_xp+gain
  where c.user_id=auth.uid() returning c.sailing_xp into new_xp;
  return query select new_xp,gain;
end; $$;

grant execute on function public.complete_sailing_run_v2(text,boolean,integer,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
