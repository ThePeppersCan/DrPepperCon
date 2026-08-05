-- Explicit signed-in tavern identity fix.
-- Run once after tavern-shared-state.sql.
-- The browser supplies the character name already loaded by the site, while
-- auth.uid() still guarantees that each heartbeat belongs to the signed-in user.

create or replace function public.tavern_shared_heartbeat_v2(
  p_session_id text,
  p_username text,
  p_identity_key text
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_identity text;
  v_normalised text;
  v_seat text;
  v_seats text[] := array[
    'sofa-left','sofa-left-centre','sofa-right-centre',
    'sofa-right','armchair-left','armchair-right'
  ];
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if coalesce(length(trim(p_session_id)),0) < 8 then raise exception 'Invalid tavern session'; end if;

  perform pg_advisory_xact_lock(91827461);
  perform public.tavern_shared_cleanup();

  -- Prefer the account name that the live website has already loaded.
  v_username := nullif(trim(p_username),'');

  if v_username is null then
    select c.username into v_username
    from public.characters c
    where c.user_id=v_uid
    limit 1;
  end if;

  if v_username is null then
    select coalesce(u.raw_user_meta_data->>'username',split_part(u.email,'@',1))
    into v_username from auth.users u where u.id=v_uid;
  end if;

  v_normalised := lower(regexp_replace(coalesce(v_username,''),'[^a-zA-Z0-9]','','g'));
  v_identity := lower(regexp_replace(coalesce(p_identity_key,''),'[^a-zA-Z0-9]','','g'));

  -- CovidPanda is the renamed LeMime account and must always use LeMime art.
  if v_normalised in ('covidpanda','lemime') or v_identity in ('covidpanda','lemime') then
    v_identity := 'lemime';
  end if;

  if v_identity = '' then
    select a.identity_key into v_identity
    from public.account_rename_aliases a
    where a.user_id=v_uid
    order by a.created_at asc
    limit 1;
    v_identity := coalesce(nullif(v_identity,''),v_normalised);
  end if;

  insert into public.tavern_shared_sessions(session_id,user_id,last_seen)
  values(trim(p_session_id),v_uid,now())
  on conflict(session_id) do update
    set user_id=excluded.user_id,last_seen=excluded.last_seen;

  select o.seat_id into v_seat
  from public.tavern_shared_occupants o
  where o.user_id=v_uid;

  if v_seat is null then
    select candidate into v_seat
    from unnest(v_seats) with ordinality as available(candidate,position)
    where not exists (
      select 1 from public.tavern_shared_occupants o
      where o.seat_id=available.candidate
    )
    order by position
    limit 1;
  end if;

  if v_seat is not null then
    insert into public.tavern_shared_occupants(
      user_id,username,identity_key,seat_id,joined_at,last_seen
    )
    values(v_uid,v_username,v_identity,v_seat,now(),now())
    on conflict(user_id) do update set
      username=excluded.username,
      identity_key=excluded.identity_key,
      last_seen=excluded.last_seen;
  end if;
end;
$$;

grant execute on function public.tavern_shared_heartbeat_v2(text,text,text) to authenticated;
