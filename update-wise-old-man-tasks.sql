-- REPO COMPANY: WISE OLD MAN PERSONAL TASKS + GOLD PIECES
alter table public.characters add column if not exists gp bigint not null default 0 check (gp >= 0);
alter table public.characters add column if not exists wise_task_skill text;
alter table public.characters add column if not exists wise_task_start_xp integer;
alter table public.characters add column if not exists wise_task_required_xp integer;
alter table public.characters add column if not exists wise_task_reward_gp integer;
alter table public.characters add column if not exists wise_task_created_at timestamptz;

create or replace function public.wise_task_current_xp(c public.characters, skill text)
returns integer language sql immutable as $$
 select case skill
  when 'agility' then coalesce(c.agility_xp,0)
  when 'slayer' then coalesce(c.slayer_xp,0)
  when 'combat' then coalesce(c.attack_xp,0)+coalesce(c.strength_xp,0)+coalesce(c.defence_xp,0)
  when 'sailing' then coalesce(c.sailing_xp,0)
  when 'runecrafting' then coalesce(c.runecrafting_xp,0)
  else 0 end::integer
$$;

create or replace function public.get_wise_old_man_task()
returns table(gp bigint,task_skill text,start_xp integer,required_xp integer,reward_gp integer,current_xp integer,can_claim boolean)
language sql security definer set search_path=public as $$
 select c.gp,c.wise_task_skill,c.wise_task_start_xp,c.wise_task_required_xp,c.wise_task_reward_gp,
        public.wise_task_current_xp(c,c.wise_task_skill),
        (c.wise_task_skill is not null and public.wise_task_current_xp(c,c.wise_task_skill)>=coalesce(c.wise_task_start_xp,0)+coalesce(c.wise_task_required_xp,0))
 from public.characters c where c.user_id=auth.uid() limit 1
$$;

drop function if exists public.assign_wise_old_man_task();
create function public.assign_wise_old_man_task()
returns table(gp bigint,task_skill text,start_xp integer,required_xp integer,reward_gp integer,current_xp integer,can_claim boolean)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; chosen text; required integer; reward integer; roll integer;
begin
 select * into c from public.characters where user_id=auth.uid() for update;
 if c.id is null then raise exception 'Character not found'; end if;
 if c.wise_task_skill is null then
   roll:=floor(random()*5)::integer;
   chosen:=case roll when 0 then 'agility' when 1 then 'slayer' when 2 then 'combat' when 3 then 'sailing' else 'runecrafting' end;
   required:=case chosen
     when 'agility' then 250+(floor(random()*5)::integer*75)
     when 'slayer' then 180+(floor(random()*4)::integer*90)
     when 'combat' then 300+(floor(random()*6)::integer*100)
     when 'sailing' then 120+(floor(random()*5)::integer*60)
     when 'runecrafting' then 100+(floor(random()*5)::integer*50)
   end;
   reward:=case chosen
     when 'agility' then 450+required*2
     when 'slayer' then 600+required*3
     when 'combat' then 500+required*2
     when 'sailing' then 500+required*3
     when 'runecrafting' then 700+required*4
   end;
   update public.characters set wise_task_skill=chosen,wise_task_start_xp=public.wise_task_current_xp(c,chosen),wise_task_required_xp=required,wise_task_reward_gp=reward,wise_task_created_at=now() where id=c.id;
 end if;
 return query select * from public.get_wise_old_man_task();
end$$;

drop function if exists public.claim_wise_old_man_task();
create function public.claim_wise_old_man_task()
returns table(claimed boolean,reward_gp integer,new_gp bigint)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; reward integer;
begin
 select * into c from public.characters where user_id=auth.uid() for update;
 if c.id is null or c.wise_task_skill is null then return query select false,0,coalesce(c.gp,0); return; end if;
 if public.wise_task_current_xp(c,c.wise_task_skill)<coalesce(c.wise_task_start_xp,0)+coalesce(c.wise_task_required_xp,0) then
   return query select false,0,c.gp; return;
 end if;
 reward:=c.wise_task_reward_gp;
 update public.characters set gp=gp+reward,wise_task_skill=null,wise_task_start_xp=null,wise_task_required_xp=null,wise_task_reward_gp=null,wise_task_created_at=null where id=c.id;
 return query select true,reward,c.gp+reward;
end$$;

grant execute on function public.get_wise_old_man_task() to authenticated;
grant execute on function public.assign_wise_old_man_task() to authenticated;
grant execute on function public.claim_wise_old_man_task() to authenticated;
notify pgrst,'reload schema';
