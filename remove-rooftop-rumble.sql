-- REPO COMPANY: COMPLETE ROOFTOP RUMBLE DATABASE REVERT
-- Run once in Supabase -> SQL Editor.
-- Removes only the database objects introduced by add-rooftop-rumble.sql.

drop function if exists public.complete_rooftop_rumble(integer, integer, integer, integer, integer);
drop function if exists public.get_rooftop_rumble_leaderboard();
drop table if exists public.rooftop_rumble_scores;

-- bank_items is intentionally preserved because it existed before this update
-- and is used by the site's bank, packs, cosmetics and other rewards.
notify pgrst, 'reload schema';
