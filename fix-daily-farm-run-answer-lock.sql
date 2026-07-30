-- FIX DAILY FARM RUN ANSWER CHANGING MID-DAY
-- Run once in Supabase SQL Editor after uploading this build.
-- Locks one answer per UTC date so adding/removing words can never change an active puzzle.
-- Also recalculates today's tile colours against the locked answer.

create table if not exists public.runedle_puzzles (
  puzzle_date date primary key,
  answer text not null references public.runedle_words(word),
  created_at timestamptz not null default now()
);

alter table public.runedle_puzzles enable row level security;
revoke all on public.runedle_puzzles from anon, authenticated;

-- Preserve the original answer whenever somebody already solved today's puzzle.
-- Otherwise freeze the answer currently produced by the existing selector.
insert into public.runedle_puzzles(puzzle_date, answer)
select public.runedle_today(),
       coalesce(
         (
           select lower(a.guess)
           from public.runedle_attempts a
           where a.puzzle_date = public.runedle_today()
             and a.pattern = 'ggggg'
           order by a.attempt_no, a.created_at
           limit 1
         ),
         (
           select w.word
           from public.runedle_words w
           order by w.word
           offset ((('x'||substr(md5(public.runedle_today()::text),1,8))::bit(32)::bigint)
             % greatest((select count(*) from public.runedle_words),1))::integer
           limit 1
         )
       )
on conflict (puzzle_date) do nothing;

create or replace function public.runedle_answer(p_date date)
returns text
language plpgsql
volatile
security definer
set search_path=public
as $$
declare
  v_answer text;
begin
  select p.answer into v_answer
  from public.runedle_puzzles p
  where p.puzzle_date = p_date;

  if v_answer is null then
    select w.word into v_answer
    from public.runedle_words w
    order by w.word
    offset ((('x'||substr(md5(p_date::text),1,8))::bit(32)::bigint)
      % greatest((select count(*) from public.runedle_words),1))::integer
    limit 1;

    insert into public.runedle_puzzles(puzzle_date, answer)
    values (p_date, v_answer)
    on conflict (puzzle_date) do nothing;

    select p.answer into v_answer
    from public.runedle_puzzles p
    where p.puzzle_date = p_date;
  end if;

  return v_answer;
end;
$$;

-- Repair today's stored feedback so every green/yellow/grey tile matches the frozen answer.
update public.runedle_attempts a
set pattern = public.runedle_pattern(a.guess, public.runedle_answer(a.puzzle_date))
where a.puzzle_date = public.runedle_today();

-- If the repair reveals a legitimate solve that had previously received the failure reward,
-- pay only the missing difference. Never remove rewards already granted.
do $$
declare
  r record;
  v_reward public.runedle_rewards%rowtype;
begin
  for r in
    select a.user_id, a.puzzle_date,
           bool_or(a.pattern = 'ggggg') as solved,
           count(*)::int as attempts
    from public.runedle_attempts a
    where a.puzzle_date = public.runedle_today()
    group by a.user_id, a.puzzle_date
  loop
    select * into v_reward
    from public.runedle_rewards rw
    where rw.user_id = r.user_id and rw.puzzle_date = r.puzzle_date;

    if r.solved and v_reward.user_id is not null and not v_reward.solved then
      update public.runedle_rewards
      set solved = true,
          gp_awarded = 10000,
          farming_xp_awarded = 20000
      where user_id = r.user_id and puzzle_date = r.puzzle_date;

      update public.characters
      set gp = coalesce(gp,0) + 9000,
          farming_xp = least(13034431, coalesce(farming_xp,0) + 18000)
      where user_id = r.user_id;
    elsif r.solved and v_reward.user_id is null then
      insert into public.runedle_rewards(user_id,puzzle_date,solved,gp_awarded,farming_xp_awarded)
      values(r.user_id,r.puzzle_date,true,10000,20000);

      update public.characters
      set gp = coalesce(gp,0) + 10000,
          farming_xp = least(13034431, coalesce(farming_xp,0) + 20000)
      where user_id = r.user_id;
    end if;
  end loop;
end $$;

revoke execute on function public.runedle_answer(date) from public, anon, authenticated;
notify pgrst,'reload schema';
