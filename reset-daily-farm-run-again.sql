-- RESET TODAY'S DAILY FARM RUN FOR EVERYBODY AGAIN
-- Run once in Supabase SQL Editor on 2026-07-30 for another clean test.
-- Clears today's attempts/results and rotates the locked answer.
-- Existing reward records stay in place so this cannot pay the daily reward twice.

begin;

delete from public.runedle_attempts
where puzzle_date = public.runedle_today();

update public.runedle_puzzles p
set answer = (
  select w.word
  from public.runedle_words w
  where w.word <> p.answer
  order by md5(clock_timestamp()::text || ':keyboard-retest:' || w.word)
  limit 1
),
created_at = now()
where p.puzzle_date = public.runedle_today();

insert into public.runedle_puzzles(puzzle_date, answer)
select public.runedle_today(), w.word
from public.runedle_words w
order by md5(clock_timestamp()::text || ':keyboard-retest:new:' || w.word)
limit 1
on conflict (puzzle_date) do nothing;

commit;
notify pgrst, 'reload schema';
