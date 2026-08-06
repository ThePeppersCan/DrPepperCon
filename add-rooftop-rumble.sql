-- REPO COMPANY: ROOFTOP RUMBLE
-- Run once in Supabase -> SQL Editor.
-- Adds secure Agility XP/Marks rewards and a public Rooftop Rumble leaderboard.

alter table public.characters
  add column if not exists bank_items jsonb not null default '{}'::jsonb;

create table if not exists public.rooftop_rumble_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  best_score integer not null default 0 check (best_score >= 0),
  best_distance integer not null default 0 check (best_distance >= 0),
  best_combo integer not null default 0 check (best_combo >= 0),
  runs integer not null default 0 check (runs >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rooftop_rumble_scores enable row level security;
drop policy if exists "Anyone can read Rooftop Rumble scores" on public.rooftop_rumble_scores;
create policy "Anyone can read Rooftop Rumble scores"
  on public.rooftop_rumble_scores
  for select
  to anon, authenticated
  using (true);

create or replace function public.get_rooftop_rumble_leaderboard()
returns table(
  username text,
  best_score integer,
  best_distance integer,
  best_combo integer
)
language sql
security definer
set search_path = public
as $$
  select r.username, r.best_score, r.best_distance, r.best_combo
  from public.rooftop_rumble_scores r
  where lower(r.username) <> 'admin'
  order by r.best_score desc, r.best_distance desc, r.best_combo desc, r.updated_at asc
  limit 10;
$$;

create or replace function public.complete_rooftop_rumble(
  p_score integer,
  p_distance integer,
  p_marks integer,
  p_max_combo integer,
  p_duration_ms integer
)
returns table(
  new_xp integer,
  xp_gained integer,
  marks_total integer,
  marks_gained integer,
  personal_best boolean,
  best_score integer,
  best_distance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_character public.characters%rowtype;
  v_duration_seconds numeric;
  v_score integer;
  v_distance integer;
  v_combo integer;
  v_marks integer;
  v_existing_marks integer;
  v_new_marks integer;
  v_xp integer;
  v_new_xp integer;
  v_old_best integer;
  v_is_best boolean;
  v_best_score integer;
  v_best_distance integer;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  select * into v_character
  from public.characters
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Character not found';
  end if;

  if coalesce(p_duration_ms, 0) < 3000 then
    raise exception 'The run was too short to record';
  end if;

  v_duration_seconds := least(300, greatest(3, p_duration_ms::numeric / 1000));

  -- Server-side limits keep browser-edited submissions from granting impossible rewards.
  v_distance := least(
    greatest(coalesce(p_distance, 0), 0),
    floor(v_duration_seconds * 36 + 300)::integer
  );
  v_combo := least(greatest(coalesce(p_max_combo, 0), 0), 250);
  v_score := least(
    greatest(coalesce(p_score, 0), 0),
    greatest(2500, v_distance * 40 + v_combo * 140 + 12000)
  );
  v_marks := least(
    greatest(coalesce(p_marks, 0), 0),
    least(20, floor(v_duration_seconds / 6)::integer + 2)
  );

  -- Short attempts still receive a small consolation reward; strong runs scale well
  -- without overtaking the site's larger one-off XP rewards.
  v_xp := least(
    4500,
    greatest(
      35,
      round(v_distance * 0.90 + v_score * 0.04 + v_combo * 8)::integer
    )
  );

  v_existing_marks := coalesce((v_character.bank_items ->> 'marks_of_grace')::integer, 0);
  v_new_marks := v_existing_marks + v_marks;
  v_new_xp := coalesce(v_character.agility_xp, 0) + v_xp;

  update public.characters
  set agility_xp = v_new_xp,
      bank_items = jsonb_set(
        coalesce(bank_items, '{}'::jsonb),
        '{marks_of_grace}',
        to_jsonb(v_new_marks),
        true
      )
  where user_id = auth.uid();

  select coalesce(r.best_score, 0)
  into v_old_best
  from public.rooftop_rumble_scores r
  where r.user_id = auth.uid();

  v_is_best := v_score > coalesce(v_old_best, 0);

  insert into public.rooftop_rumble_scores (
    user_id, username, best_score, best_distance, best_combo, runs, updated_at
  ) values (
    auth.uid(), v_character.username, v_score, v_distance, v_combo, 1, now()
  )
  on conflict (user_id) do update
  set username = excluded.username,
      best_score = greatest(public.rooftop_rumble_scores.best_score, excluded.best_score),
      best_distance = greatest(public.rooftop_rumble_scores.best_distance, excluded.best_distance),
      best_combo = greatest(public.rooftop_rumble_scores.best_combo, excluded.best_combo),
      runs = public.rooftop_rumble_scores.runs + 1,
      updated_at = now();

  select r.best_score, r.best_distance
  into v_best_score, v_best_distance
  from public.rooftop_rumble_scores r
  where r.user_id = auth.uid();

  return query select
    v_new_xp,
    v_xp,
    v_new_marks,
    v_marks,
    v_is_best,
    v_best_score,
    v_best_distance;
end;
$$;

revoke all on function public.complete_rooftop_rumble(integer, integer, integer, integer, integer) from public;
grant execute on function public.complete_rooftop_rumble(integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.get_rooftop_rumble_leaderboard() to anon, authenticated;

notify pgrst, 'reload schema';
