-- Allow a signed-in player to change their Quidditch team prediction at any
-- point during the pre-match lineup window. The final choice becomes locked
-- only when the match leaves the lineup phase.

drop function if exists public.predict_live_quidditch(bigint,text);
create function public.predict_live_quidditch(p_match_id bigint,p_side text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clock public.quidditch_live_clock%rowtype;
  v_pick text;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction'; end if;
  v_clock := public.advance_quidditch_live_clock();
  if p_match_id<>v_clock.match_id or v_clock.phase<>'lineup' then
    raise exception 'Predictions are closed for this match';
  end if;
  if p_side not in('left','right') then raise exception 'Choose one of the two teams'; end if;

  insert into public.quidditch_predictions(match_id,user_id,picked_side)
  values(p_match_id,auth.uid(),p_side)
  on conflict(match_id,user_id) do update
    set picked_side=excluded.picked_side,
        created_at=now();

  select qp.picked_side into v_pick
  from public.quidditch_predictions qp
  where qp.match_id=p_match_id and qp.user_id=auth.uid();

  return v_pick;
end;
$$;

grant execute on function public.predict_live_quidditch(bigint,text) to authenticated;
notify pgrst,'reload schema';
