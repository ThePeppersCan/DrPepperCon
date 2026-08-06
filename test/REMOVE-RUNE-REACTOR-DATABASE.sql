-- REMOVE RUNE REACTOR DATABASE OBJECTS
-- Run this once only if rune-reactor.sql was previously installed.
-- This intentionally removes only the dedicated Rune Reactor functions,
-- tables and their stored Rune Reactor run/leaderboard data.

begin;

drop function if exists public.start_rune_reactor_run();
drop function if exists public.submit_rune_reactor_run(uuid, bigint, integer, integer);
drop function if exists public.get_rune_reactor_leaderboard();

drop table if exists public.rune_reactor_sessions;
drop table if exists public.rune_reactor_scores;

commit;
