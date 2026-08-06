-- REPO COMPANY — KEEP FIVE VISIBLE DAILY/GLOBAL LEADERBOARD PLAYERS
-- Run once in Supabase -> SQL Editor.
--
-- The website hides the account named "Admin". The existing leaderboard RPCs
-- only return five rows, so filtering Admin in the browser can leave four.
-- This safely expands each existing RPC to return six rows; the website then
-- removes Admin and displays the first five real players.

DO $repo_fix$
DECLARE
  function_name text;
  function_oid regprocedure;
  original_definition text;
  patched_definition text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.get_daily_xp_leaderboard()',
    'public.get_global_xp_leaderboard()'
  ]
  LOOP
    function_oid := to_regprocedure(function_name);

    IF function_oid IS NULL THEN
      RAISE EXCEPTION 'Required function % was not found. Install the original leaderboard SQL first.', function_name;
    END IF;

    original_definition := pg_get_functiondef(function_oid);
    patched_definition := regexp_replace(
      original_definition,
      'limit[[:space:]]+5',
      'LIMIT 6',
      'gi'
    );

    IF patched_definition = original_definition THEN
      RAISE EXCEPTION 'Could not locate LIMIT 5 inside %. No changes were made to that function.', function_name;
    END IF;

    EXECUTE patched_definition;
    RAISE NOTICE 'Updated % to return six candidates before Admin is filtered.', function_name;
  END LOOP;
END
$repo_fix$;
