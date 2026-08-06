-- Repo Company Quidditch: sudden-death winner + smooth continuation repair
-- Run this complete file once in Supabase -> SQL Editor.
--
-- Fixes:
--   * A tied game now receives one authoritative next-goal-wins goal shortly
--     after regulation, so sudden death cannot continue forever.
--   * The deciding goal moves the shared clock directly into the normal
--     30-second FULL TIME phase.
--   * Unique event keys and an advisory lock make concurrent browser
--     heartbeats safe; the winner can only be recorded once.
--   * Existing regulation goals, Snitch finishes, predictions and career
--     leaderboard triggers are left intact.

begin;

create or replace function public.advance_live_quidditch_background(p_viewer_key text)
returns table(is_host boolean,match_id bigint,phase text,phase_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_clock public.quidditch_live_clock%rowtype;
  v_elapsed integer := 0;
  v_regulation_elapsed integer := 0;
  v_i integer;
  v_goal_second integer;
  v_side text;
  v_pet text;
  v_left integer := 0;
  v_right integer := 0;
  v_sudden_goal_second integer := 0;
  v_sudden_event_key text;
begin
  v_clock := public.advance_quidditch_live_clock();

  if v_clock.phase = 'live' then
    -- phase_started_at remains the beginning of regulation during sudden death.
    -- Keep the raw elapsed value so time after 3:00 is visible to this host.
    v_elapsed := greatest(
      0,
      floor(extract(epoch from (v_now - v_clock.phase_started_at)))::integer
    );
    v_regulation_elapsed := least(180, v_elapsed);

    -- Preserve the original deterministic regulation scoring schedule.
    for v_i in 1..10 loop
      v_goal_second := 12
        + (v_i - 1) * 15
        + abs(hashtext(v_clock.match_id::text || ':time:' || v_i::text)) % 8;

      if v_goal_second <= v_regulation_elapsed then
        v_side := case
          when abs(hashtext(v_clock.match_id::text || ':goal:' || v_i::text)) % 2 = 0
            then 'left'
          else 'right'
        end;

        with ranked as (
          select
            coalesce(nullif(c.pet_names ->> c.active_pet, ''), c.active_pet) as pet_name,
            case
              when row_number() over (
                order by md5(v_clock.match_id::text || ':' || c.username)
              ) % 2 = 1 then 'left'
              else 'right'
            end as side,
            row_number() over (
              order by md5(v_clock.match_id::text || ':' || c.username)
            ) as rn
          from public.characters c
          where c.active_pet is not null
            and c.active_pet like 'pet_%'
          limit 30
        )
        select r.pet_name
        into v_pet
        from ranked r
        where r.side = v_side
        order by md5(
          v_clock.match_id::text || ':' || v_i::text || ':' || r.rn::text
        )
        limit 1;

        v_pet := coalesce(nullif(v_pet, ''), 'Unknown Pet');

        insert into public.quidditch_goals(
          match_id, event_key, side, pet_name, scored_at
        )
        values(
          v_clock.match_id,
          'background:' || v_clock.match_id::text || ':' || v_i::text,
          v_side,
          left(v_pet, 80),
          v_now
        )
        on conflict(event_key) do nothing;
      end if;
    end loop;

    -- Regulation has expired. If the result is still tied, schedule one
    -- deterministic next-goal-wins event 6-13 seconds into sudden death.
    if v_elapsed >= 180 then
      perform pg_advisory_xact_lock(
        hashtext('repo-live-quidditch:' || v_clock.match_id::text)
      );

      select
        count(*) filter (where g.side = 'left')::integer,
        count(*) filter (where g.side = 'right')::integer
      into v_left, v_right
      from public.quidditch_goals g
      where g.match_id = v_clock.match_id;

      v_sudden_goal_second := 186
        + abs(hashtext(v_clock.match_id::text || ':sudden-death-time')) % 8;
      v_sudden_event_key := 'sudden-death:' || v_clock.match_id::text;

      if coalesce(v_left, 0) = coalesce(v_right, 0)
         and v_elapsed >= v_sudden_goal_second then
        v_side := case
          when abs(hashtext(v_clock.match_id::text || ':sudden-death-winner')) % 2 = 0
            then 'left'
          else 'right'
        end;

        with ranked as (
          select
            coalesce(nullif(c.pet_names ->> c.active_pet, ''), c.active_pet) as pet_name,
            case
              when row_number() over (
                order by md5(v_clock.match_id::text || ':' || c.username)
              ) % 2 = 1 then 'left'
              else 'right'
            end as side,
            row_number() over (
              order by md5(v_clock.match_id::text || ':' || c.username)
            ) as rn
          from public.characters c
          where c.active_pet is not null
            and c.active_pet like 'pet_%'
          limit 30
        )
        select r.pet_name
        into v_pet
        from ranked r
        where r.side = v_side
        order by md5(v_clock.match_id::text || ':sudden-death:' || r.rn::text)
        limit 1;

        v_pet := coalesce(nullif(v_pet, ''), 'Unknown Pet');

        insert into public.quidditch_goals(
          match_id, event_key, side, pet_name, scored_at
        )
        values(
          v_clock.match_id,
          v_sudden_event_key,
          v_side,
          left(v_pet, 80),
          v_now
        )
        on conflict(event_key) do nothing;

        -- Whether this transaction inserted the row or another heartbeat won
        -- the race, a recorded sudden-death event owns the match finish.
        if exists (
          select 1
          from public.quidditch_goals g
          where g.match_id = v_clock.match_id
            and g.event_key = v_sudden_event_key
        ) then
          update public.quidditch_live_clock q
          set
            phase = 'post',
            phase_started_at = v_now,
            phase_ends_at = v_now + interval '30 seconds',
            updated_at = v_now
          where q.clock_id = 1
            and q.match_id = v_clock.match_id
            and q.phase = 'live';

          select q.*
          into v_clock
          from public.quidditch_live_clock q
          where q.clock_id = 1;
        end if;
      end if;
    end if;
  end if;

  return query
  select
    true,
    v_clock.match_id,
    v_clock.phase,
    greatest(
      0,
      ceil(extract(epoch from (v_clock.phase_ends_at - clock_timestamp())))::integer
    );
end;
$$;

grant execute on function public.advance_live_quidditch_background(text)
to anon, authenticated;

-- Repair an already-running sudden-death match immediately when it has passed
-- its deterministic deciding-goal point. Otherwise this is a harmless heartbeat.
select *
from public.advance_live_quidditch_background('manual-sudden-death-repair');

notify pgrst, 'reload schema';

commit;
