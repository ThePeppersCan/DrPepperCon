-- Run this small repair if the three Quidditch career panels show unavailable.
drop function if exists public.get_quidditch_career_leaderboards_v2();
create function public.get_quidditch_career_leaderboards_v2()
returns table(goal_leaders jsonb,winrate_leaders jsonb,team_leaders jsonb)
language sql security definer set search_path=public as $$
  select
    coalesce((select jsonb_agg(to_jsonb(q) order by q.goals desc,q.matches asc,q.pet_name) from(
      select pet_name,owner_name,goals,matches from public.quidditch_pet_career order by goals desc,matches asc,pet_name limit 5)q),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(w) order by w.win_rate desc,w.wins desc,w.matches desc,w.pet_name) from(
      select pet_name,owner_name,matches,wins,round((wins::numeric/greatest(matches,1))*100,1) win_rate
      from public.quidditch_pet_career where matches>=1 order by win_rate desc,wins desc,matches desc,pet_name limit 5)w),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t) order by t.wins desc,t.matches asc,t.team_name) from(
      select team_name,matches,wins,draws,losses,goals_for from public.quidditch_team_career order by wins desc,matches asc,team_name limit 5)t),'[]'::jsonb);
$$;
grant execute on function public.get_quidditch_career_leaderboards_v2() to anon,authenticated;
notify pgrst,'reload schema';
