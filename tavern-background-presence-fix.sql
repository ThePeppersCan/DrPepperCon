-- Keeps signed-in tavern characters present while a browser tab is minimised.
-- Run once in the Supabase SQL Editor.
-- The browser now sends heartbeats from a Web Worker every five seconds. This
-- 45-second grace period prevents normal background-tab throttling from making
-- a character falsely leave, while genuinely closed sessions still expire.

create or replace function public.tavern_shared_cleanup()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.tavern_shared_sessions
  where last_seen < now() - interval '45 seconds';

  delete from public.tavern_shared_occupants o
  where not exists (
    select 1 from public.tavern_shared_sessions s
    where s.user_id=o.user_id
  );
end;
$$;
