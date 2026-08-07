-- REPO DIVER — reward save repair (2026-08-07)
-- Safe to run after the original repo-diver.sql.
-- Fixes: column reference "id" is ambiguous in repo_diver_complete_day.

create or replace function public.repo_diver_complete_day(p_run_id uuid,p_catches jsonb,p_dishes jsonb,p_max_depth integer,p_customers integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_user uuid:=auth.uid();
 v_run public.repo_diver_runs%rowtype;
 v_profile public.repo_diver_profiles%rowtype;
 v_character public.characters%rowtype;
 v_item jsonb;
 v_item_id text;
 v_quality int;
 v_fx int:=0;
 v_cx int:=0;
 v_gold int:=0;
 v_count_fish int:=0;
 v_count_dish int:=0;
 v_perfect int:=0;
 v_fishmap jsonb:='{}'::jsonb;
 v_usedmap jsonb:='{}'::jsonb;
 v_journal jsonb;
 v_stats jsonb;
 v_unlocks jsonb;
 v_price int;
 v_base_xp int;
 v_fish_id text;
 v_elapsed numeric;
begin
 if v_user is null then raise exception 'You must be logged in'; end if;
 if p_customers is null or p_customers<0 or p_customers>50 then raise exception 'Invalid customer count'; end if;

 select rr.* into v_run
 from public.repo_diver_runs as rr
 where rr.id=p_run_id and rr.user_id=v_user
 for update;
 if not found then raise exception 'Run not found'; end if;

 if v_run.status='claimed' then
   select ch.* into v_character from public.characters as ch where ch.user_id=v_user;
   return jsonb_build_object('duplicate',true,'fishing_xp_awarded',v_run.fishing_xp,'cooking_xp_awarded',v_run.cooking_xp,'gp_awarded',v_run.gp,'fishing_xp',v_character.fishing_xp,'cooking_xp',v_character.cooking_xp,'gp',v_character.gp);
 end if;
 if v_run.status<>'active' then raise exception 'Run is not active'; end if;

 v_elapsed:=extract(epoch from(now()-v_run.started_at));
 if v_elapsed<12 or v_elapsed>3600 then raise exception 'Invalid run duration'; end if;
 if jsonb_typeof(coalesce(p_catches,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_dishes,'[]'::jsonb))<>'array' then raise exception 'Invalid results'; end if;

 for v_item in select j.value from jsonb_array_elements(p_catches) as j(value) limit 45 loop
   v_item_id:=v_item->>'id';
   v_quality:=least(3,greatest(1,coalesce((v_item->>'q')::int,1)));
   v_base_xp:=case v_item_id
     when 'shrimp' then 8 when 'sardine' then 12 when 'trout' then 18 when 'mudskipper' then 28 when 'rockcrab' then 34 when 'snapper' then 52 when 'goblinfish' then 60
     when 'fremcod' then 22 when 'swordfin' then 38 when 'moonjel' then 58 when 'dragonlob' then 95 when 'ghostshark' then 115
     when 'monkfish' then 44 when 'bloodeel' then 72 when 'phantom' then 120 when 'soulangler' then 190
     when 'abyssaleel' then 80 when 'runeray' then 128 when 'voidshark' then 210 when 'levifry' then 280
     when 'crystaltuna' then 95 when 'crystalmanta' then 150 when 'ancientmanta' then 235 when 'deepkraken' then 320 else 0 end;
   if v_base_xp=0 then continue; end if;
   v_fx:=v_fx+round(v_base_xp*(1+(v_quality-1)*.12));
   v_count_fish:=v_count_fish+1;
   v_fishmap:=jsonb_set(v_fishmap,array[v_item_id],to_jsonb(coalesce((v_fishmap->>v_item_id)::int,0)+1),true);
 end loop;

 if v_count_fish>greatest(4,floor(v_elapsed/2.2)::int) then raise exception 'Catch rate validation failed'; end if;

 -- Only served dishes are submitted by the client. Never accept more dishes than customers served.
 for v_item in select j.value from jsonb_array_elements(p_dishes) as j(value) limit greatest(0,least(30,p_customers)) loop
   v_item_id:=v_item->>'id';
   v_quality:=least(4,greatest(1,coalesce((v_item->>'quality')::int,1)));
   v_price:=case v_item_id when 'shrimp_skewer' then 42 when 'grilled_trout' then 68 when 'snapper_plate' then 135 when 'lobster_platter' then 245 when 'monk_curry' then 128 when 'ghost_steak' then 285 when 'abyssal_bowl' then 210 when 'rune_ray' then 340 when 'crystal_plate' then 480 when 'ancient_feast' then 720 else 0 end;
   v_base_xp:=case v_item_id when 'shrimp_skewer' then 14 when 'grilled_trout' then 20 when 'snapper_plate' then 34 when 'lobster_platter' then 58 when 'monk_curry' then 40 when 'ghost_steak' then 66 when 'abyssal_bowl' then 54 when 'rune_ray' then 82 when 'crystal_plate' then 110 when 'ancient_feast' then 160 else 0 end;
   if v_price=0 then continue; end if;
   v_fish_id:=case v_item_id when 'shrimp_skewer' then 'shrimp' when 'grilled_trout' then 'trout' when 'snapper_plate' then 'snapper' when 'lobster_platter' then 'dragonlob' when 'monk_curry' then 'monkfish' when 'ghost_steak' then 'ghostshark' when 'abyssal_bowl' then 'abyssaleel' when 'rune_ray' then 'runeray' when 'crystal_plate' then 'crystalmanta' when 'ancient_feast' then 'ancientmanta' else '' end;
   if coalesce((v_fishmap->>v_fish_id)::int,0)<=coalesce((v_usedmap->>v_fish_id)::int,0) then continue; end if;
   v_usedmap:=jsonb_set(v_usedmap,array[v_fish_id],to_jsonb(coalesce((v_usedmap->>v_fish_id)::int,0)+1),true);
   v_cx:=v_cx+round(v_base_xp*(case v_quality when 4 then 1.25 when 3 then 1.1 when 2 then .92 else .7 end));
   v_gold:=v_gold+round(v_price*(case v_quality when 4 then 1.18 when 3 then 1.05 when 2 then .9 else .72 end));
   v_count_dish:=v_count_dish+1;
   if v_quality=4 then v_perfect:=v_perfect+1; end if;
 end loop;

 v_fx:=least(v_fx,3000);v_cx:=least(v_cx,2200);v_gold:=least(v_gold,6500);

 select ch.* into v_character from public.characters as ch where ch.user_id=v_user for update;
 if not found then raise exception 'Character not found'; end if;
 insert into public.repo_diver_profiles(user_id) values(v_user) on conflict(user_id) do nothing;
 select dp.* into v_profile from public.repo_diver_profiles as dp where dp.user_id=v_user for update;

 v_journal:=v_profile.fish_journal;
 for v_item_id,v_quality in select e.key,(e.value #>> '{}')::int from jsonb_each(v_fishmap) as e(key,value) loop
   v_journal:=jsonb_set(v_journal,array[v_item_id],jsonb_build_object('count',coalesce((v_journal->v_item_id->>'count')::int,0)+v_quality,'best_q',greatest(coalesce((v_journal->v_item_id->>'best_q')::int,1),1)),true);
 end loop;

 v_stats:=jsonb_build_object(
   'deepest',greatest(coalesce((v_profile.stats->>'deepest')::numeric,0),greatest(0,p_max_depth)),
   'total_fish',coalesce((v_profile.stats->>'total_fish')::int,0)+v_count_fish,
   'total_revenue',coalesce((v_profile.stats->>'total_revenue')::bigint,0)+v_gold,
   'perfect_dishes',coalesce((v_profile.stats->>'perfect_dishes')::int,0)+v_perfect
 );

 update public.characters as ch set fishing_xp=ch.fishing_xp+v_fx,cooking_xp=ch.cooking_xp+v_cx,gp=ch.gp+v_gold where ch.user_id=v_user returning ch.* into v_character;
 v_unlocks:=v_profile.unlocked_biomes;
 if v_profile.day_number>=2 then v_unlocks:=v_unlocks||jsonb_build_array('fremennik'); end if;
 if v_profile.day_number>=6 then v_unlocks:=v_unlocks||jsonb_build_array('morytania'); end if;
 if v_profile.day_number>=11 then v_unlocks:=v_unlocks||jsonb_build_array('abyssal'); end if;
 if v_profile.day_number>=17 then v_unlocks:=v_unlocks||jsonb_build_array('crystal'); end if;

 update public.repo_diver_profiles as dp set
   day_number=dp.day_number+1,
   fish_journal=v_journal,
   stats=v_stats,
   unlocked_biomes=(select jsonb_agg(distinct e.value) from jsonb_array_elements(v_unlocks) as e(value)),
   restaurant=jsonb_set(dp.restaurant,'{rank}',to_jsonb(least(6,1+floor((v_profile.day_number+1)/4)::int)),true),
   updated_at=now()
 where dp.user_id=v_user;

 update public.repo_diver_runs as rr set status='claimed',completed_at=now(),fishing_xp=v_fx,cooking_xp=v_cx,gp=v_gold,summary=jsonb_build_object('fish',v_count_fish,'dishes',v_count_dish,'depth',p_max_depth,'customers',p_customers) where rr.id=p_run_id and rr.user_id=v_user;
 return jsonb_build_object('fishing_xp_awarded',v_fx,'cooking_xp_awarded',v_cx,'gp_awarded',v_gold,'fishing_xp',v_character.fishing_xp,'cooking_xp',v_character.cooking_xp,'gp',v_character.gp);
end$$;

revoke all on function public.repo_diver_complete_day(uuid,jsonb,jsonb,integer,integer) from public,anon;
grant execute on function public.repo_diver_complete_day(uuid,jsonb,jsonb,integer,integer) to authenticated;
notify pgrst,'reload schema';
