-- Shooting Star 7-minute cycles
-- One click begins a 7-minute cycle awarding 1,500 Mining XP and 2,500 GP gradually.

alter table public.characters add column if not exists mining_xp integer not null default 0;
alter table public.characters add column if not exists gp integer not null default 0;
alter table public.characters add column if not exists active_pet text;
alter table public.characters add column if not exists pet_names jsonb not null default '{}'::jsonb;
alter table public.characters add column if not exists mining_afk_active boolean not null default false;
alter table public.characters add column if not exists mining_cycle_start_at timestamptz;
alter table public.characters add column if not exists mining_cycle_xp_awarded integer not null default 0;
alter table public.characters add column if not exists mining_cycle_gp_awarded integer not null default 0;

drop function if exists public.get_active_star_miners();
drop function if exists public.get_mining_afk_state();
drop function if exists public.mine_shooting_star();
drop function if exists public.stop_shooting_star();

create function public.get_mining_afk_state()
returns table(
  mining_xp integer,
  gp integer,
  active_pet text,
  pet_name text,
  active boolean,
  seconds_until_click integer,
  gp_gained integer,
  xp_gained integer,
  cycle_xp integer,
  cycle_gp integer,
  progress_percent numeric,
  degraded boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.characters%rowtype;
  v_now timestamptz := now();
  v_elapsed numeric := 0;
  v_target_xp integer := 0;
  v_target_gp integer := 0;
  v_xp_delta integer := 0;
  v_gp_delta integer := 0;
  v_finished boolean := false;
  v_pet_name text := '';
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;

  select * into c from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;

  if c.mining_afk_active and c.mining_cycle_start_at is not null then
    v_elapsed := least(420::numeric, greatest(0::numeric, extract(epoch from (v_now-c.mining_cycle_start_at))));
    v_target_xp := floor(1500 * v_elapsed / 420)::integer;
    v_target_gp := floor(2500 * v_elapsed / 420)::integer;
    v_xp_delta := greatest(0, v_target_xp-coalesce(c.mining_cycle_xp_awarded,0));
    v_gp_delta := greatest(0, v_target_gp-coalesce(c.mining_cycle_gp_awarded,0));
    v_finished := v_elapsed >= 420;

    update public.characters ch set
      mining_xp=coalesce(ch.mining_xp,0)+v_xp_delta,
      gp=coalesce(ch.gp,0)+v_gp_delta,
      mining_cycle_xp_awarded=v_target_xp,
      mining_cycle_gp_awarded=v_target_gp,
      mining_afk_active=not v_finished
    where ch.user_id=auth.uid() returning ch.* into c;
  end if;

  v_pet_name := coalesce(c.pet_names->>c.active_pet::text,'');

  return query select
    coalesce(c.mining_xp,0)::integer,
    coalesce(c.gp,0)::integer,
    c.active_pet::text,
    v_pet_name::text,
    coalesce(c.mining_afk_active,false)::boolean,
    (case when c.mining_afk_active and c.mining_cycle_start_at is not null
      then greatest(0,ceil(420-extract(epoch from (v_now-c.mining_cycle_start_at)))::integer)
      else 0 end)::integer,
    v_gp_delta::integer,
    v_xp_delta::integer,
    coalesce(c.mining_cycle_xp_awarded,0)::integer,
    coalesce(c.mining_cycle_gp_awarded,0)::integer,
    (case when c.mining_cycle_start_at is null then 0
      else least(100,greatest(0,extract(epoch from (v_now-c.mining_cycle_start_at))*100/420)) end)::numeric,
    (c.mining_cycle_start_at is not null and not c.mining_afk_active and coalesce(c.mining_cycle_xp_awarded,0)>=1500)::boolean;
end;
$$;

create function public.mine_shooting_star()
returns table(
  mining_xp integer,
  gp integer,
  active_pet text,
  pet_name text,
  active boolean,
  seconds_until_click integer,
  gp_gained integer,
  xp_gained integer,
  cycle_xp integer,
  cycle_gp integer,
  progress_percent numeric,
  degraded boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.characters%rowtype;
  v_now timestamptz:=now();
  v_elapsed numeric:=0;
  v_target_xp integer:=0;
  v_target_gp integer:=0;
  v_xp_delta integer:=0;
  v_gp_delta integer:=0;
  v_pet_name text:='';
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select * into c from public.characters where user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if c.active_pet is null then raise exception 'You need to let a pet out from your Bank first'; end if;

  -- Settle a finished/active old cycle before deciding whether a new one can start.
  if c.mining_afk_active and c.mining_cycle_start_at is not null then
    v_elapsed:=least(420::numeric,greatest(0::numeric,extract(epoch from(v_now-c.mining_cycle_start_at))));
    v_target_xp:=floor(1500*v_elapsed/420)::integer;
    v_target_gp:=floor(2500*v_elapsed/420)::integer;
    v_xp_delta:=greatest(0,v_target_xp-coalesce(c.mining_cycle_xp_awarded,0));
    v_gp_delta:=greatest(0,v_target_gp-coalesce(c.mining_cycle_gp_awarded,0));
    update public.characters ch set
      mining_xp=coalesce(ch.mining_xp,0)+v_xp_delta,
      gp=coalesce(ch.gp,0)+v_gp_delta,
      mining_cycle_xp_awarded=v_target_xp,
      mining_cycle_gp_awarded=v_target_gp,
      mining_afk_active=(v_elapsed<420)
    where ch.user_id=auth.uid() returning ch.* into c;
  end if;

  if c.mining_afk_active then raise exception 'Your pet is already mining this star'; end if;

  update public.characters ch set
    mining_afk_active=true,
    mining_cycle_start_at=v_now,
    mining_cycle_xp_awarded=0,
    mining_cycle_gp_awarded=0
  where ch.user_id=auth.uid() returning ch.* into c;

  v_pet_name:=coalesce(c.pet_names->>c.active_pet::text,'');
  return query select
    coalesce(c.mining_xp,0)::integer,
    coalesce(c.gp,0)::integer,
    c.active_pet::text,
    v_pet_name::text,
    true::boolean,
    420::integer,
    0::integer,
    0::integer,
    0::integer,
    0::integer,
    0::numeric,
    false::boolean;
end;
$$;

create function public.stop_shooting_star()
returns table(
  mining_xp integer,gp integer,active_pet text,pet_name text,active boolean,
  seconds_until_click integer,gp_gained integer,xp_gained integer,
  cycle_xp integer,cycle_gp integer,progress_percent numeric,degraded boolean
)
language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select * into c from public.characters where user_id=auth.uid();
  if not found then raise exception 'Character not found'; end if;
  return query select coalesce(c.mining_xp,0)::integer,coalesce(c.gp,0)::integer,c.active_pet::text,
    coalesce(c.pet_names->>c.active_pet::text,'')::text,coalesce(c.mining_afk_active,false)::boolean,
    0::integer,0::integer,0::integer,coalesce(c.mining_cycle_xp_awarded,0)::integer,
    coalesce(c.mining_cycle_gp_awarded,0)::integer,0::numeric,false::boolean;
end;$$;

create function public.get_active_star_miners()
returns table(username text,active_pet text,pet_name text)
language sql security definer set search_path=public as $$
  select c.username::text,c.active_pet::text,coalesce(c.pet_names->>c.active_pet::text,'')::text
  from public.characters c
  where c.mining_afk_active=true
    and c.active_pet is not null
    and c.mining_cycle_start_at is not null
    and c.mining_cycle_start_at > now()-interval '7 minutes'
  order by c.username
  limit 20;
$$;

grant execute on function public.get_mining_afk_state() to authenticated;
grant execute on function public.mine_shooting_star() to authenticated;
grant execute on function public.stop_shooting_star() to authenticated;
grant execute on function public.get_active_star_miners() to authenticated;
notify pgrst,'reload schema';
