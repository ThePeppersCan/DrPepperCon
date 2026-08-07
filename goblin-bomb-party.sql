-- REPO COMPANY — GOBLIN BOMB PARTY
-- Additive migration. Run once in Supabase SQL Editor after deploying the website files.
-- Re-running is safe: tables/columns are IF NOT EXISTS and RPCs are replaced.

create extension if not exists pgcrypto;

alter table public.characters add column if not exists slayer_xp integer not null default 0;
alter table public.characters add column if not exists gp bigint not null default 0;

create table if not exists public.goblin_bomb_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character_config jsonb not null default '{}'::jsonb,
  presets jsonb not null default '[]'::jsonb,
  selected_arena text not null default 'village',
  settings jsonb not null default '{}'::jsonb,
  total_matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  current_streak integer not null default 0,
  highest_streak integer not null default 0,
  highest_score bigint not null default 0,
  total_eliminations integer not null default 0,
  total_passes integer not null default 0,
  total_throws integer not null default 0,
  total_dash_hits integer not null default 0,
  total_last_second integer not null default 0,
  total_environmental integer not null default 0,
  total_score bigint not null default 0,
  fastest_victory_ms integer not null default 0,
  total_slayer_xp bigint not null default 0,
  total_gp bigint not null default 0,
  veteran_wins integer not null default 0,
  insane_wins integer not null default 0,
  achievements jsonb not null default '{}'::jsonb,
  unlocked_cosmetics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  constraint goblin_bomb_profiles_arena check (selected_arena in ('village','wilderness','dungeon','karamja','castle'))
);

create table if not exists public.goblin_bomb_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null,
  arena text not null,
  seed text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active',
  placement integer,
  score bigint,
  metrics jsonb not null default '{}'::jsonb,
  valid_participation boolean,
  reward_gp integer not null default 0,
  reward_xp integer not null default 0,
  constraint goblin_bomb_matches_difficulty check (difficulty in ('normal','veteran','insane')),
  constraint goblin_bomb_matches_arena check (arena in ('village','wilderness','dungeon','karamja','castle')),
  constraint goblin_bomb_matches_status check (status in ('active','claimed','rejected','abandoned')),
  constraint goblin_bomb_matches_placement check (placement is null or placement between 1 and 8)
);

create index if not exists goblin_bomb_matches_user_started_idx on public.goblin_bomb_matches(user_id, started_at desc);
create index if not exists goblin_bomb_matches_completed_idx on public.goblin_bomb_matches(completed_at desc) where status='claimed';

alter table public.goblin_bomb_profiles enable row level security;
alter table public.goblin_bomb_matches enable row level security;
revoke all on public.goblin_bomb_profiles from anon, authenticated;
revoke all on public.goblin_bomb_matches from anon, authenticated;

create or replace function public.goblin_bomb_profile_json(p_uid uuid)
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'character_config', p.character_config,
    'presets', p.presets,
    'selected_arena', p.selected_arena,
    'settings', p.settings,
    'stats', jsonb_build_object(
      'total_matches',p.total_matches,'wins',p.wins,'losses',p.losses,
      'current_streak',p.current_streak,'highest_streak',p.highest_streak,
      'highest_score',p.highest_score,'total_eliminations',p.total_eliminations,
      'total_passes',p.total_passes,'total_throws',p.total_throws,
      'total_dash_hits',p.total_dash_hits,'total_last_second',p.total_last_second,
      'total_environmental',p.total_environmental,'total_score',p.total_score,
      'fastest_victory_ms',p.fastest_victory_ms,'total_slayer_xp',p.total_slayer_xp,
      'total_gp',p.total_gp,'veteran_wins',p.veteran_wins,'insane_wins',p.insane_wins
    ),
    'achievements',p.achievements,
    'unlocked_cosmetics',p.unlocked_cosmetics
  )
  from public.goblin_bomb_profiles p where p.user_id=p_uid
$$;
revoke all on function public.goblin_bomb_profile_json(uuid) from public, anon, authenticated;

create or replace function public.goblin_bomb_get_profile()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;
  insert into public.goblin_bomb_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  return public.goblin_bomb_profile_json(v_uid);
end;
$$;

create or replace function public.goblin_bomb_save_profile(
  p_character jsonb,
  p_presets jsonb,
  p_selected_arena text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_unlocks jsonb;
  v_head text:=coalesce(p_character->>'headgear','none');
  v_top text:=coalesce(p_character->>'top','shirt');
  v_cape text:=coalesce(p_character->>'cape','none');
  v_aura text:=coalesce(p_character->>'aura','none');
  v_trail text:=coalesce(p_character->>'trail','dust');
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;
  if jsonb_typeof(coalesce(p_character,'{}'::jsonb)) <> 'object' then raise exception 'Invalid character data'; end if;
  if jsonb_typeof(coalesce(p_presets,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_presets,'[]'::jsonb)) > 3 then raise exception 'Invalid presets'; end if;
  if p_selected_arena not in ('village','wilderness','dungeon','karamja','castle') then raise exception 'Invalid arena'; end if;
  if jsonb_typeof(coalesce(p_settings,'{}'::jsonb)) <> 'object' then raise exception 'Invalid settings'; end if;

  if coalesce(p_character->>'gender','male') not in ('male','female') then raise exception 'Invalid character body'; end if;
  if coalesce(p_character->>'skin','warm') not in ('porcelain','fair','warm','tan','olive','brown','deep','ebony','sun','cool') then raise exception 'Invalid skin'; end if;
  if coalesce(p_character->>'hair','messy') not in ('short','buzz','spiked','messy','curtains','slick','mohawk','medium','long','tied','ponytail','bun','braids','wavy','curly','fringe','shaved','bald','wizard','wild','goblin') then raise exception 'Invalid hair'; end if;
  if coalesce(p_character->>'hairColor','brown') not in ('black','darkbrown','brown','lightbrown','blonde','platinum','ginger','darkred','grey','white','blue','green','purple','pink') then raise exception 'Invalid hair colour'; end if;
  if coalesce(p_character->>'face','normal') not in ('normal','happy','angry','serious','tired','scar','moustache','stubble','beard','bigbeard','eyepatch','warpaint') then raise exception 'Invalid face'; end if;
  if v_top not in ('shirt','leather','chain','plate','slayer','rogue','wizard','monk','ranger','dragon','black','desert','frem','vyre','fancy','worker','goblin','party','bombshirt') then raise exception 'Invalid top'; end if;
  if coalesce(p_character->>'legs','trousers') not in ('trousers','shorts','armoured','robes','leather','ranger','slayer','bootscombo','torn','fancy') then raise exception 'Invalid legs'; end if;
  if coalesce(p_character->>'boots','normal') not in ('normal','heavy','armoured','wizard','ranger','sandals','barefoot','golden','goblin') then raise exception 'Invalid boots'; end if;
  if coalesce(p_character->>'gloves','leather') not in ('none','leather','armoured','black','wizard','golden') then raise exception 'Invalid gloves'; end if;
  if v_cape not in ('none','plain','slayer','torn','black','red','purple','green','goldtrim','tiny','bombking') then raise exception 'Invalid cape'; end if;
  if v_head not in ('none','slayerhelm','platehelm','wizardhat','hood','bandana','partyhat','chefhat','saucepan','crown','pirate','bunny','santa','bombhat','goblinheadband','goblinslayerhelm','skull','championcrown') then raise exception 'Invalid headgear'; end if;
  if v_aura not in ('none','fire','ice','lightning','shadow','holy','poison','blood','nature','rune','purple','gold','ghost','stars','slayerflame') then raise exception 'Invalid aura'; end if;
  if v_trail not in ('dust','fire','ice','lightning','runes','leaves','shadow','gold','rainbow','stink','goldenchamp') then raise exception 'Invalid trail'; end if;
  if coalesce(p_character->>'voice','classic') not in ('classic','high','deep','heroic','goblin') then raise exception 'Invalid voice'; end if;

  insert into public.goblin_bomb_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  select unlocked_cosmetics into v_unlocks from public.goblin_bomb_profiles where user_id=v_uid;
  if v_head='goblinheadband' and not (v_unlocks ? 'goblin_headband') then raise exception 'Cosmetic not unlocked'; end if;
  if v_head='goblinslayerhelm' and not (v_unlocks ? 'goblin_slayer_helmet') then raise exception 'Cosmetic not unlocked'; end if;
  if v_head='skull' and not (v_unlocks ? 'goblin_skull_helmet') then raise exception 'Cosmetic not unlocked'; end if;
  if v_head='championcrown' and not (v_unlocks ? 'champion_crown') then raise exception 'Cosmetic not unlocked'; end if;
  if v_top='bombshirt' and not (v_unlocks ? 'bomb_shirt') then raise exception 'Cosmetic not unlocked'; end if;
  if v_cape='bombking' and not (v_unlocks ? 'bomb_king_cape') then raise exception 'Cosmetic not unlocked'; end if;
  if v_aura='slayerflame' and not (v_unlocks ? 'slayer_flame_aura') then raise exception 'Cosmetic not unlocked'; end if;
  if v_trail='goldenchamp' and not (v_unlocks ? 'golden_dash') then raise exception 'Cosmetic not unlocked'; end if;

  update public.goblin_bomb_profiles
     set character_config=p_character,
         presets=p_presets,
         selected_arena=p_selected_arena,
         settings=jsonb_build_object(
           'master',least(1,greatest(0,coalesce((p_settings->>'master')::numeric,.7))),
           'music',least(1,greatest(0,coalesce((p_settings->>'music')::numeric,.36))),
           'sfx',least(1,greatest(0,coalesce((p_settings->>'sfx')::numeric,.72))),
           'voices',least(1,greatest(0,coalesce((p_settings->>'voices')::numeric,.55))),
           'ambience',least(1,greatest(0,coalesce((p_settings->>'ambience')::numeric,.28))),
           'shake',least(1,greatest(0,coalesce((p_settings->>'shake')::numeric,1))),
           'effects',least(1,greatest(.25,coalesce((p_settings->>'effects')::numeric,1))),
           'mute',coalesce((p_settings->>'mute')::boolean,false),
           'showKnockback',coalesce((p_settings->>'showKnockback')::boolean,true),
           'visualBombWarning',coalesce((p_settings->>'visualBombWarning')::boolean,true),
           'reduceOtherEffects',coalesce((p_settings->>'reduceOtherEffects')::boolean,false)
         ),
         last_updated=now()
   where user_id=v_uid;
  return public.goblin_bomb_profile_json(v_uid);
exception when invalid_text_representation then
  raise exception 'Invalid settings';
end;
$$;

create or replace function public.goblin_bomb_start_match(p_difficulty text, p_arena text)
returns table(match_id uuid, seed text, server_started_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_wins integer;
  v_id uuid:=gen_random_uuid();
  v_seed text;
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;
  if p_difficulty not in ('normal','veteran','insane') then raise exception 'Invalid difficulty'; end if;
  if p_arena not in ('village','wilderness','dungeon','karamja','castle') then raise exception 'Invalid arena'; end if;
  insert into public.goblin_bomb_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  select wins into v_wins from public.goblin_bomb_profiles where user_id=v_uid;
  if p_difficulty='veteran' and v_wins<5 then raise exception 'Veteran unlocks at 5 wins'; end if;
  if p_difficulty='insane' and v_wins<15 then raise exception 'Insane unlocks at 15 wins'; end if;
  if p_arena='wilderness' and v_wins<3 then raise exception 'Wilderness Crater unlocks at 3 wins'; end if;
  if p_arena='dungeon' and v_wins<7 then raise exception 'Slayer Dungeon unlocks at 7 wins'; end if;
  if p_arena='karamja' and v_wins<12 then raise exception 'Karamja Volcano unlocks at 12 wins'; end if;
  if p_arena='castle' and v_wins<20 then raise exception 'Castle Courtyard unlocks at 20 wins'; end if;

  update public.goblin_bomb_matches set status='abandoned',completed_at=now()
   where user_id=v_uid and status='active';

  v_seed:=encode(digest(v_id::text||':'||v_uid::text||':'||clock_timestamp()::text,'sha256'),'hex');
  insert into public.goblin_bomb_matches(id,user_id,difficulty,arena,seed)
  values(v_id,v_uid,p_difficulty,p_arena,v_seed);
  return query select v_id,v_seed,now();
end;
$$;

create or replace function public.goblin_bomb_complete_match(
  p_match_id uuid,
  p_placement integer,
  p_eliminations integer,
  p_passes integer,
  p_throws integer,
  p_dash_hits integer,
  p_dash_hits_taken integer,
  p_last_second integer,
  p_environmental integer,
  p_max_phase_passes integer,
  p_panic_passes integer,
  p_duration_ms integer,
  p_movement_distance integer,
  p_active_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  m public.goblin_bomb_matches%rowtype;
  p public.goblin_bomb_profiles%rowtype;
  c public.characters%rowtype;
  v_elapsed_ms integer;
  v_valid boolean:=true;
  v_base_xp integer;
  v_base_gp integer;
  v_perf_xp integer;
  v_perf_gp integer;
  v_xp integer:=0;
  v_gp integer:=0;
  v_score bigint:=0;
  v_mult numeric:=1;
  v_new_wins integer;
  v_new_streak integer;
  v_ach jsonb;
  v_unlocks jsonb;
  v_new_ach text[]:=array[]::text[];
  v_key text;
  v_fastest integer;
  v_metrics jsonb;
  v_new_slayer integer;
  v_new_gp bigint;
begin
  if v_uid is null then raise exception 'You must be logged in'; end if;
  select * into m from public.goblin_bomb_matches where id=p_match_id and user_id=v_uid for update;
  if not found then raise exception 'Match not found'; end if;
  if m.status='claimed' then
    select * into c from public.characters where user_id=v_uid;
    return jsonb_build_object('xp_gained',m.reward_xp,'gp_gained',m.reward_gp,'new_slayer_xp',coalesce(c.slayer_xp,0),'new_gp',coalesce(c.gp,0),'valid_participation',coalesce(m.valid_participation,false),'already_claimed',true,'new_achievements','[]'::jsonb,'profile',public.goblin_bomb_profile_json(v_uid));
  end if;
  if m.status<>'active' then raise exception 'Match is no longer claimable'; end if;

  p_placement:=least(8,greatest(1,coalesce(p_placement,8)));
  p_eliminations:=least(7,greatest(0,coalesce(p_eliminations,0)));
  p_passes:=least(100,greatest(0,coalesce(p_passes,0)));
  p_throws:=least(100,greatest(0,coalesce(p_throws,0)));
  p_dash_hits:=least(150,greatest(0,coalesce(p_dash_hits,0)));
  p_dash_hits_taken:=least(150,greatest(0,coalesce(p_dash_hits_taken,0)));
  p_last_second:=least(50,greatest(0,coalesce(p_last_second,0)));
  p_environmental:=least(7,greatest(0,coalesce(p_environmental,0)));
  p_max_phase_passes:=least(50,greatest(0,coalesce(p_max_phase_passes,0)));
  p_panic_passes:=least(50,greatest(0,coalesce(p_panic_passes,0)));
  p_duration_ms:=least(240000,greatest(0,coalesce(p_duration_ms,0)));
  p_movement_distance:=least(250000,greatest(0,coalesce(p_movement_distance,0)));
  p_active_seconds:=least(240,greatest(0,coalesce(p_active_seconds,0)));
  v_elapsed_ms:=greatest(0,floor(extract(epoch from(now()-m.started_at))*1000)::integer);

  if v_elapsed_ms < 1800 or p_duration_ms < 1500 then v_valid:=false; end if;
  if p_duration_ms > v_elapsed_ms+6000 then v_valid:=false; end if;
  if not ((p_active_seconds>=2 and p_movement_distance>=55) or (p_passes+p_throws+p_dash_hits+p_eliminations+p_last_second+p_environmental)>=1) then v_valid:=false; end if;

  v_base_xp:=case p_placement when 1 then 300 when 2 then 210 when 3 then 160 when 4 then 120 when 5 then 90 when 6 then 70 when 7 then 55 else 40 end;
  v_base_gp:=case p_placement when 1 then 650 when 2 then 450 when 3 then 300 when 4 then 200 when 5 then 150 when 6 then 100 when 7 then 75 else 50 end;
  v_perf_xp:=least(100,p_eliminations*20+p_passes*3+p_throws*5+p_dash_hits*2+p_last_second*12+p_environmental*10+least(15,p_max_phase_passes*2));
  v_perf_gp:=least(350,p_eliminations*50+p_passes*8+p_throws*12+p_dash_hits*4+p_last_second*40+p_environmental*60+least(45,p_max_phase_passes*5));
  v_mult:=case m.difficulty when 'veteran' then 1.06 when 'insane' then 1.10 else 1 end;
  if v_valid then
    v_xp:=least(case m.difficulty when 'normal' then 400 when 'veteran' then 425 else 440 end,round((v_base_xp+v_perf_xp)*v_mult)::integer);
    v_gp:=least(case m.difficulty when 'normal' then 1000 when 'veteran' then 1060 else 1100 end,round((v_base_gp+v_perf_gp)*v_mult)::integer);
  end if;
  v_score:=p_eliminations*1000::bigint+p_passes*100::bigint+p_throws*150::bigint+p_dash_hits*50::bigint+p_environmental*500::bigint+p_last_second*750::bigint+(case when p_placement=1 then 2500 else 0 end);
  v_metrics:=jsonb_build_object('eliminations',p_eliminations,'passes',p_passes,'throws',p_throws,'dash_hits',p_dash_hits,'dash_hits_taken',p_dash_hits_taken,'last_second',p_last_second,'environmental',p_environmental,'max_phase_passes',p_max_phase_passes,'panic_passes',p_panic_passes,'duration_ms',p_duration_ms,'movement_distance',p_movement_distance,'active_seconds',p_active_seconds);

  insert into public.goblin_bomb_profiles(user_id) values(v_uid) on conflict(user_id) do nothing;
  select * into p from public.goblin_bomb_profiles where user_id=v_uid for update;
  select * into c from public.characters where user_id=v_uid for update;
  if not found then raise exception 'Character not found'; end if;

  v_new_wins:=p.wins+(case when p_placement=1 and v_valid then 1 else 0 end);
  v_new_streak:=case when p_placement=1 and v_valid then p.current_streak+1 else 0 end;
  v_fastest:=p.fastest_victory_ms;
  if p_placement=1 and v_valid and (v_fastest=0 or p_duration_ms<v_fastest) then v_fastest:=p_duration_ms; end if;
  v_ach:=coalesce(p.achievements,'{}'::jsonb);
  v_unlocks:=coalesce(p.unlocked_cosmetics,'[]'::jsonb);

  -- Apply achievements only to valid, rewarded play.
  if v_valid then
    if p.total_eliminations+p_eliminations>=1 and not coalesce((v_ach->>'first_blood')::boolean,false) then v_ach:=v_ach||'{"first_blood":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'first_blood');end if;
    if p_max_phase_passes>=5 and not coalesce((v_ach->>'hot_potato')::boolean,false) then v_ach:=v_ach||'{"hot_potato":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'hot_potato');end if;
    if p_last_second>=1 and not coalesce((v_ach->>'last_second_hero')::boolean,false) then v_ach:=v_ach||'{"last_second_hero":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'last_second_hero');end if;
    if p.total_eliminations+p_eliminations>=100 and not coalesce((v_ach->>'goblin_slayer')::boolean,false) then v_ach:=v_ach||'{"goblin_slayer":true}'::jsonb;v_unlocks:=v_unlocks||'["goblin_skull_helmet"]'::jsonb;v_new_ach:=array_append(v_new_ach,'goblin_slayer');end if;
    if p_placement=1 and not coalesce((v_ach->>'champion')::boolean,false) then v_ach:=v_ach||'{"champion":true}'::jsonb;v_unlocks:=v_unlocks||'["goblin_headband"]'::jsonb;v_new_ach:=array_append(v_new_ach,'champion');end if;
    if p_placement=1 and p_dash_hits_taken=0 and not coalesce((v_ach->>'flawless')::boolean,false) then v_ach:=v_ach||'{"flawless":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'flawless');end if;
    if p_environmental>=3 and not coalesce((v_ach->>'lava_delivery')::boolean,false) then v_ach:=v_ach||'{"lava_delivery":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'lava_delivery');end if;
    if v_new_wins>=5 and not coalesce((v_ach->>'bomb_disposal_expert')::boolean,false) then v_ach:=v_ach||'{"bomb_disposal_expert":true}'::jsonb;v_unlocks:=v_unlocks||'["bomb_shirt"]'::jsonb;v_new_ach:=array_append(v_new_ach,'bomb_disposal_expert');end if;
    if v_new_wins>=10 then v_unlocks:=v_unlocks||'["goblin_slayer_helmet"]'::jsonb; end if;
    if v_new_wins>=25 and not coalesce((v_ach->>'goblin_nightmare')::boolean,false) then v_ach:=v_ach||'{"goblin_nightmare":true}'::jsonb;v_unlocks:=v_unlocks||'["golden_dash"]'::jsonb;v_new_ach:=array_append(v_new_ach,'goblin_nightmare');end if;
    if v_new_streak>=10 and not coalesce((v_ach->>'slayer_maniac')::boolean,false) then v_ach:=v_ach||'{"slayer_maniac":true}'::jsonb;v_unlocks:=v_unlocks||'["champion_crown"]'::jsonb;v_new_ach:=array_append(v_new_ach,'slayer_maniac');end if;
    if p_eliminations>=5 and not coalesce((v_ach->>'absolute_menace')::boolean,false) then v_ach:=v_ach||'{"absolute_menace":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'absolute_menace');end if;
    if p_panic_passes>=3 and not coalesce((v_ach->>'panic_master')::boolean,false) then v_ach:=v_ach||'{"panic_master":true}'::jsonb;v_new_ach:=array_append(v_new_ach,'panic_master');end if;
    if v_new_wins>=50 then v_unlocks:=v_unlocks||'["bomb_king_cape"]'::jsonb; end if;
    if p.total_eliminations+p_eliminations>=500 then v_unlocks:=v_unlocks||'["slayer_flame_aura"]'::jsonb; end if;
  end if;

  update public.characters
     set slayer_xp=coalesce(slayer_xp,0)+v_xp,
         gp=coalesce(gp,0)+v_gp
   where user_id=v_uid
   returning slayer_xp,gp into v_new_slayer,v_new_gp;

  update public.goblin_bomb_profiles
     set total_matches=total_matches+1,
         wins=v_new_wins,
         losses=losses+(case when p_placement<>1 and v_valid then 1 else 0 end),
         current_streak=v_new_streak,
         highest_streak=greatest(highest_streak,v_new_streak),
         highest_score=greatest(highest_score,v_score),
         total_eliminations=total_eliminations+(case when v_valid then p_eliminations else 0 end),
         total_passes=total_passes+(case when v_valid then p_passes else 0 end),
         total_throws=total_throws+(case when v_valid then p_throws else 0 end),
         total_dash_hits=total_dash_hits+(case when v_valid then p_dash_hits else 0 end),
         total_last_second=total_last_second+(case when v_valid then p_last_second else 0 end),
         total_environmental=total_environmental+(case when v_valid then p_environmental else 0 end),
         total_score=total_score+(case when v_valid then v_score else 0 end),
         fastest_victory_ms=v_fastest,
         total_slayer_xp=total_slayer_xp+v_xp,
         total_gp=total_gp+v_gp,
         veteran_wins=veteran_wins+(case when v_valid and p_placement=1 and m.difficulty='veteran' then 1 else 0 end),
         insane_wins=insane_wins+(case when v_valid and p_placement=1 and m.difficulty='insane' then 1 else 0 end),
         achievements=v_ach,
         unlocked_cosmetics=(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select distinct value::text as x from jsonb_array_elements_text(v_unlocks)) q),
         last_updated=now()
   where user_id=v_uid;

  update public.goblin_bomb_matches
     set status='claimed',completed_at=now(),placement=p_placement,score=v_score,metrics=v_metrics,
         valid_participation=v_valid,reward_gp=v_gp,reward_xp=v_xp
   where id=p_match_id;

  return jsonb_build_object(
    'xp_gained',v_xp,'gp_gained',v_gp,'new_slayer_xp',v_new_slayer,'new_gp',v_new_gp,
    'valid_participation',v_valid,'already_claimed',false,
    'new_achievements',to_jsonb(v_new_ach),
    'profile',public.goblin_bomb_profile_json(v_uid)
  );
end;
$$;

create or replace function public.goblin_bomb_get_leaderboards()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select jsonb_build_object(
   'most_wins',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.wins value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id order by p.wins desc,p.last_updated asc limit 10) q),'[]'::jsonb),
   'highest_score',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.highest_score value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id order by p.highest_score desc,p.last_updated asc limit 10) q),'[]'::jsonb),
   'highest_streak',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.highest_streak value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id order by p.highest_streak desc,p.last_updated asc limit 10) q),'[]'::jsonb),
   'most_eliminations',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.total_eliminations value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id order by p.total_eliminations desc,p.last_updated asc limit 10) q),'[]'::jsonb),
   'last_second',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.total_last_second value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id order by p.total_last_second desc,p.last_updated asc limit 10) q),'[]'::jsonb),
   'fastest_victory',coalesce((select jsonb_agg(jsonb_build_object('username',q.username,'value',q.value)) from (select c.username,p.fastest_victory_ms value from public.goblin_bomb_profiles p join public.characters c on c.user_id=p.user_id where p.fastest_victory_ms>0 order by p.fastest_victory_ms asc,p.last_updated asc limit 10) q),'[]'::jsonb)
  ) into r;
  return r;
end;
$$;

revoke all on function public.goblin_bomb_get_profile() from public, anon;
revoke all on function public.goblin_bomb_save_profile(jsonb,jsonb,text,jsonb) from public, anon;
revoke all on function public.goblin_bomb_start_match(text,text) from public, anon;
revoke all on function public.goblin_bomb_complete_match(uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public, anon;
revoke all on function public.goblin_bomb_get_leaderboards() from public, anon;
grant execute on function public.goblin_bomb_get_profile() to authenticated;
grant execute on function public.goblin_bomb_save_profile(jsonb,jsonb,text,jsonb) to authenticated;
grant execute on function public.goblin_bomb_start_match(text,text) to authenticated;
grant execute on function public.goblin_bomb_complete_match(uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer) to authenticated;
grant execute on function public.goblin_bomb_get_leaderboards() to authenticated;
notify pgrst,'reload schema';
