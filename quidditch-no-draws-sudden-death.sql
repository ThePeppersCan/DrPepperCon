-- Repo Company Quidditch: authoritative no-draw / sudden-death fix
-- Run this entire file once in Supabase -> SQL Editor.
--
-- Behaviour after installation:
--   * Regulation cannot finish as a draw.
--   * If the score is tied when 3:00 expires, the shared match remains LIVE.
--   * The client receives a repeating <=5 second live clock, which activates its
--     existing SUDDEN DEATH / NEXT GOAL presentation.
--   * The first ordinary goal in sudden death immediately starts the authoritative
--     30-second full-time phase for every viewer.
--   * Draw predictions are rejected going forward.

-- Advance the singleton shared clock. A tied regulation score no longer moves to
-- POST; it remains live in a short renewable sudden-death window.
drop function if exists public.advance_quidditch_live_clock();
create function public.advance_quidditch_live_clock()
returns public.quidditch_live_clock
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_clock public.quidditch_live_clock%rowtype;
  v_steps integer := 0;
  v_left integer := 0;
  v_right integer := 0;
begin
  select q.* into v_clock
  from public.quidditch_live_clock q
  where q.clock_id=1
  for update;

  if not found then
    insert into public.quidditch_live_clock(clock_id,match_id,phase,phase_started_at,phase_ends_at,updated_at)
    values(1,floor(extract(epoch from v_now)/235)::bigint,'lineup',v_now,v_now+interval '25 seconds',v_now)
    returning * into v_clock;
  end if;

  if v_clock.phase_ends_at < v_now - interval '1 hour' then
    v_clock.match_id := greatest(v_clock.match_id + 1, floor(extract(epoch from v_now)/235)::bigint);
    v_clock.phase := 'lineup';
    v_clock.phase_started_at := v_now;
    v_clock.phase_ends_at := v_now + interval '25 seconds';
  else
    while v_clock.phase_ends_at <= v_now and v_steps < 100 loop
      v_steps := v_steps + 1;

      if v_clock.phase='lineup' then
        v_clock.phase := 'live';
        v_clock.phase_started_at := v_clock.phase_ends_at;
        v_clock.phase_ends_at := v_clock.phase_ends_at + interval '180 seconds';

      elsif v_clock.phase='live' then
        select count(*) filter(where g.side='left')::integer,
               count(*) filter(where g.side='right')::integer
          into v_left,v_right
        from public.quidditch_goals g
        where g.match_id=v_clock.match_id;

        if coalesce(v_left,0)=coalesce(v_right,0) then
          -- Regulation is tied. Stay live and expose a short countdown so the
          -- existing client labels the match SUDDEN DEATH / NEXT GOAL.
          -- phase_started_at deliberately remains unchanged, allowing goal RPCs
          -- to recognise that regulation has already expired.
          v_clock.phase := 'live';
          v_clock.phase_ends_at := v_now + interval '5 seconds';
        else
          v_clock.phase := 'post';
          v_clock.phase_started_at := v_clock.phase_ends_at;
          v_clock.phase_ends_at := v_clock.phase_ends_at + interval '30 seconds';
        end if;

      else
        v_clock.match_id := v_clock.match_id + 1;
        v_clock.phase := 'lineup';
        v_clock.phase_started_at := v_clock.phase_ends_at;
        v_clock.phase_ends_at := v_clock.phase_ends_at + interval '25 seconds';
      end if;
    end loop;
  end if;

  update public.quidditch_live_clock q
  set match_id=v_clock.match_id,
      phase=v_clock.phase,
      phase_started_at=v_clock.phase_started_at,
      phase_ends_at=v_clock.phase_ends_at,
      updated_at=v_now
  where q.clock_id=1
  returning q.* into v_clock;

  return v_clock;
end;
$$;

-- Ordinary goals become match-winning goals when scored after regulation while
-- the score was tied. The goal and transition to POST happen in one transaction.
drop function if exists public.record_live_quidditch_goal(bigint,text,text,text);
create function public.record_live_quidditch_goal(
  p_match_id bigint,
  p_side text,
  p_pet_name text,
  p_event_key text
)
returns table(goal_id bigint,left_score integer,right_score integer,left_scorers jsonb,right_scorers jsonb)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_now timestamptz := clock_timestamp();
  v_id bigint;
  v_left integer := 0;
  v_right integer := 0;
  v_left_scorers jsonb := '{}'::jsonb;
  v_right_scorers jsonb := '{}'::jsonb;
begin
  v_clock := public.advance_quidditch_live_clock();

  if p_match_id<>v_clock.match_id or v_clock.phase<>'live' then
    raise exception 'This match is not live';
  end if;
  if p_side not in ('left','right') then raise exception 'Invalid scoring side'; end if;
  if length(trim(coalesce(p_pet_name,'')))<1 then raise exception 'Missing scorer'; end if;

  perform pg_advisory_xact_lock(hashtext('repo-live-quidditch:'||p_match_id::text));

  insert into public.quidditch_goals(match_id,event_key,side,pet_name,scored_at)
  values(
    p_match_id,
    left(coalesce(nullif(trim(p_event_key),''),gen_random_uuid()::text),180),
    p_side,
    left(trim(p_pet_name),80),
    v_now
  )
  on conflict(event_key) do update set event_key=excluded.event_key
  returning id into v_id;

  with grouped as(
    select g.side,g.pet_name,count(*)::integer goals
    from public.quidditch_goals g
    where g.match_id=p_match_id
    group by g.side,g.pet_name
  )
  select count(*) filter(where g.side='left')::integer,
         count(*) filter(where g.side='right')::integer,
         coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='left'),'{}'::jsonb),
         coalesce((select jsonb_object_agg(x.pet_name,x.goals) from grouped x where x.side='right'),'{}'::jsonb)
    into v_left,v_right,v_left_scorers,v_right_scorers
  from public.quidditch_goals g
  where g.match_id=p_match_id;

  -- phase_started_at is the beginning of regulation and is intentionally retained
  -- during sudden death. Therefore >=180 seconds means this was the deciding goal.
  if v_now >= v_clock.phase_started_at + interval '180 seconds'
     and coalesce(v_left,0)<>coalesce(v_right,0) then
    update public.quidditch_live_clock q
    set phase='post',
        phase_started_at=v_now,
        phase_ends_at=v_now+interval '30 seconds',
        updated_at=v_now
    where q.clock_id=1
      and q.match_id=p_match_id
      and q.phase='live';
  end if;

  return query select
    v_id,
    coalesce(v_left,0),
    coalesce(v_right,0),
    v_left_scorers,
    v_right_scorers;
end;
$$;

-- Draw is no longer a valid prediction because a match must produce a winner.
drop function if exists public.predict_live_quidditch(bigint,text);
create function public.predict_live_quidditch(p_match_id bigint,p_side text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_pick text;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction'; end if;
  v_clock := public.advance_quidditch_live_clock();
  if p_match_id<>v_clock.match_id or v_clock.phase<>'lineup' then
    raise exception 'Predictions are closed for this match';
  end if;
  if p_side not in('left','right') then raise exception 'Choose one of the two teams'; end if;

  insert into public.quidditch_predictions(match_id,user_id,picked_side)
  values(p_match_id,auth.uid(),p_side)
  on conflict(match_id,user_id) do nothing;

  select qp.picked_side into v_pick
  from public.quidditch_predictions qp
  where qp.match_id=p_match_id and qp.user_id=auth.uid();

  return v_pick;
end;
$$;

grant execute on function public.advance_quidditch_live_clock() to anon,authenticated;
grant execute on function public.record_live_quidditch_goal(bigint,text,text,text) to anon,authenticated;
grant execute on function public.predict_live_quidditch(bigint,text) to authenticated;

notify pgrst,'reload schema';
