-- Best Pet Win Rate: only pets with 40+ completed Quidditch games qualify.
-- Unlike the earlier browser-only filter, this gets the next qualifying pets
-- before limiting the board to five positions.
create or replace function public.get_quidditch_career_leaderboards_v3()
returns table(goal_leaders jsonb, winrate_leaders jsonb, team_leaders jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with current_board as (
    select * from public.get_quidditch_career_leaderboards_v2()
  ), qualified_winrates as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'wins', q.wins,
          'matches', q.matches,
          'pet_name', q.pet_name,
          'win_rate', q.win_rate,
          'owner_name', q.owner_name
        ) order by q.win_rate desc, q.wins desc, q.matches desc, q.pet_name asc
      ),
      '[]'::jsonb
    ) as rows
    from (
      select
        p.wins,
        p.matches,
        p.pet_name,
        round((p.wins::numeric * 100) / nullif(p.matches, 0), 1) as win_rate,
        p.owner_name
      from public.quidditch_pet_career p
      where p.matches >= 40
      order by win_rate desc, p.wins desc, p.matches desc, p.pet_name asc
      limit 5
    ) q
  )
  select current_board.goal_leaders, qualified_winrates.rows, current_board.team_leaders
  from current_board cross join qualified_winrates;
$$;

grant execute on function public.get_quidditch_career_leaderboards_v3() to anon, authenticated;
