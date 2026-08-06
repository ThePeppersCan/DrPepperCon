-- REPO COMPANY: ENDLESS HORDE RUN SUMMARY HOVERCARDS
-- Run once in Supabase -> SQL Editor.
-- Preserves all existing Endless Horde personal bests and older RPCs.

alter table public.endless_horde_scores
  add column if not exists best_weapon text,
  add column if not exists best_run_level integer not null default 1,
  add column if not exists best_rare_picks integer not null default 0,
  add column if not exists best_upgrades jsonb not null default '[]'::jsonb;

create or replace function public.submit_endless_horde_score_v2(
  p_map_id text,
  p_wave integer,
  p_kills integer,
  p_seconds integer,
  p_weapon text,
  p_run_level integer,
  p_rare_picks integer,
  p_upgrades jsonb
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_existing public.endless_horde_scores%rowtype;
  v_is_better boolean;
  v_upgrades jsonb := coalesce(p_upgrades,'[]'::jsonb);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_map_id not in ('zombie-varrock','zombie-falador','zombie-morytania') then raise exception 'Invalid map'; end if;
  if p_weapon not in ('greataxe','blowpipe','shadow') then raise exception 'Invalid weapon'; end if;
  if jsonb_typeof(v_upgrades) <> 'array' then v_upgrades := '[]'::jsonb; end if;

  -- Prevent an unexpectedly large client payload from being persisted.
  if jsonb_array_length(v_upgrades) > 40 then
    v_upgrades := (
      select coalesce(jsonb_agg(value),'[]'::jsonb)
      from (select value from jsonb_array_elements(v_upgrades) limit 40) limited
    );
  end if;

  select * into v_existing
  from public.endless_horde_scores
  where user_id=auth.uid() and map_id=p_map_id
  for update;

  if not found then
    insert into public.endless_horde_scores(
      user_id,map_id,best_wave,best_kills,best_seconds,best_weapon,
      best_run_level,best_rare_picks,best_upgrades
    ) values (
      auth.uid(),p_map_id,greatest(1,p_wave),greatest(0,p_kills),greatest(0,p_seconds),p_weapon,
      greatest(1,p_run_level),greatest(0,p_rare_picks),v_upgrades
    );
    return;
  end if;

  v_is_better := p_wave > v_existing.best_wave
    or (p_wave = v_existing.best_wave and p_kills > v_existing.best_kills)
    or (p_wave = v_existing.best_wave and p_kills = v_existing.best_kills and p_seconds > v_existing.best_seconds);

  if v_is_better then
    update public.endless_horde_scores
       set best_wave=greatest(1,p_wave),
           best_kills=greatest(0,p_kills),
           best_seconds=greatest(0,p_seconds),
           best_weapon=p_weapon,
           best_run_level=greatest(1,p_run_level),
           best_rare_picks=greatest(0,p_rare_picks),
           best_upgrades=v_upgrades,
           updated_at=now()
     where user_id=auth.uid() and map_id=p_map_id;
  end if;
end;
$$;

create or replace function public.get_endless_horde_leaderboard_v2()
returns table(
  username text,
  map_id text,
  best_wave integer,
  best_kills integer,
  best_seconds integer,
  best_weapon text,
  best_run_level integer,
  best_rare_picks integer,
  best_upgrades jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  select c.username,s.map_id,s.best_wave,s.best_kills,s.best_seconds,s.best_weapon,
         s.best_run_level,s.best_rare_picks,s.best_upgrades
  from public.endless_horde_scores s
  join public.characters c on c.user_id=s.user_id
  order by s.best_wave desc,s.best_kills desc,s.best_seconds desc
  limit 50
$$;

grant execute on function public.submit_endless_horde_score_v2(text,integer,integer,integer,text,integer,integer,jsonb) to authenticated;
grant execute on function public.get_endless_horde_leaderboard_v2() to anon,authenticated;

notify pgrst,'reload schema';
