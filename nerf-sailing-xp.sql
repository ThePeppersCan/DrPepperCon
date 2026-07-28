-- CON OF DR PEPPER: SAILING XP NERF
-- Run once in Supabase -> SQL Editor. This only changes future Sailing rewards.

drop function if exists public.complete_sailing_run(boolean,integer,integer,integer);
create function public.complete_sailing_run(p_survived boolean,p_score integer,p_gates integer,p_seconds integer)
returns table(sailing_xp integer,sailing_gained integer) language plpgsql security definer set search_path=public as $$
declare gain integer; new_xp integer; begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 if p_score<0 or p_score>200000 or p_gates<0 or p_gates>200 or p_seconds<1 or p_seconds>60 then raise exception 'Invalid sailing run'; end if;
 if p_survived and p_seconds<57 then raise exception 'Run ended too quickly'; end if;
 gain:=least(220,5+floor(p_score/90.0)::integer+p_gates*3+case when p_survived then 45 else 0 end);
 update public.characters c set sailing_xp=c.sailing_xp+gain where c.user_id=auth.uid() returning c.sailing_xp into new_xp;
 if new_xp is null then raise exception 'Character not found'; end if;
 return query select new_xp,gain;
end; $$;

grant execute on function public.complete_sailing_run(boolean,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
