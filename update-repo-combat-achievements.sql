-- REPO COMBAT SURVIVAL ACHIEVEMENTS + PET REWARDS
-- Run once in Supabase SQL Editor after deploying this build.

alter table public.characters
  add column if not exists achievements jsonb not null default '{}'::jsonb,
  add column if not exists bank_items jsonb not null default '{}'::jsonb,
  add column if not exists equipped_pet_cosmetic text;

drop function if exists public.complete_combat_run(boolean,integer,integer,integer);
drop function if exists public.complete_combat_run(boolean,integer,integer,integer,text);
drop function if exists public.complete_combat_run(boolean,integer,integer,integer,text,text);
drop function if exists public.complete_combat_run(boolean,integer,integer,integer,text,text,text);

create function public.complete_combat_run(
  p_survived boolean,
  p_kills integer,
  p_damage integer,
  p_seconds integer,
  p_difficulty text default 'medium',
  p_weapon text default 'sword',
  p_location text default 'lumbridge'
)
returns table(
  attack_xp integer,strength_xp integer,defence_xp integer,magic_xp integer,ranged_xp integer,
  attack_gained integer,strength_gained integer,defence_gained integer,magic_gained integer,ranged_gained integer,
  achievements jsonb,bank_items jsonb
)
language plpgsql security definer set search_path=public as $$
declare
  mult numeric := case lower(coalesce(p_difficulty,'medium')) when 'easy' then .75 when 'hard' then 1.55 when 'insane' then 2.35 else 1.10 end;
  base_attack integer; base_strength integer; base_defence integer; combined_gain integer;
  weapon text:=lower(coalesce(p_weapon,'sword')); loc text:=lower(coalesce(p_location,'lumbridge')); diff text:=lower(coalesce(p_difficulty,'medium'));
  a jsonb; b jsonb; completion_key text; inferno_veteran boolean; lumbridge_veteran boolean;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  base_attack:=greatest(1,floor((least(greatest(coalesce(p_kills,0),0),500)*3+case when p_survived then 45 else 0 end)*mult));
  base_strength:=greatest(1,floor((least(greatest(coalesce(p_damage,0),0),50000)/10.0+case when p_survived then 55 else 0 end)*mult));
  base_defence:=greatest(1,floor((least(greatest(coalesce(p_seconds,0),0),1800)*2+case when p_survived then 65 else 0 end)*mult));
  combined_gain:=base_attack+base_strength+base_defence;
  attack_gained:=case when weapon in('sword','dharok') then base_attack else 0 end;
  strength_gained:=case when weapon in('sword','dharok') then base_strength else 0 end;
  defence_gained:=case when weapon in('sword','dharok') then base_defence else 0 end;
  magic_gained:=case when weapon in('staff','shadow') then combined_gain else 0 end;
  ranged_gained:=case when weapon in('bow','blowpipe') then combined_gain else 0 end;

  select coalesce(c.achievements,'{}'::jsonb),coalesce(c.bank_items,'{}'::jsonb) into a,b
  from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;

  if p_survived and loc in('inferno','lumbridge') and diff in('easy','medium','hard','insane') then
    completion_key:='combat_'||loc||'_'||diff;
    a:=jsonb_set(a,array[completion_key],'true'::jsonb,true);
    if loc='inferno' and diff='insane' then
      a:=jsonb_set(a,'{combat_inferno_insane}','true'::jsonb,true);
      b:=jsonb_set(b,'{infernal_max_cape}','1'::jsonb,true);
    elsif loc='lumbridge' and diff='insane' then
      a:=jsonb_set(a,'{combat_lumbridge_insane}','true'::jsonb,true);
      b:=jsonb_set(b,'{golden_bucket_helm}','1'::jsonb,true);
    end if;
    inferno_veteran:=(a ? 'combat_inferno_easy') and (a ? 'combat_inferno_medium') and (a ? 'combat_inferno_hard');
    lumbridge_veteran:=(a ? 'combat_lumbridge_easy') and (a ? 'combat_lumbridge_medium') and (a ? 'combat_lumbridge_hard');
    if inferno_veteran then a:=jsonb_set(a,'{combat_inferno_veteran}','true'::jsonb,true); b:=jsonb_set(b,'{infernal_cape}','1'::jsonb,true); end if;
    if lumbridge_veteran then a:=jsonb_set(a,'{combat_lumbridge_veteran}','true'::jsonb,true); b:=jsonb_set(b,'{bucket_helm}','1'::jsonb,true); end if;
  end if;

  update public.characters c set
    attack_xp=least(13034431,c.attack_xp+attack_gained),strength_xp=least(13034431,c.strength_xp+strength_gained),
    defence_xp=least(13034431,c.defence_xp+defence_gained),magic_xp=least(13034431,c.magic_xp+magic_gained),
    ranged_xp=least(13034431,c.ranged_xp+ranged_gained),achievements=a,bank_items=b
  where c.user_id=auth.uid()
  returning c.attack_xp,c.strength_xp,c.defence_xp,c.magic_xp,c.ranged_xp,c.achievements,c.bank_items
  into attack_xp,strength_xp,defence_xp,magic_xp,ranged_xp,achievements,bank_items;
  return next;
end;$$;

create or replace function public.set_pet_cosmetic(p_cosmetic text default null)
returns table(equipped_pet_cosmetic text)
language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_active_pet text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_cosmetic is not null and p_cosmetic not in ('chefs_hat','fire_cape','odd_spectacles','infernal_cape','infernal_max_cape','bucket_helm','golden_bucket_helm') then raise exception 'Unsupported pet cosmetic'; end if;
  select coalesce(c.bank_items,'{}'::jsonb),c.active_pet into v_items,v_active_pet from public.characters c where c.user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if p_cosmetic is not null and v_active_pet is null then raise exception 'Let a pet out first'; end if;
  if p_cosmetic is not null and coalesce((v_items->>p_cosmetic)::integer,0)<1 then raise exception 'That reward is not in your Bank'; end if;
  update public.characters c set equipped_pet_cosmetic=p_cosmetic where c.user_id=auth.uid();
  return query select p_cosmetic;
end;$$;

revoke all on function public.complete_combat_run(boolean,integer,integer,integer,text,text,text) from public;
revoke all on function public.set_pet_cosmetic(text) from public;
grant execute on function public.complete_combat_run(boolean,integer,integer,integer,text,text,text) to authenticated;
grant execute on function public.set_pet_cosmetic(text) to authenticated;
notify pgrst,'reload schema';
