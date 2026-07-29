alter table public.characters add column if not exists mining_afk_active boolean not null default false;
alter table public.characters add column if not exists mining_afk_last_click_at timestamptz;
alter table public.characters add column if not exists mining_afk_gp_checkpoint_at timestamptz;

create or replace function public.get_mining_afk_state()
returns table(mining_xp integer,gp integer,active_pet text,pet_name text,active boolean,seconds_until_click integer,gp_gained integer,xp_gained integer)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; v_now timestamptz:=now(); v_end timestamptz; v_periods integer:=0; v_pet_name text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select * into c from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if c.mining_afk_active and c.mining_afk_last_click_at is not null and c.mining_afk_gp_checkpoint_at is not null then
    v_end:=least(v_now,c.mining_afk_last_click_at+interval '15 minutes');
    if v_end>c.mining_afk_gp_checkpoint_at then v_periods:=floor(extract(epoch from(v_end-c.mining_afk_gp_checkpoint_at))/600); end if;
    if v_periods>0 then
      update public.characters set gp=coalesce(public.characters.gp,0)+v_periods*1000,mining_afk_gp_checkpoint_at=c.mining_afk_gp_checkpoint_at+(v_periods*interval '10 minutes') where user_id=auth.uid() returning * into c;
    end if;
  end if;
  if c.mining_afk_active and (c.active_pet is null or c.mining_afk_last_click_at is null or v_now>c.mining_afk_last_click_at+interval '15 minutes') then
    update public.characters set mining_afk_active=false where user_id=auth.uid() returning * into c;
  end if;
  v_pet_name:=coalesce(c.pet_names->>c.active_pet,'');
  return query select coalesce(c.mining_xp,0),coalesce(c.gp,0),c.active_pet,v_pet_name,c.mining_afk_active,
    case when c.mining_afk_active then greatest(0,ceil(420-extract(epoch from(v_now-c.mining_afk_last_click_at)))::integer) else 0 end,
    v_periods*1000,0;
end $$;

create or replace function public.mine_shooting_star()
returns table(mining_xp integer,gp integer,active_pet text,pet_name text,active boolean,seconds_until_click integer,gp_gained integer,xp_gained integer)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; v_now timestamptz:=now(); v_end timestamptz; v_periods integer:=0; v_gain integer; v_pet_name text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select * into c from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if c.active_pet is null then raise exception 'You need to let a pet out from your Bank first'; end if;
  if c.mining_afk_active and c.mining_afk_last_click_at is not null and v_now<c.mining_afk_last_click_at+interval '7 minutes' then
    raise exception 'Your pet is still working. Wait before striking again';
  end if;
  if c.mining_afk_active and c.mining_afk_gp_checkpoint_at is not null and c.mining_afk_last_click_at is not null then
    v_end:=least(v_now,c.mining_afk_last_click_at+interval '15 minutes');
    if v_end>c.mining_afk_gp_checkpoint_at then v_periods:=floor(extract(epoch from(v_end-c.mining_afk_gp_checkpoint_at))/600); end if;
  end if;
  v_gain:=80+floor(random()*31)::integer;
  update public.characters set
    mining_xp=coalesce(public.characters.mining_xp,0)+v_gain,
    gp=coalesce(public.characters.gp,0)+v_periods*1000,
    mining_afk_active=true,
    mining_afk_last_click_at=v_now,
    mining_afk_gp_checkpoint_at=case when mining_afk_gp_checkpoint_at is null or not c.mining_afk_active then v_now else mining_afk_gp_checkpoint_at+(v_periods*interval '10 minutes') end
  where user_id=auth.uid() returning * into c;
  v_pet_name:=coalesce(c.pet_names->>c.active_pet,'');
  return query select coalesce(c.mining_xp,0),coalesce(c.gp,0),c.active_pet,v_pet_name,true,420,v_periods*1000,v_gain;
end $$;

create or replace function public.stop_shooting_star()
returns table(mining_xp integer,gp integer,active_pet text,pet_name text,active boolean,seconds_until_click integer,gp_gained integer,xp_gained integer)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  update public.characters set mining_afk_active=false where user_id=auth.uid() returning * into c;
  return query select coalesce(c.mining_xp,0),coalesce(c.gp,0),c.active_pet,coalesce(c.pet_names->>c.active_pet,''),false,0,0,0;
end $$;

grant execute on function public.get_mining_afk_state() to authenticated;
grant execute on function public.mine_shooting_star() to authenticated;
grant execute on function public.stop_shooting_star() to authenticated;
notify pgrst,'reload schema';
