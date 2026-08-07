-- Repo Company — Goblin Bomb Party rewarded-run repair
-- Safe additive repair. It does not alter any other minigame or reward RPC.
-- Fixes rewarded matches falling back to Practice when pgcrypto/digest is not
-- visible inside the RPC's restricted search_path.

create or replace function public.goblin_bomb_start_rewarded_match(
  p_difficulty text,
  p_arena text
)
returns table(match_id uuid, seed text, server_started_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_wins integer := 0;
  v_id uuid := gen_random_uuid();
  v_seed text;
begin
  if v_uid is null then
    raise exception 'You must be logged in';
  end if;

  if p_difficulty not in ('normal','veteran','insane') then
    raise exception 'Invalid difficulty';
  end if;
  if p_arena not in ('village','wilderness','dungeon','karamja','castle') then
    raise exception 'Invalid arena';
  end if;

  insert into public.goblin_bomb_profiles(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select coalesce(wins,0)
    into v_wins
    from public.goblin_bomb_profiles
   where user_id = v_uid;

  if p_difficulty='veteran' and v_wins<5 then raise exception 'Veteran unlocks at 5 wins'; end if;
  if p_difficulty='insane' and v_wins<15 then raise exception 'Insane unlocks at 15 wins'; end if;
  if p_arena='wilderness' and v_wins<3 then raise exception 'Wilderness Crater unlocks at 3 wins'; end if;
  if p_arena='dungeon' and v_wins<7 then raise exception 'Slayer Dungeon unlocks at 7 wins'; end if;
  if p_arena='karamja' and v_wins<12 then raise exception 'Karamja Volcano unlocks at 12 wins'; end if;
  if p_arena='castle' and v_wins<20 then raise exception 'Castle Courtyard unlocks at 20 wins'; end if;

  update public.goblin_bomb_matches
     set status='abandoned', completed_at=now()
   where user_id=v_uid and status='active';

  -- md5(text) is a PostgreSQL built-in, so this seed generation does not depend
  -- on pgcrypto being exposed in a particular extension schema.
  v_seed := md5(
    v_id::text || ':' ||
    v_uid::text || ':' ||
    clock_timestamp()::text || ':' ||
    random()::text
  );

  insert into public.goblin_bomb_matches(id,user_id,difficulty,arena,seed)
  values(v_id,v_uid,p_difficulty,p_arena,v_seed);

  return query select v_id,v_seed,clock_timestamp();
end;
$$;

-- Keep the original RPC name working too, so older cached website builds do not
-- suddenly become practice-only while Cloudflare/browser caches catch up.
create or replace function public.goblin_bomb_start_match(
  p_difficulty text,
  p_arena text
)
returns table(match_id uuid, seed text, server_started_at timestamptz)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select * from public.goblin_bomb_start_rewarded_match(p_difficulty,p_arena);
$$;

revoke all on function public.goblin_bomb_start_rewarded_match(text,text) from public, anon;
revoke all on function public.goblin_bomb_start_match(text,text) from public, anon;
grant execute on function public.goblin_bomb_start_rewarded_match(text,text) to authenticated;
grant execute on function public.goblin_bomb_start_match(text,text) to authenticated;
notify pgrst, 'reload schema';
