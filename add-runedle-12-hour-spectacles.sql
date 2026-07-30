-- RUNE-DLE: 12-HOUR RESET + ODD SPECTACLES ACHIEVEMENT
-- Run once in Supabase SQL Editor after uploading this build.

alter table public.characters
  add column if not exists achievements jsonb not null default '{}'::jsonb,
  add column if not exists bank_items jsonb not null default '{}'::jsonb,
  add column if not exists equipped_pet_cosmetic text;

-- Represent each 12-hour UTC window as a unique synthetic date key.
create or replace function public.runedle_today() returns date
language sql stable as $$
  select date '2000-01-01' + floor(extract(epoch from now()) / 43200)::integer
$$;

-- Reward-aware submit function with one-time Rune-Dle achievement unlock.
drop function if exists public.submit_runedle_guess(text);
create function public.submit_runedle_guess(p_guess text)
returns table(
  attempt_no int, guess text, pattern text, solved boolean, finished boolean,
  reward_gp int, reward_farming_xp int, new_gp bigint, new_farming_xp int,
  achievements jsonb, achievement_unlocked boolean
)
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); d date:=public.runedle_today();
  g text:=lower(btrim(p_guess)); a text; n int; pat text;
  already_solved boolean; did_finish boolean; v_gp int:=0; v_xp int:=0;
  inserted_count int:=0; c public.characters%rowtype; v_unlock boolean:=false;
begin
  if uid is null then raise exception 'Log in to complete the Daily Farm Run.'; end if;
  if g !~ '^[a-z]{5}$' or not exists(select 1 from public.runedle_words w where w.word=g) then raise exception 'That word is not in the Daily Farm Run list.'; end if;
  select * into c from public.characters where user_id=uid for update;
  if c.id is null then raise exception 'Character not found.'; end if;
  a:=public.runedle_answer(d);
  select exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.pattern='ggggg') into already_solved;
  if already_solved then raise exception 'You already completed this Farm Run.'; end if;
  select count(*) into n from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d;
  if n>=5 then raise exception 'You have already used all five attempts this Farm Run.'; end if;
  if exists(select 1 from public.runedle_attempts x where x.user_id=uid and x.puzzle_date=d and x.guess=g) then raise exception 'You already tried that word.'; end if;
  n:=n+1; pat:=public.runedle_pattern(g,a); did_finish:=(pat='ggggg' or n>=5);
  insert into public.runedle_attempts(user_id,puzzle_date,attempt_no,guess,pattern) values(uid,d,n,g,pat);
  if did_finish then
    if pat='ggggg' then v_gp:=10000;v_xp:=20000; else v_gp:=1000;v_xp:=2000; end if;
    insert into public.runedle_rewards(user_id,puzzle_date,solved,gp_awarded,farming_xp_awarded)
    values(uid,d,pat='ggggg',v_gp,v_xp) on conflict do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count=1 then
      v_unlock := pat='ggggg' and not (coalesce(c.achievements,'{}'::jsonb) ? 'runedle_success');
      update public.characters ch set
        gp=coalesce(ch.gp,0)+v_gp,
        farming_xp=least(13034431,coalesce(ch.farming_xp,0)+v_xp),
        achievements=case when v_unlock then jsonb_set(coalesce(ch.achievements,'{}'::jsonb),'{runedle_success}','true'::jsonb,true) else coalesce(ch.achievements,'{}'::jsonb) end,
        bank_items=case when v_unlock then jsonb_set(coalesce(ch.bank_items,'{}'::jsonb),'{odd_spectacles}','1'::jsonb,true) else coalesce(ch.bank_items,'{}'::jsonb) end
      where ch.user_id=uid returning * into c;
    else
      v_gp:=0;v_xp:=0; select * into c from public.characters where user_id=uid;
    end if;
  end if;
  return query select n,g,pat,(pat='ggggg'),did_finish,v_gp,v_xp,coalesce(c.gp,0),coalesce(c.farming_xp,0),coalesce(c.achievements,'{}'::jsonb),v_unlock;
end $$;

create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_active_pet text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_cosmetic is not null and p_cosmetic not in ('chefs_hat','fire_cape','odd_spectacles') then raise exception 'Unsupported pet cosmetic'; end if;
  select coalesce(c.bank_items,'{}'::jsonb),c.active_pet into v_items,v_active_pet from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_cosmetic is not null and coalesce((v_items->>p_cosmetic)::integer,0)<1 then raise exception 'That cosmetic is not in your Bank'; end if;
  update public.characters c set equipped_pet_cosmetic=p_cosmetic where c.user_id=auth.uid();
  return query select p_cosmetic;
end $$;

revoke all on function public.submit_runedle_guess(text) from public;
revoke all on function public.set_pet_cosmetic(text) from public;
grant execute on function public.submit_runedle_guess(text) to authenticated;
grant execute on function public.set_pet_cosmetic(text) to authenticated;
notify pgrst,'reload schema';
