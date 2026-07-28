-- CON OF DR PEPPER: THE GWENITH GLIDE SAILING MINIGAME
-- Run once in Supabase -> SQL Editor. Preserves all existing data.

alter table public.characters add column if not exists sailing_xp integer not null default 0 check (sailing_xp >= 0);

drop function if exists public.get_my_character();
create function public.get_my_character()
returns table(username text, woodcutting_xp integer, mining_xp integer, fishing_xp integer, agility_xp integer, slayer_xp integer, attack_xp integer, strength_xp integer, defence_xp integer, sailing_xp integer, collection text[])
language sql security definer set search_path=public as $$
 select c.username,c.woodcutting_xp,c.mining_xp,c.fishing_xp,c.agility_xp,c.slayer_xp,c.attack_xp,c.strength_xp,c.defence_xp,c.sailing_xp,c.collection from public.characters c where c.user_id=auth.uid() limit 1;
$$;

drop function if exists public.complete_sailing_run(boolean,integer,integer,integer);
create function public.complete_sailing_run(p_survived boolean,p_score integer,p_gates integer,p_seconds integer)
returns table(sailing_xp integer,sailing_gained integer) language plpgsql security definer set search_path=public as $$
declare gain integer; new_xp integer; begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 if p_score<0 or p_score>200000 or p_gates<0 or p_gates>200 or p_seconds<1 or p_seconds>60 then raise exception 'Invalid sailing run'; end if;
 if p_survived and p_seconds<57 then raise exception 'Run ended too quickly'; end if;
 gain:=least(220,5+floor(p_score/90.0)::integer+p_gates*3+case when p_survived then 45 else 0 end);
 update public.characters c set sailing_xp=c.sailing_xp+gain where c.user_id=auth.uid() returning c.sailing_xp into new_xp;
 if new_xp is null then raise exception 'Character not found'; end if; return query select new_xp,gain; end; $$;

create or replace function public.get_leaderboard() returns table(username text,total_level integer) language sql security definer set search_path=public as $$
 select c.username, public.level_from_xp(c.woodcutting_xp)+public.level_from_xp(c.mining_xp)+public.level_from_xp(c.fishing_xp)+public.level_from_xp(c.agility_xp)+public.level_from_xp(c.slayer_xp)+public.level_from_xp(c.attack_xp)+public.level_from_xp(c.strength_xp)+public.level_from_xp(c.defence_xp)+public.level_from_xp(c.sailing_xp) from public.characters c order by 2 desc,(c.woodcutting_xp+c.mining_xp+c.fishing_xp+c.agility_xp+c.slayer_xp+c.attack_xp+c.strength_xp+c.defence_xp+c.sailing_xp) desc limit 10; $$;

drop function if exists public.get_public_character(text);
create function public.get_public_character(p_username text) returns table(username text,woodcutting_xp integer,mining_xp integer,fishing_xp integer,agility_xp integer,slayer_xp integer,attack_xp integer,strength_xp integer,defence_xp integer,sailing_xp integer,agility_best_ms integer,collection text[],created_at timestamptz) language sql security definer set search_path=public as $$
 select c.username,c.woodcutting_xp,c.mining_xp,c.fishing_xp,c.agility_xp,c.slayer_xp,c.attack_xp,c.strength_xp,c.defence_xp,c.sailing_xp,c.agility_best_ms,c.collection,c.created_at from public.characters c where lower(c.username)=lower(btrim(p_username)) limit 1; $$;

grant execute on function public.get_my_character() to authenticated;
grant execute on function public.complete_sailing_run(boolean,integer,integer,integer) to authenticated;
grant execute on function public.get_leaderboard() to anon,authenticated;
grant execute on function public.get_public_character(text) to anon,authenticated;
notify pgrst,'reload schema';
