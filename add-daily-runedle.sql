-- Daily Rune-Dle: run once in Supabase SQL Editor.

create table if not exists public.runedle_words (
  word text primary key check (word ~ '^[a-z]{5}$')
);
insert into public.runedle_words(word) values
  ('abbey'),
  ('abyss'),
  ('acorn'),
  ('adept'),
  ('aggie'),
  ('aggro'),
  ('airut'),
  ('altar'),
  ('ankou'),
  ('anvil'),
  ('ardou'),
  ('arrow'),
  ('asgyn'),
  ('ashes'),
  ('bacon'),
  ('bagel'),
  ('baler'),
  ('barbs'),
  ('barge'),
  ('baron'),
  ('basil'),
  ('batta'),
  ('bears'),
  ('beast'),
  ('berry'),
  ('black'),
  ('blade'),
  ('bless'),
  ('blood'),
  ('blunt'),
  ('bolts'),
  ('bones'),
  ('boots'),
  ('bowfa'),
  ('brawl'),
  ('bread'),
  ('briar'),
  ('brine'),
  ('broad'),
  ('burgh'),
  ('burnt'),
  ('cabin'),
  ('cache'),
  ('camel'),
  ('canif'),
  ('canoe'),
  ('capes'),
  ('caves'),
  ('chain'),
  ('chaos'),
  ('chest'),
  ('claws'),
  ('cloak'),
  ('coals'),
  ('coins'),
  ('crate'),
  ('crawl'),
  ('crown'),
  ('crude'),
  ('crypt'),
  ('dagga'),
  ('dairy'),
  ('darts'),
  ('death'),
  ('demon'),
  ('dhide'),
  ('dough'),
  ('drayn'),
  ('dwarf'),
  ('eagle'),
  ('earth'),
  ('elder'),
  ('emote'),
  ('equip'),
  ('fairy'),
  ('falad'),
  ('felix'),
  ('ferox'),
  ('fiend'),
  ('fires'),
  ('flesh'),
  ('flint'),
  ('flite'),
  ('forge'),
  ('fremy'),
  ('games'),
  ('ghost'),
  ('giant'),
  ('gnome'),
  ('golem'),
  ('grace'),
  ('grave'),
  ('green'),
  ('grimy'),
  ('guild'),
  ('hally'),
  ('harpy'),
  ('helms'),
  ('herbs'),
  ('hound'),
  ('house'),
  ('ibans'),
  ('infer'),
  ('irons'),
  ('jagex'),
  ('jatis'),
  ('javel'),
  ('jelly'),
  ('karam'),
  ('kebab'),
  ('kings'),
  ('knife'),
  ('lamps'),
  ('lavae'),
  ('leafs'),
  ('light'),
  ('longs'),
  ('lunar'),
  ('maces'),
  ('magic'),
  ('maple'),
  ('masks'),
  ('melee'),
  ('mossy'),
  ('nails'),
  ('nieve'),
  ('night'),
  ('ninja'),
  ('noose'),
  ('ogres'),
  ('osman'),
  ('paddy'),
  ('panic'),
  ('paper'),
  ('party'),
  ('plank'),
  ('quest'),
  ('relic'),
  ('runes'),
  ('sabre'),
  ('scape'),
  ('seers'),
  ('shade'),
  ('shard'),
  ('shark'),
  ('sheep'),
  ('skull'),
  ('smoke'),
  ('snake'),
  ('snare'),
  ('spear'),
  ('spell'),
  ('staff'),
  ('steel'),
  ('stews'),
  ('stone'),
  ('swamp'),
  ('sword'),
  ('talon'),
  ('taver'),
  ('tears'),
  ('thief'),
  ('toads'),
  ('torag'),
  ('tower'),
  ('traps'),
  ('troll'),
  ('ulric'),
  ('vials'),
  ('vorki'),
  ('water'),
  ('whale'),
  ('white'),
  ('witch'),
  ('xeric'),
  ('zamor'),
  ('zaros')
on conflict (word) do nothing;

create table if not exists public.runedle_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_date date not null,
  attempt_no smallint not null check (attempt_no between 1 and 5),
  guess text not null check (guess ~ '^[a-z]{5}$'),
  pattern text not null check (pattern ~ '^[gyb]{5}$'),
  created_at timestamptz not null default now(),
  primary key (user_id,puzzle_date,attempt_no),
  unique (user_id,puzzle_date,guess)
);
alter table public.runedle_words enable row level security;
alter table public.runedle_attempts enable row level security;
revoke all on public.runedle_words from anon, authenticated;
revoke all on public.runedle_attempts from anon, authenticated;

create or replace function public.runedle_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/London')::date $$;

create or replace function public.runedle_answer(p_date date) returns text
language sql stable security definer set search_path=public as $$
  select word from public.runedle_words
  order by word
  offset ((('x'||substr(md5(p_date::text),1,8))::bit(32)::bigint) % greatest((select count(*) from public.runedle_words),1))::integer
  limit 1
$$;

create or replace function public.runedle_pattern(p_guess text,p_answer text) returns text
language plpgsql immutable as $$
declare result text[]:=array['b','b','b','b','b']; used boolean[]:=array[false,false,false,false,false]; i int; j int;
begin
  for i in 1..5 loop if substr(p_guess,i,1)=substr(p_answer,i,1) then result[i]:='g';used[i]:=true;end if;end loop;
  for i in 1..5 loop
    if result[i]='b' then
      for j in 1..5 loop
        if not used[j] and substr(p_guess,i,1)=substr(p_answer,j,1) then result[i]:='y';used[j]:=true;exit;end if;
      end loop;
    end if;
  end loop;
  return array_to_string(result,'');
end $$;

create or replace function public.submit_runedle_guess(p_guess text)
returns table(attempt_no int,guess text,pattern text,solved boolean,finished boolean)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); d date:=public.runedle_today(); g text:=lower(btrim(p_guess)); a text; n int; pat text; already_solved boolean;
begin
  if uid is null then raise exception 'Log in to play Daily Rune-Dle.';end if;
  if g !~ '^[a-z]{5}$' or not exists(select 1 from public.runedle_words w where w.word=g) then raise exception 'That word is not in the Rune-Dle list.';end if;
  a:=public.runedle_answer(d);
  select exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.pattern='ggggg') into already_solved;
  if already_solved then raise exception 'You already solved today''s Rune-Dle.';end if;
  select count(*) into n from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d;
  if n>=5 then raise exception 'You have used all five attempts today.';end if;
  if exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.guess=g) then raise exception 'You already tried that word.';end if;
  n:=n+1;pat:=public.runedle_pattern(g,a);
  insert into public.runedle_attempts(user_id,puzzle_date,attempt_no,guess,pattern) values(uid,d,n,g,pat);
  return query select n,g,pat,(pat='ggggg'),(pat='ggggg' or n>=5);
end $$;

create or replace function public.get_my_runedle_state()
returns table(puzzle_date date,attempts jsonb,solved boolean,finished boolean,answer text)
language sql security definer set search_path=public as $$
with info as(select auth.uid() uid,public.runedle_today() d), a as(
 select coalesce(jsonb_agg(jsonb_build_object('attempt_no',x.attempt_no,'guess',upper(x.guess),'pattern',x.pattern) order by x.attempt_no),'[]'::jsonb) attempts,
 coalesce(bool_or(x.pattern='ggggg'),false) solved,count(x.*) n from info left join public.runedle_attempts x on x.user_id=info.uid and x.puzzle_date=info.d
) select info.d,a.attempts,a.solved,(a.solved or a.n>=5),case when (a.solved or a.n>=5) then upper(public.runedle_answer(info.d)) else null end from info,a $$;

create or replace function public.get_daily_runedle_results()
returns table(username text,attempts int,status text)
language sql security definer set search_path=public as $$
 select c.username,count(x.*)::int,case when bool_or(x.pattern='ggggg') then 'solved' when count(x.*)>=5 then 'failed' else 'playing' end
 from public.runedle_attempts x join public.characters c on c.user_id=x.user_id
 where x.puzzle_date=public.runedle_today() group by c.username
 order by case when bool_or(x.pattern='ggggg') then 0 when count(x.*)>=5 then 2 else 1 end,count(x.*),lower(c.username) $$;

grant execute on function public.get_my_runedle_state() to authenticated;
grant execute on function public.submit_runedle_guess(text) to authenticated;
grant execute on function public.get_daily_runedle_results() to anon,authenticated;

-- Keep the hidden answer selector server-only.
revoke execute on function public.runedle_answer(date) from public, anon, authenticated;
revoke execute on function public.runedle_pattern(text,text) from public, anon, authenticated;
