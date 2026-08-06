-- REPO COMPANY — WISE OLD MAN: COUNT EVERY VALID XP SOURCE
-- Run once in Supabase SQL Editor.
-- The task system now measures the canonical character skill XP totals only,
-- so every minigame/activity that awards that skill counts automatically.

create or replace function public.wise_task_current_xp(c public.characters, skill text)
returns integer
language sql
stable
as $$
  select case lower(coalesce(skill,''))
    when 'agility' then coalesce(c.agility_xp,0)
    when 'slayer' then coalesce(c.slayer_xp,0)
    when 'combat' then
      coalesce(c.attack_xp,0)+coalesce(c.strength_xp,0)+coalesce(c.defence_xp,0)+
      coalesce(c.magic_xp,0)+coalesce(c.ranged_xp,0)
    when 'sailing' then coalesce(c.sailing_xp,0)
    when 'runecrafting' then coalesce(c.runecrafting_xp,0)
    else 0
  end::integer
$$;

create or replace function public.get_wise_old_man_task()
returns table(
  gp bigint,
  task_skill text,
  start_xp integer,
  required_xp integer,
  reward_gp integer,
  current_xp integer,
  can_claim boolean
)
language sql
security definer
set search_path=public
as $$
  select
    c.gp,
    c.wise_task_skill,
    c.wise_task_start_xp,
    c.wise_task_required_xp,
    c.wise_task_reward_gp,
    public.wise_task_current_xp(c,c.wise_task_skill),
    (c.wise_task_skill is not null and
      public.wise_task_current_xp(c,c.wise_task_skill) >=
      coalesce(c.wise_task_start_xp,0)+coalesce(c.wise_task_required_xp,0))
  from public.characters c
  where c.user_id=auth.uid()
  limit 1
$$;

create or replace function public.claim_wise_old_man_task()
returns table(claimed boolean,reward_gp integer,new_gp bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.characters%rowtype;
  reward integer;
begin
  select * into c from public.characters where user_id=auth.uid() for update;
  if not found or c.wise_task_skill is null then
    return query select false,0,coalesce(c.gp,0);return;
  end if;
  if public.wise_task_current_xp(c,c.wise_task_skill) <
     coalesce(c.wise_task_start_xp,0)+coalesce(c.wise_task_required_xp,0) then
    return query select false,0,c.gp;return;
  end if;
  reward:=coalesce(c.wise_task_reward_gp,0);
  update public.characters
  set gp=gp+reward,
      wise_task_skill=null,
      wise_task_start_xp=null,
      wise_task_required_xp=null,
      wise_task_reward_gp=null,
      wise_task_created_at=null
  where id=c.id;
  return query select true,reward,(c.gp+reward)::bigint;
end
$$;

grant execute on function public.wise_task_current_xp(public.characters,text) to authenticated;
grant execute on function public.get_wise_old_man_task() to authenticated;
grant execute on function public.claim_wise_old_man_task() to authenticated;
notify pgrst,'reload schema';
