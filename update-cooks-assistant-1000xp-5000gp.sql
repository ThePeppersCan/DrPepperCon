-- Cook's Assistant dialogue/music website companion reward update
-- First-time completion reward: 1,000 Cooking XP, 5,000 GP and 1 Quest Point.
-- REPO COMPANY: QUEST POINTS, REPLAYABLE COOK'S ASSISTANT, AND COMPLETION REWARDS
-- Run once in Supabase -> SQL Editor after the existing Cook's Assistant SQL.
-- Existing quest completions, GP, Cooking XP, pets and bank items are preserved.

alter table public.characters
  add column if not exists quest_points integer not null default 0 check (quest_points >= 0);

-- Backfill one point for accounts that completed Cook's Assistant before quest points existed.
update public.characters
set quest_points = greatest(quest_points, 1)
where 'cooks_assistant' = any(coalesce(completed_quests, '{}'::text[]));

drop function if exists public.get_cooks_assistant_state();
drop function if exists public.cooks_assistant_action(text);

create function public.get_cooks_assistant_state()
returns table(
 status text, location text, has_bucket boolean, has_pot boolean, has_egg boolean,
 has_milk boolean, has_grain boolean, hopper_loaded boolean, lever_pulled boolean,
 has_flour boolean, completed boolean, cooking_xp integer, gp bigint, quest_points integer
)
language sql security definer set search_path=public as $$
 select
   case
     when coalesce(c.quest_state->>'status','')='active' then 'active'
     when 'cooks_assistant'=any(coalesce(c.completed_quests,'{}'::text[])) then 'completed'
     else 'not_started'
   end,
   coalesce(nullif(c.quest_state->>'location',''),'kitchen'),
   coalesce((c.quest_state->>'has_bucket')::boolean,false),
   coalesce((c.quest_state->>'has_pot')::boolean,false),
   coalesce((c.quest_state->>'has_egg')::boolean,false),
   coalesce((c.quest_state->>'has_milk')::boolean,false),
   coalesce((c.quest_state->>'has_grain')::boolean,false),
   coalesce((c.quest_state->>'hopper_loaded')::boolean,false),
   coalesce((c.quest_state->>'lever_pulled')::boolean,false),
   coalesce((c.quest_state->>'has_flour')::boolean,false),
   ('cooks_assistant'=any(coalesce(c.completed_quests,'{}'::text[]))),
   coalesce(c.cooking_xp,0),
   coalesce(c.gp,0),
   coalesce(c.quest_points,0)
 from public.characters c
 where c.user_id=auth.uid()
 limit 1
$$;

create function public.cooks_assistant_action(p_action text)
returns table(
 status text, location text, has_bucket boolean, has_pot boolean, has_egg boolean,
 has_milk boolean, has_grain boolean, hopper_loaded boolean, lever_pulled boolean,
 has_flour boolean, completed boolean, cooking_xp integer, gp bigint, quest_points integer
)
language plpgsql security definer set search_path=public as $$
declare
 c public.characters%rowtype;
 st jsonb;
 loc text;
 done boolean;
begin
 if auth.uid() is null then raise exception 'You must be logged in'; end if;
 select * into c from public.characters where user_id=auth.uid() for update;
 if c.id is null then raise exception 'Character not found'; end if;

 done := 'cooks_assistant'=any(coalesce(c.completed_quests,'{}'::text[]));
 st := coalesce(c.quest_state,'{}'::jsonb);

 if p_action='reset' then
   st := '{}'::jsonb;
   update public.characters set quest_state=st where id=c.id;
   return query select * from public.get_cooks_assistant_state(); return;
 end if;

 if p_action='start' then
   if coalesce(st->>'status','')<>'active' then
     st:=jsonb_build_object(
       'status','active','location','kitchen','has_bucket',false,'has_pot',false,
       'has_egg',false,'has_milk',false,'has_grain',false,'hopper_loaded',false,
       'lever_pulled',false,'has_flour',false,'started_at',now(),'replay',done
     );
     update public.characters set quest_state=st where id=c.id;
   end if;
   return query select * from public.get_cooks_assistant_state(); return;
 end if;

 if coalesce(st->>'status','')<>'active' then raise exception 'Start the quest first'; end if;
 loc:=coalesce(st->>'location','kitchen');

 if p_action like 'travel_%' then
   loc:=substring(p_action from 8);
   if loc not in ('kitchen','cellar','store','chicken','cows','wheat','mill') then raise exception 'Unknown location'; end if;
   st:=jsonb_set(st,'{location}',to_jsonb(loc),true);
 elsif p_action='talk_cook' then
   if loc<>'kitchen' then raise exception 'The Cook is in Lumbridge Castle kitchen'; end if;
 elsif p_action='take_pot' then
   if loc<>'kitchen' then raise exception 'The pot is in the castle kitchen'; end if;
   st:=jsonb_set(st,'{has_pot}','true'::jsonb,true);
 elsif p_action='take_bucket' then
   if loc<>'cellar' then raise exception 'The bucket is in the castle cellar'; end if;
   st:=jsonb_set(st,'{has_bucket}','true'::jsonb,true);
 elsif p_action='buy_supplies' then
   if loc<>'store' then raise exception 'Visit the Lumbridge General Store'; end if;
   if c.gp<3 then raise exception 'You need 3 GP'; end if;
   if not coalesce((st->>'has_bucket')::boolean,false) or not coalesce((st->>'has_pot')::boolean,false) then
     update public.characters as ch set gp=ch.gp-3 where ch.id=c.id;
     st:=jsonb_set(jsonb_set(st,'{has_bucket}','true'::jsonb,true),'{has_pot}','true'::jsonb,true);
   end if;
 elsif p_action='take_egg' then
   if loc<>'chicken' then raise exception 'The egg is at the chicken coop'; end if;
   st:=jsonb_set(st,'{has_egg}','true'::jsonb,true);
 elsif p_action='milk_cow' then
   if loc<>'cows' then raise exception 'Find the dairy cow field'; end if;
   if not coalesce((st->>'has_bucket')::boolean,false) then raise exception 'You need an empty bucket'; end if;
   st:=jsonb_set(st,'{has_milk}','true'::jsonb,true);
 elsif p_action='pick_grain' then
   if loc<>'wheat' then raise exception 'Go to the wheat field'; end if;
   st:=jsonb_set(st,'{has_grain}','true'::jsonb,true);
 elsif p_action='load_hopper' then
   if loc<>'mill' then raise exception 'Go to Mill Lane Mill'; end if;
   if not coalesce((st->>'has_grain')::boolean,false) then raise exception 'You need grain'; end if;
   st:=jsonb_set(jsonb_set(st,'{has_grain}','false'::jsonb,true),'{hopper_loaded}','true'::jsonb,true);
 elsif p_action='pull_lever' then
   if loc<>'mill' or not coalesce((st->>'hopper_loaded')::boolean,false) then raise exception 'Load the hopper first'; end if;
   st:=jsonb_set(st,'{lever_pulled}','true'::jsonb,true);
 elsif p_action='collect_flour' then
   if loc<>'mill' then raise exception 'Use the flour bin inside the mill'; end if;
   if not coalesce((st->>'lever_pulled')::boolean,false) then raise exception 'Pull the hopper lever first'; end if;
   if not coalesce((st->>'has_pot')::boolean,false) then raise exception 'You need an empty pot'; end if;
   st:=jsonb_set(st,'{has_flour}','true'::jsonb,true);
 elsif p_action='deliver' then
   if loc<>'kitchen' then raise exception 'Return to the Cook'; end if;
   if not coalesce((st->>'has_egg')::boolean,false)
      or not coalesce((st->>'has_milk')::boolean,false)
      or not coalesce((st->>'has_flour')::boolean,false)
   then raise exception 'You do not have all three ingredients'; end if;

   st:=jsonb_set(st,'{status}',to_jsonb('completed'::text),true);
   if not done then
     update public.characters as ch
       set quest_state=st,
           cooking_xp=ch.cooking_xp+1000,
           gp=ch.gp+5000,
           quest_points=ch.quest_points+1,
           completed_quests=array_append(coalesce(ch.completed_quests,'{}'::text[]),'cooks_assistant')
       where ch.id=c.id;
   else
     -- Replays remain crossed out and do not repeatedly award XP, GP or quest points.
     update public.characters set quest_state=st where id=c.id;
   end if;
   return query select * from public.get_cooks_assistant_state(); return;
 else
   raise exception 'Unknown quest action';
 end if;

 update public.characters set quest_state=st where id=c.id;
 return query select * from public.get_cooks_assistant_state();
end$$;

grant execute on function public.get_cooks_assistant_state() to authenticated;
grant execute on function public.cooks_assistant_action(text) to authenticated;
notify pgrst,'reload schema';
