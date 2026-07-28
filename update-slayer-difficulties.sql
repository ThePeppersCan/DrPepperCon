-- Repo Company: Slayer difficulty rewards
-- Run once in Supabase SQL Editor.

drop function if exists public.complete_jad_simulator(integer);
drop function if exists public.complete_jad_simulator(integer,text);

create function public.complete_jad_simulator(p_hits integer, p_difficulty text default 'medium')
returns table(new_xp integer, xp_gained integer)
language plpgsql security definer set search_path=public as $$
declare
  required_hits integer := case p_difficulty when 'easy' then 8 when 'hard' then 16 else 12 end;
  gain integer := case p_difficulty when 'easy' then 90 when 'hard' then 240 else 150 end;
  updated_xp integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_hits <> required_hits then raise exception 'Jad was not fully defeated'; end if;
  update public.characters set slayer_xp=slayer_xp+gain where user_id=auth.uid() returning slayer_xp into updated_xp;
  if updated_xp is null then raise exception 'Character not found'; end if;
  new_xp:=updated_xp; xp_gained:=gain; return next;
end$$;

grant execute on function public.complete_jad_simulator(integer,text) to authenticated;
notify pgrst,'reload schema';
