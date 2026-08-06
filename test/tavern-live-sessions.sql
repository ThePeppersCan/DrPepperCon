-- Reliable, per-browser tavern presence. Completely separate from Quidditch.
create table if not exists public.tavern_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  identity_key text not null,
  last_seen timestamptz not null default now()
);

create index if not exists tavern_sessions_last_seen_idx
  on public.tavern_sessions(last_seen);

alter table public.tavern_sessions enable row level security;
-- Clients use the security-definer RPCs below rather than direct table access.
revoke all on public.tavern_sessions from anon, authenticated;

create or replace function public.tavern_session_heartbeat(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_identity text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(length(trim(p_session_id)),0) < 8 then
    raise exception 'Invalid tavern session';
  end if;

  select c.username into v_username
  from public.characters c
  where c.user_id = v_uid
  limit 1;

  if v_username is null then
    select coalesce(u.raw_user_meta_data->>'username', split_part(u.email,'@',1))
      into v_username
    from auth.users u where u.id=v_uid;
  end if;

  -- Preserve the original artwork identity after account renames.
  begin
    select a.identity_key into v_identity
    from public.account_rename_aliases a
    where a.user_id=v_uid
    order by a.created_at asc
    limit 1;
  exception when undefined_table then
    v_identity := null;
  end;

  v_identity := coalesce(nullif(v_identity,''), lower(regexp_replace(v_username,'[^a-zA-Z0-9]','','g')));
  if v_identity in ('covidpanda','lemime') then v_identity := 'lemime'; end if;

  insert into public.tavern_sessions(session_id,user_id,username,identity_key,last_seen)
  values(trim(p_session_id),v_uid,v_username,v_identity,now())
  on conflict(session_id) do update set
    user_id=excluded.user_id,
    username=excluded.username,
    identity_key=excluded.identity_key,
    last_seen=excluded.last_seen;
end;
$$;

create or replace function public.tavern_list_online()
returns table(user_id uuid, username text, identity_key text, last_seen timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tavern_sessions where tavern_sessions.last_seen < now()-interval '12 seconds';
  return query
  select s.user_id, max(s.username)::text, s.identity_key, max(s.last_seen)
  from public.tavern_sessions s
  where s.last_seen >= now()-interval '12 seconds'
  group by s.user_id,s.identity_key;
end;
$$;

create or replace function public.tavern_session_leave(p_session_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tavern_sessions
  where session_id=trim(p_session_id) and user_id=auth.uid();
$$;

grant execute on function public.tavern_session_heartbeat(text) to authenticated;
grant execute on function public.tavern_list_online() to authenticated;
grant execute on function public.tavern_session_leave(text) to authenticated;
