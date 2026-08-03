-- Shared, server-owned tavern state.
-- Run this once in Supabase SQL Editor after the earlier rename SQL.

create table if not exists public.tavern_shared_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create table if not exists public.tavern_shared_occupants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  identity_key text not null,
  seat_id text not null unique,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists tavern_shared_sessions_seen_idx
  on public.tavern_shared_sessions(last_seen);
create index if not exists tavern_shared_occupants_seen_idx
  on public.tavern_shared_occupants(last_seen);

alter table public.tavern_shared_sessions enable row level security;
alter table public.tavern_shared_occupants enable row level security;
revoke all on public.tavern_shared_sessions from anon, authenticated;
revoke all on public.tavern_shared_occupants from anon, authenticated;

create or replace function public.tavern_shared_cleanup()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.tavern_shared_sessions
  where last_seen < now() - interval '8 seconds';

  delete from public.tavern_shared_occupants o
  where not exists (
    select 1 from public.tavern_shared_sessions s
    where s.user_id=o.user_id
  );
end;
$$;

create or replace function public.tavern_shared_heartbeat(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_identity text;
  v_seat text;
  v_seats text[] := array[
    'sofa-left','sofa-left-centre','sofa-right-centre',
    'sofa-right','armchair-left','armchair-right'
  ];
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if coalesce(length(trim(p_session_id)),0) < 8 then raise exception 'Invalid tavern session'; end if;

  -- Serialize seat assignment so two simultaneous sign-ins cannot take one seat.
  perform pg_advisory_xact_lock(91827461);
  perform public.tavern_shared_cleanup();

  select c.username into v_username
  from public.characters c
  where c.user_id=v_uid
  limit 1;

  if v_username is null then
    select coalesce(u.raw_user_meta_data->>'username',split_part(u.email,'@',1))
    into v_username from auth.users u where u.id=v_uid;
  end if;

  select a.identity_key into v_identity
  from public.account_rename_aliases a
  where a.user_id=v_uid
  order by a.created_at asc
  limit 1;

  v_identity := coalesce(nullif(v_identity,''),lower(regexp_replace(v_username,'[^a-zA-Z0-9]','','g')));
  if lower(regexp_replace(v_username,'[^a-zA-Z0-9]','','g')) in ('covidpanda','lemime') then
    v_identity := 'lemime';
  end if;

  insert into public.tavern_shared_sessions(session_id,user_id,last_seen)
  values(trim(p_session_id),v_uid,now())
  on conflict(session_id) do update set user_id=excluded.user_id,last_seen=excluded.last_seen;

  select o.seat_id into v_seat
  from public.tavern_shared_occupants o
  where o.user_id=v_uid;

  if v_seat is null then
    select candidate into v_seat
    from unnest(v_seats) with ordinality as available(candidate,position)
    where not exists (
      select 1 from public.tavern_shared_occupants o where o.seat_id=available.candidate
    )
    order by position
    limit 1;
  end if;

  -- There are currently six physical seats. Unsupported/no-seat accounts stay
  -- online without being rendered until another seat becomes free.
  if v_seat is not null then
    insert into public.tavern_shared_occupants(user_id,username,identity_key,seat_id,joined_at,last_seen)
    values(v_uid,v_username,v_identity,v_seat,now(),now())
    on conflict(user_id) do update set
      username=excluded.username,
      identity_key=excluded.identity_key,
      last_seen=excluded.last_seen;
  end if;
end;
$$;

create or replace function public.tavern_shared_list()
returns table(
  user_id uuid,
  username text,
  identity_key text,
  seat_id text,
  joined_at timestamptz,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform pg_advisory_xact_lock(91827461);
  perform public.tavern_shared_cleanup();
  return query
  select o.user_id,o.username,o.identity_key,o.seat_id,o.joined_at,o.last_seen
  from public.tavern_shared_occupants o
  order by o.joined_at,o.identity_key;
end;
$$;

create or replace function public.tavern_shared_leave(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  perform pg_advisory_xact_lock(91827461);
  delete from public.tavern_shared_sessions
  where session_id=trim(p_session_id) and user_id=v_uid;
  delete from public.tavern_shared_occupants o
  where o.user_id=v_uid
    and not exists(select 1 from public.tavern_shared_sessions s where s.user_id=v_uid);
end;
$$;

grant execute on function public.tavern_shared_heartbeat(text) to authenticated;
grant execute on function public.tavern_shared_list() to anon, authenticated;
grant execute on function public.tavern_shared_leave(text) to authenticated;
