-- Jad simulator difficulty rewards, including INSANE. Run once in Supabase SQL Editor.
drop function if exists public.complete_jad_simulator(integer);
drop function if exists public.complete_jad_simulator(integer,text);
create function public.complete_jad_simulator(p_hits integer, p_difficulty text default 'medium')
returns table(new_xp integer, xp_gained integer)
language plpgsql security definer set search_path=public as $$
declare gain integer; required_hits integer; updated_xp integer;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 case lower(coalesce(p_difficulty,'medium'))
  when 'easy' then required_hits:=8; gain:=90;
  when 'medium' then required_hits:=12; gain:=150;
  when 'hard' then required_hits:=16; gain:=240;
  when 'insane' then required_hits:=28; gain:=500;
  else raise exception 'Invalid difficulty';
 end case;
 if p_hits<>required_hits then raise exception 'Jad was not fully defeated'; end if;
 update public.characters set slayer_xp=coalesce(slayer_xp,0)+gain where user_id=auth.uid() returning slayer_xp into updated_xp;
 if updated_xp is null then raise exception 'Character not found'; end if;
 return query select updated_xp,gain;
end $$;
grant execute on function public.complete_jad_simulator(integer,text) to authenticated;
