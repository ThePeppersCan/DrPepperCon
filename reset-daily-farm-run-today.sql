-- RESET TODAY'S DAILY FARM RUN FOR EVERYBODY
-- Run once in Supabase SQL Editor on the day you want to retest.
-- This clears today's guesses/results, rotates today's locked answer,
-- and keeps existing reward records so nobody can claim the daily payout twice.

begin;

-- Clear every player's attempts for the current UTC puzzle date.
delete from public.runedle_attempts
where puzzle_date = public.runedle_today();

-- Rotate the locked answer to a different valid word for fresh testing.
update public.runedle_puzzles p
set answer = (
  select w.word
  from public.runedle_words w
  where w.word <> p.answer
  order by md5(public.runedle_today()::text || ':retest:' || w.word)
  limit 1
),
created_at = now()
where p.puzzle_date = public.runedle_today();

-- If no puzzle row exists yet, create one.
insert into public.runedle_puzzles(puzzle_date, answer)
select public.runedle_today(), w.word
from public.runedle_words w
order by md5(public.runedle_today()::text || ':retest:new:' || w.word)
limit 1
on conflict (puzzle_date) do nothing;

commit;
notify pgrst, 'reload schema';
