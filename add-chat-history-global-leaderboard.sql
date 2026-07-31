-- REPO COMPANY: PET CHAT HISTORY + GLOBAL XP LEADERBOARD
-- Run once in Supabase > SQL Editor. No existing XP, pets, items, or messages are reset.

-- Return the newest 10 messages on first load, then only messages newer than p_after_id.
drop function if exists public.get_pet_room_messages(bigint);
create function public.get_pet_room_messages(p_after_id bigint default 0)
returns table(id bigint, username text, message text, created_at timestamptz)
language sql
security definer
set search_path=public
stable
as $$
  with picked as (
    select m.id,m.username,m.message,m.created_at
    from public.pet_room_messages m
    where m.created_at > now()-interval '1 day'
      and (
        (coalesce(p_after_id,0) > 0 and m.id > p_after_id)
        or coalesce(p_after_id,0) <= 0
      )
    order by m.id desc
    limit case when coalesce(p_after_id,0) <= 0 then 10 else 50 end
  )
  select p.id,p.username,p.message,p.created_at
  from picked p
  order by p.id asc
$$;

grant execute on function public.get_pet_room_messages(bigint) to anon, authenticated;

-- Personal skill XP only. Harmony is shared and is therefore not added to each player's global XP.
drop function if exists public.get_global_xp_leaderboard();
create function public.get_global_xp_leaderboard()
returns table(username text, total_xp bigint)
language sql
stable
security definer
set search_path=public
as $$
  select c.username,
    (coalesce(c.woodcutting_xp,0)::bigint + coalesce(c.mining_xp,0)::bigint +
     coalesce(c.fishing_xp,0)::bigint + coalesce(c.agility_xp,0)::bigint +
     coalesce(c.slayer_xp,0)::bigint + coalesce(c.attack_xp,0)::bigint +
     coalesce(c.strength_xp,0)::bigint + coalesce(c.defence_xp,0)::bigint +
     coalesce(c.magic_xp,0)::bigint + coalesce(c.ranged_xp,0)::bigint +
     coalesce(c.sailing_xp,0)::bigint + coalesce(c.runecrafting_xp,0)::bigint +
     coalesce(c.cooking_xp,0)::bigint + coalesce(c.farming_xp,0)::bigint) as total_xp
  from public.characters c
  order by total_xp desc, c.username asc
  limit 5
$$;

grant execute on function public.get_global_xp_leaderboard() to anon, authenticated;
notify pgrst, 'reload schema';
