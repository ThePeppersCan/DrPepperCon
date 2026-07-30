-- DAILY FARM RUN UPGRADE
-- Run once in Supabase SQL Editor after uploading the site.
-- Preserves all existing Rune-Dle attempts, accounts, GP and XP.

alter table public.characters
  add column if not exists farming_xp integer not null default 0;

update public.characters
set farming_xp = least(13034431, greatest(0, coalesce(farming_xp,0)));

create table if not exists public.runedle_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_date date not null,
  solved boolean not null,
  gp_awarded integer not null,
  farming_xp_awarded integer not null,
  awarded_at timestamptz not null default now(),
  primary key(user_id,puzzle_date)
);
alter table public.runedle_rewards enable row level security;
revoke all on public.runedle_rewards from anon, authenticated;


-- Base Daily Rune-Dle tables, word list and helper functions.
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
  ('zaros'),
  ('armor'),
  ('arena'),
  ('badge'),
  ('basic'),
  ('batch'),
  ('blink'),
  ('block'),
  ('bonus'),
  ('bossy'),
  ('bount'),
  ('build'),
  ('class'),
  ('combo'),
  ('craft'),
  ('crits'),
  ('daily'),
  ('dodge'),
  ('drops'),
  ('elite'),
  ('evade'),
  ('event'),
  ('farms'),
  ('fangs'),
  ('fight'),
  ('gamer'),
  ('grind'),
  ('heals'),
  ('items'),
  ('level'),
  ('lucky'),
  ('raids'),
  ('reset'),
  ('skill'),
  ('spawn'),
  ('stats'),
  ('tanky'),
  ('trade'),
  ('train'),
  ('vault'),
  ('world'),
  ('brand'),
  ('cross'),
  ('curse'),
  ('flail'),
  ('lance'),
  ('mauls'),
  ('pikes'),
  ('saber'),
  ('sling'),
  ('auras'),
  ('charm'),
  ('druid'),
  ('elven'),
  ('faery'),
  ('flame'),
  ('frost'),
  ('glyph'),
  ('hexes'),
  ('power'),
  ('runic'),
  ('storm'),
  ('wards'),
  ('angel'),
  ('boars'),
  ('drake'),
  ('gnoll'),
  ('hydra'),
  ('mimic'),
  ('pixie'),
  ('slime'),
  ('wyrms'),
  ('biome'),
  ('coast'),
  ('delve'),
  ('haven'),
  ('isles'),
  ('marsh'),
  ('mines'),
  ('realm'),
  ('ruins'),
  ('sewer'),
  ('trail'),
  ('woods'),
  ('baggy'),
  ('elixr'),
  ('flask'),
  ('jewel'),
  ('pouch'),
  ('rings'),
  ('robes'),
  ('tonic'),
  ('smith'),
  ('group'),
  ('rival'),
  ('squad'),
  ('patch'),
  ('specs'),
  ('words'),
  ('brave'),
  ('dream'),
  ('glory'),
  ('honor'),
  ('rogue'),
  ('royal'),
  ('acoly'),
  ('actor'),
  ('aegis'),
  ('amber'),
  ('anima'),
  ('atlas'),
  ('blaze'),
  ('brute'),
  ('burst'),
  ('cairn'),
  ('chief'),
  ('coral'),
  ('coven'),
  ('creep'),
  ('ember'),
  ('enemy'),
  ('fetch'),
  ('guard'),
  ('heavy'),
  ('horde'),
  ('karma'),
  ('magma'),
  ('mount'),
  ('ocean'),
  ('titan'),
  ('arise'),
  ('diver'),
  ('acted'),
  ('agent'),
  ('alert'),
  ('blast'),
  ('bleed'),
  ('boost'),
  ('bound'),
  ('break'),
  ('brews'),
  ('campy'),
  ('chant'),
  ('clash'),
  ('climb'),
  ('clone'),
  ('dance'),
  ('drain'),
  ('duels'),
  ('feast'),
  ('focus'),
  ('haste'),
  ('joust'),
  ('lobby'),
  ('merge'),
  ('myths'),
  ('nerfs'),
  ('phase'),
  ('prize'),
  ('procs'),
  ('ranks'),
  ('rifts'),
  ('roles'),
  ('round'),
  ('siege'),
  ('skins'),
  ('slots'),
  ('sneak'),
  ('stage'),
  ('stuns'),
  ('taunt'),
  ('teams'),
  ('token'),
  ('waves')
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


-- Daily reset is exactly 00:00 UTC.
create or replace function public.runedle_today() returns date
language sql stable as $$ select (now() at time zone 'UTC')::date $$;

-- Replace RPCs with reward-aware versions.

drop function if exists public.submit_runedle_guess(text);
create function public.submit_runedle_guess(p_guess text)
returns table(
  attempt_no int, guess text, pattern text, solved boolean, finished boolean,
  reward_gp int, reward_farming_xp int, new_gp bigint, new_farming_xp int
)
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); d date:=public.runedle_today();
  g text:=lower(btrim(p_guess)); a text; n int; pat text;
  already_solved boolean; did_finish boolean; v_gp int:=0; v_xp int:=0;
  inserted_count int:=0; c public.characters%rowtype;
begin
  if uid is null then raise exception 'Log in to complete the Daily Farm Run.'; end if;
  if g !~ '^[a-z]{5}$' or not exists(select 1 from public.runedle_words w where w.word=g) then
    raise exception 'That word is not in the Daily Farm Run list.';
  end if;
  select * into c from public.characters where user_id=uid for update;
  if c.id is null then raise exception 'Character not found.'; end if;
  a:=public.runedle_answer(d);
  select exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.pattern='ggggg') into already_solved;
  if already_solved then raise exception 'You already completed today''s Farm Run.'; end if;
  select count(*) into n from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d;
  if n>=5 then raise exception 'You have already used all five attempts today.'; end if;
  if exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.guess=g) then raise exception 'You already tried that word.'; end if;
  n:=n+1; pat:=public.runedle_pattern(g,a); did_finish:=(pat='ggggg' or n>=5);
  insert into public.runedle_attempts(user_id,puzzle_date,attempt_no,guess,pattern) values(uid,d,n,g,pat);
  if did_finish then
    if pat='ggggg' then v_gp:=10000;v_xp:=20000; else v_gp:=1000;v_xp:=2000; end if;
    insert into public.runedle_rewards(user_id,puzzle_date,solved,gp_awarded,farming_xp_awarded)
    values(uid,d,pat='ggggg',v_gp,v_xp) on conflict do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count=1 then
      update public.characters ch set gp=coalesce(ch.gp,0)+v_gp,
        farming_xp=least(13034431,coalesce(ch.farming_xp,0)+v_xp)
      where ch.user_id=uid returning * into c;
    else
      v_gp:=0;v_xp:=0;
      select * into c from public.characters where user_id=uid;
    end if;
  end if;
  return query select n,g,pat,(pat='ggggg'),did_finish,v_gp,v_xp,coalesce(c.gp,0),coalesce(c.farming_xp,0);
end $$;

drop function if exists public.get_my_runedle_state();
create function public.get_my_runedle_state()
returns table(puzzle_date date,attempts jsonb,solved boolean,finished boolean,answer text,current_streak int,best_streak int)
language sql security definer set search_path=public as $$
with info as(select auth.uid() uid,public.runedle_today() d), a as(
 select coalesce(jsonb_agg(jsonb_build_object('attempt_no',x.attempt_no,'guess',upper(x.guess),'pattern',x.pattern) order by x.attempt_no) filter(where x.attempt_no is not null),'[]'::jsonb) attempts,
 coalesce(bool_or(x.pattern='ggggg'),false) solved,count(x.attempt_no) n
 from info left join public.runedle_attempts x on x.user_id=info.uid and x.puzzle_date=info.d
), solved_days as(
 select puzzle_date, puzzle_date-row_number() over(order by puzzle_date)::int grp
 from public.runedle_rewards r,info where r.user_id=info.uid and r.solved
), streaks as(select min(puzzle_date) first_day,max(puzzle_date) last_day,count(*)::int len from solved_days group by grp), stats as(
 select coalesce(max(len),0)::int best,
 coalesce(max(len) filter(where last_day in ((select d from info),(select d-1 from info))),0)::int current from streaks
)
select info.d,a.attempts,a.solved,(a.solved or a.n>=5),case when (a.solved or a.n>=5) then upper(public.runedle_answer(info.d)) else null end,stats.current,stats.best
from info,a,stats $$;

-- Return Farming in signed-in and public profiles.
drop function if exists public.get_my_character();
create function public.get_my_character()
returns table(username text,woodcutting_xp integer,mining_xp integer,fishing_xp integer,agility_xp integer,slayer_xp integer,attack_xp integer,strength_xp integer,defence_xp integer,magic_xp integer,ranged_xp integer,sailing_xp integer,runecrafting_xp integer,cooking_xp integer,farming_xp integer,agility_best_ms integer,collection text[],created_at timestamptz)
language sql security definer set search_path=public as $$
select c.username,coalesce(c.woodcutting_xp,0),coalesce(c.mining_xp,0),coalesce(c.fishing_xp,0),coalesce(c.agility_xp,0),coalesce(c.slayer_xp,0),coalesce(c.attack_xp,0),coalesce(c.strength_xp,0),coalesce(c.defence_xp,0),coalesce(c.magic_xp,0),coalesce(c.ranged_xp,0),coalesce(c.sailing_xp,0),coalesce(c.runecrafting_xp,0),coalesce(c.cooking_xp,0),coalesce(c.farming_xp,0),c.agility_best_ms,coalesce(c.collection,array[]::text[]),c.created_at from public.characters c where c.user_id=auth.uid() limit 1 $$;

drop function if exists public.get_public_character(text);
create function public.get_public_character(p_username text)
returns table(username text,woodcutting_xp integer,mining_xp integer,fishing_xp integer,agility_xp integer,slayer_xp integer,attack_xp integer,strength_xp integer,defence_xp integer,magic_xp integer,ranged_xp integer,sailing_xp integer,runecrafting_xp integer,cooking_xp integer,farming_xp integer,agility_best_ms integer,collection text[],created_at timestamptz)
language sql security definer set search_path=public as $$
select c.username,coalesce(c.woodcutting_xp,0),coalesce(c.mining_xp,0),coalesce(c.fishing_xp,0),coalesce(c.agility_xp,0),coalesce(c.slayer_xp,0),coalesce(c.attack_xp,0),coalesce(c.strength_xp,0),coalesce(c.defence_xp,0),coalesce(c.magic_xp,0),coalesce(c.ranged_xp,0),coalesce(c.sailing_xp,0),coalesce(c.runecrafting_xp,0),coalesce(c.cooking_xp,0),coalesce(c.farming_xp,0),c.agility_best_ms,coalesce(c.collection,array[]::text[]),c.created_at from public.characters c where lower(c.username)=lower(btrim(p_username)) limit 1 $$;

create or replace function public.get_leaderboard()
returns table(username text,total_level integer)
language sql security definer set search_path=public as $$
select c.username,(public.level_from_xp(coalesce(c.woodcutting_xp,0))+public.level_from_xp(coalesce(c.mining_xp,0))+public.level_from_xp(coalesce(c.fishing_xp,0))+public.level_from_xp(coalesce(c.agility_xp,0))+public.level_from_xp(coalesce(c.slayer_xp,0))+public.level_from_xp(coalesce(c.attack_xp,0))+public.level_from_xp(coalesce(c.strength_xp,0))+public.level_from_xp(coalesce(c.defence_xp,0))+public.level_from_xp(coalesce(c.magic_xp,0))+public.level_from_xp(coalesce(c.ranged_xp,0))+public.level_from_xp(coalesce(c.sailing_xp,0))+public.level_from_xp(coalesce(c.runecrafting_xp,0))+public.level_from_xp(coalesce(c.cooking_xp,0))+public.level_from_xp(coalesce(c.farming_xp,0)))::int total_level
from public.characters c order by total_level desc,c.username asc limit 100 $$;

grant execute on function public.submit_runedle_guess(text) to authenticated;
grant execute on function public.get_my_runedle_state() to authenticated;
grant execute on function public.get_daily_runedle_results() to anon,authenticated;
grant execute on function public.get_my_character() to authenticated;
grant execute on function public.get_public_character(text) to anon,authenticated;
grant execute on function public.get_leaderboard() to anon,authenticated;
notify pgrst,'reload schema';

-- Lock each UTC day's answer permanently. This prevents word-list updates from changing a live puzzle.
create table if not exists public.runedle_puzzles (
  puzzle_date date primary key,
  answer text not null references public.runedle_words(word),
  created_at timestamptz not null default now()
);
alter table public.runedle_puzzles enable row level security;
revoke all on public.runedle_puzzles from anon, authenticated;

create or replace function public.runedle_answer(p_date date)
returns text language plpgsql volatile security definer set search_path=public as $$
declare v_answer text;
begin
  select answer into v_answer from public.runedle_puzzles where puzzle_date=p_date;
  if v_answer is null then
    select word into v_answer from public.runedle_words order by word
    offset ((('x'||substr(md5(p_date::text),1,8))::bit(32)::bigint) % greatest((select count(*) from public.runedle_words),1))::integer limit 1;
    insert into public.runedle_puzzles(puzzle_date,answer) values(p_date,v_answer) on conflict(puzzle_date) do nothing;
    select answer into v_answer from public.runedle_puzzles where puzzle_date=p_date;
  end if;
  return v_answer;
end $$;
revoke execute on function public.runedle_answer(date) from public,anon,authenticated;
notify pgrst,'reload schema';
