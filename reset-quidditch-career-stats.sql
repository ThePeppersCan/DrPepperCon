-- ONE-TIME RESET requested for Quidditch Mode career leaderboards.
-- Run this once in Supabase SQL Editor AFTER the main setup SQL.
begin;
truncate table public.quidditch_match_history;
truncate table public.quidditch_pet_career;
truncate table public.quidditch_team_career;
-- Start career tracking from the current match onward so old matches are not re-added.
insert into public.quidditch_match_history(match_id,left_name,right_name,left_score,right_score,roster,completed_at)
select floor(extract(epoch from clock_timestamp())/235)::bigint,
       public.quidditch_team_name(floor(extract(epoch from clock_timestamp())/235)::bigint,0),
       public.quidditch_team_name(floor(extract(epoch from clock_timestamp())/235)::bigint,1),0,0,'[]'::jsonb,clock_timestamp()
on conflict do nothing;
commit;
