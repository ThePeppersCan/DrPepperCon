-- Adds signed-in account names to the existing live Quidditch state RPC.
-- Run the updated add-live-quidditch-predictions.sql in Supabase to apply this change.
-- This marker file is included so the required deployment step is obvious.
notify pgrst,'reload schema';
