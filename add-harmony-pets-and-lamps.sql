-- REPO COMPANY: SEPARATE PETS TAB + ONE-TIME HARMONY XP LAMPS
-- Safe to run in full. It does not reset Harmony XP, character XP, pets, GP or bank items.

alter table public.characters add column if not exists bank_items jsonb not null default '{}'::jsonb;

create table if not exists public.harmony_reward_claims (
  user_id uuid not null,
  reward_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);
alter table public.harmony_reward_claims enable row level security;

create or replace function public.sync_my_harmony_rewards()
returns void language plpgsql security definer set search_path=public as $$
declare v_xp bigint:=coalesce((select count from public.counter where id=1),0); v_uid uuid:=auth.uid();
begin
  if v_uid is null then return; end if;
  if v_xp>=101333 and not exists(select 1 from public.harmony_reward_claims where user_id=v_uid and reward_id='lamp_50') then
    insert into public.harmony_reward_claims values(v_uid,'lamp_50',now()) on conflict do nothing;
    update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_30k}',to_jsonb(greatest(1,coalesce((bank_items->>'harmony_lamp_30k')::int,0))),true) where user_id=v_uid;
  end if;
  if v_xp>=273742 and not exists(select 1 from public.harmony_reward_claims where user_id=v_uid and reward_id='lamp_60') then
    insert into public.harmony_reward_claims values(v_uid,'lamp_60',now()) on conflict do nothing;
    update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_50k}',to_jsonb(greatest(1,coalesce((bank_items->>'harmony_lamp_50k')::int,0))),true) where user_id=v_uid;
  end if;
  if v_xp>=737627 and not exists(select 1 from public.harmony_reward_claims where user_id=v_uid and reward_id='lamp_70') then
    insert into public.harmony_reward_claims values(v_uid,'lamp_70',now()) on conflict do nothing;
    update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_75k}',to_jsonb(greatest(1,coalesce((bank_items->>'harmony_lamp_75k')::int,0))),true) where user_id=v_uid;
  end if;
  if v_xp>=1986068 and not exists(select 1 from public.harmony_reward_claims where user_id=v_uid and reward_id='lamp_80') then
    insert into public.harmony_reward_claims values(v_uid,'lamp_80',now()) on conflict do nothing;
    update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_100k}',to_jsonb(greatest(1,coalesce((bank_items->>'harmony_lamp_100k')::int,0))),true) where user_id=v_uid;
  end if;
  if v_xp>=6517253 then update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{pet_fredo}','1'::jsonb,true) where user_id=v_uid and coalesce((bank_items->>'pet_fredo')::int,0)<1; end if;
  if v_xp>=13034431 then update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_skillcape}','1'::jsonb,true) where user_id=v_uid and coalesce((bank_items->>'harmony_skillcape')::int,0)<1; end if;
end;$$;
grant execute on function public.sync_my_harmony_rewards() to authenticated;

create or replace function public.get_my_bank()
returns table(gp integer,items jsonb) language plpgsql security definer set search_path=public as $$
begin
  perform public.sync_my_harmony_rewards();
  return query select coalesce(c.gp,0)::integer,coalesce(c.bank_items,'{}'::jsonb) from public.characters c where c.user_id=auth.uid() limit 1;
end;$$;
grant execute on function public.get_my_bank() to authenticated;

create or replace function public.use_harmony_lamp(p_lamp text,p_skill text)
returns table(xp_awarded integer,new_skill_xp integer) language plpgsql security definer set search_path=public as $$
declare v_xp int; v_qty int; v_new int;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  v_xp:=case p_lamp when 'harmony_lamp_30k' then 30000 when 'harmony_lamp_50k' then 50000 when 'harmony_lamp_75k' then 75000 when 'harmony_lamp_100k' then 100000 else 0 end;
  if v_xp=0 then raise exception 'Unknown Harmony lamp'; end if;
  if p_skill not in ('agility','slayer','attack','strength','defence','magic','ranged','sailing','runecrafting','cooking','mining','woodcutting','fishing','farming') then raise exception 'Choose a valid skill'; end if;
  select coalesce((bank_items->>p_lamp)::int,0) into v_qty from public.characters where user_id=auth.uid() for update;
  if coalesce(v_qty,0)<1 then raise exception 'That lamp is no longer in your Bank'; end if;
  execute format('update public.characters set %I=coalesce(%I,0)+$1, bank_items=jsonb_set(coalesce(bank_items,''{}''::jsonb),$2,to_jsonb($3),true) where user_id=$4 returning %I',p_skill||'_xp',p_skill||'_xp',p_skill||'_xp')
    into v_new using v_xp,array[p_lamp],v_qty-1,auth.uid();
  if to_regclass('public.daily_xp_totals') is not null then
    insert into public.daily_xp_totals(user_id,xp_date,xp_earned,updated_at) values(auth.uid(),(timezone('Europe/London',now()))::date,v_xp,now())
    on conflict(user_id,xp_date) do update set xp_earned=public.daily_xp_totals.xp_earned+excluded.xp_earned,updated_at=now();
  end if;
  return query select v_xp,v_new;
end;$$;
grant execute on function public.use_harmony_lamp(text,text) to authenticated;

-- Grant currently reached rewards to existing accounts once. Existing claim rows prevent re-granting consumed lamps.
do $$ declare r record; v_xp bigint:=coalesce((select count from public.counter where id=1),0); begin
  for r in select user_id from public.characters loop
    if v_xp>=101333 and not exists(select 1 from public.harmony_reward_claims where user_id=r.user_id and reward_id='lamp_50') then
      insert into public.harmony_reward_claims values(r.user_id,'lamp_50',now());
      update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_30k}','1'::jsonb,true) where user_id=r.user_id;
    end if;
    if v_xp>=273742 and not exists(select 1 from public.harmony_reward_claims where user_id=r.user_id and reward_id='lamp_60') then
      insert into public.harmony_reward_claims values(r.user_id,'lamp_60',now());
      update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_50k}','1'::jsonb,true) where user_id=r.user_id;
    end if;
    if v_xp>=737627 and not exists(select 1 from public.harmony_reward_claims where user_id=r.user_id and reward_id='lamp_70') then
      insert into public.harmony_reward_claims values(r.user_id,'lamp_70',now());
      update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_75k}','1'::jsonb,true) where user_id=r.user_id;
    end if;
    if v_xp>=1986068 and not exists(select 1 from public.harmony_reward_claims where user_id=r.user_id and reward_id='lamp_80') then
      insert into public.harmony_reward_claims values(r.user_id,'lamp_80',now());
      update public.characters set bank_items=jsonb_set(coalesce(bank_items,'{}'::jsonb),'{harmony_lamp_100k}','1'::jsonb,true) where user_id=r.user_id;
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
