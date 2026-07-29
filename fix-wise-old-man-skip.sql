-- FIX: Wise Old Man task skipping
-- Run this once in Supabase SQL Editor, then refresh the website.

alter table public.characters add column if not exists gp bigint not null default 0 check (gp >= 0);
alter table public.characters add column if not exists wise_task_skill text;
alter table public.characters add column if not exists wise_task_start_xp integer;
alter table public.characters add column if not exists wise_task_required_xp integer;
alter table public.characters add column if not exists wise_task_reward_gp integer;
alter table public.characters add column if not exists wise_task_created_at timestamptz;

create or replace function public.wise_task_current_xp(c public.characters, skill text)
returns integer
language sql
immutable
as $$
  select case skill
    when 'agility' then coalesce(c.agility_xp, 0)
    when 'slayer' then coalesce(c.slayer_xp, 0)
    when 'combat' then coalesce(c.attack_xp, 0) + coalesce(c.strength_xp, 0) + coalesce(c.defence_xp, 0)
    when 'sailing' then coalesce(c.sailing_xp, 0)
    when 'runecrafting' then coalesce(c.runecrafting_xp, 0)
    else 0
  end::integer
$$;

drop function if exists public.skip_wise_old_man_task_v2();
create function public.skip_wise_old_man_task_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_character public.characters%rowtype;
  v_previous_skill text;
  v_chosen_skill text;
  v_required integer;
  v_reward integer;
  v_current_xp integer;
begin
  select *
    into v_character
    from public.characters
   where user_id = auth.uid()
   for update;

  if not found then
    raise exception using message = 'Character not found', errcode = 'P0001';
  end if;
  if v_character.wise_task_skill is null then
    raise exception using message = 'No active task', errcode = 'P0001';
  end if;
  if coalesce(v_character.gp, 0) < 5000 then
    raise exception using message = 'Not enough GP', errcode = 'P0001';
  end if;

  v_previous_skill := v_character.wise_task_skill;
  loop
    v_chosen_skill := (array['agility','slayer','combat','sailing','runecrafting'])[1 + floor(random() * 5)::integer];
    exit when v_chosen_skill <> v_previous_skill;
  end loop;

  v_required := case v_chosen_skill
    when 'agility' then 250 + floor(random() * 5)::integer * 75
    when 'slayer' then 180 + floor(random() * 4)::integer * 90
    when 'combat' then 300 + floor(random() * 6)::integer * 100
    when 'sailing' then 120 + floor(random() * 5)::integer * 60
    when 'runecrafting' then 100 + floor(random() * 5)::integer * 50
  end;

  v_reward := case v_chosen_skill
    when 'agility' then 450 + v_required * 2
    when 'slayer' then 600 + v_required * 3
    when 'combat' then 500 + v_required * 2
    when 'sailing' then 500 + v_required * 3
    when 'runecrafting' then 700 + v_required * 4
  end;

  v_current_xp := public.wise_task_current_xp(v_character, v_chosen_skill);

  update public.characters
     set gp = gp - 5000,
         wise_task_skill = v_chosen_skill,
         wise_task_start_xp = v_current_xp,
         wise_task_required_xp = v_required,
         wise_task_reward_gp = v_reward,
         wise_task_created_at = now()
   where id = v_character.id;

  return jsonb_build_object(
    'gp', v_character.gp - 5000,
    'task_skill', v_chosen_skill,
    'start_xp', v_current_xp,
    'required_xp', v_required,
    'reward_gp', v_reward,
    'current_xp', v_current_xp,
    'can_claim', false
  );
end;
$$;

revoke all on function public.skip_wise_old_man_task_v2() from public;
grant execute on function public.skip_wise_old_man_task_v2() to authenticated;
notify pgrst, 'reload schema';
