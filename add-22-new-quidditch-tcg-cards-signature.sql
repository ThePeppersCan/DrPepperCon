-- Repo Company TCG expansion: 22 new cards + Signature rarity
-- Safe/additive: preserves existing collections, favourites, pack inventory and XP.
-- Run once in Supabase -> SQL Editor, then deploy the included website files.

begin;

create or replace function public.get_my_quidditch_tcg_collection()
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql security definer set search_path=public as $$
  select c.username,
         coalesce(q.cards,'{}'::text[]) as cards,
         cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
         97::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where c.user_id=auth.uid()
  limit 1
$$;

grant execute on function public.get_my_quidditch_tcg_collection() to authenticated;

create or replace function public.get_public_quidditch_tcg_collection(p_username text)
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql security definer set search_path=public as $$
  select c.username,
         coalesce(q.cards,'{}'::text[]) as cards,
         cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
         97::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username)=lower(trim(p_username))
    and (lower(trim(c.username))<>'admin' or c.user_id=auth.uid())
  limit 1
$$;

grant execute on function public.get_public_quidditch_tcg_collection(text) to anon, authenticated;

create or replace function public.open_quidditch_tcg_pack()
returns table(
  card_id text,
  owned_cards text[],
  bank_items jsonb,
  skill_one text,
  skill_one_xp integer,
  skill_one_total integer,
  skill_two text,
  skill_two_xp integer,
  skill_two_total integer,
  all_cards_owned boolean
)
language plpgsql security definer set search_path=public as $$
declare
  v_items jsonb;
  v_quantity integer;
  v_owned text[];
  v_available text[];
  v_card text;
  v_all_cards text[]:=array[
    'soup',
    'besquelcher',
    'debbie',
    'dopey_dom',
    'jud',
    'mad_rager',
    'mod_ash',
    'nimbler_2000',
    'rocky',
    'rocky_full_art',
    'soup_full_art',
    'nimbler_2000_full_art',
    'debbie_full_art',
    'besquelcher_full_art',
    'changing_room_full_art',
    'barry_bramble_full_art',
    'golden_snitch_rising_full_art',
    'healers_bench_full_art',
    'matchday_tunnel_full_art',
    'reposports_castle_arena_full_art',
    'rocky_legendary_full_art',
    'debbie_legendary_full_art',
    'soup_legendary_full_art',
    'besquelcher_legendary_full_art',
    'proco_legendary_full_art',
    'emlux_legendary_full_art',
    'catasthma_legendary_full_art',
    'covidpanda_legendary_full_art',
    'smokedrope1028_legendary_full_art',
    'nimbler_2000_legendary_full_art',
    'boomstick',
    'barrys_tip_jar',
    'changing_room_champions_standard',
    'morytania_marsh_arena_standard',
    'mos_le_harmless_skycourt_standard',
    'camelot_crown_arena_standard',
    'forbidden_forest_flightground_standard',
    'tzhaar_dragonfire_stadium_standard',
    'gnome_stronghold_canopy_pitch_standard',
    'burrow_hill_quidditch_ground_standard',
    'caerphilly_storm_grounds_standard',
    'keldagrim_stoneworks_stadium_standard',
    'shi_wayward_shot',
    'swiped_rocky',
    'trollweiss_quidditch_grounds_standard',
    'var_match_review',
    'besquelcher_1000_club_platinum',
    'barry_mod_ash_deadly_duo_platinum',
    'besquelcher_jud_deadly_duo_platinum',
    'rocky_debbie_deadly_duo_platinum',
    'soup_nimbler_deadly_duo_platinum',
    'debbie_1000_club_platinum',
    'mod_ash_1000_club_platinum',
    'rocky_1000_club_platinum',
    'soup_1000_club_platinum',
    'repo_company_legendary_full_art',
    'besquelcher_millennium',
    'debbie_millennium',
    'mod_ash_millennium',
    'rocky_millennium',
    'soup_millennium',
    'jud_debbie_rival',
    'nimbler_besquelcher_rival',
    'rocky_mod_ash_rival',
    'practice_makes_perfect_standard',
    'snitch_senses_standard',
    'team_photo_standard',
    'show_some_love_standard',
    'snitch_stuck_again_standard',
    'post_game_feast_standard',
    'repo_sports_world_cup_standard',
    'halftime_hangout_standard',
    'broom_shop_myth_standard',
    'barrys_burger_cart_standard',
    'back_in_the_day_barry_full_art',
    'berry_bramble_full_art',
    'rocky_signature',
    'debbie_signature',
    'jud_signature',
    'mod_ash_signature',
    'nimbler_2000_signature',
    'soup_signature',
    'besquelcher_signature',
    'back_from_retirement_standard',
    'binder_flex_standard',
    'verdant_whisper_standard',
    'frostbound_arc_standard',
    'cinder_spite_standard',
    'amethyst_reign_standard',
    'starweave_comet_standard',
    'gravemark_glider_standard',
    'moonlit_hush_standard',
    'cat_on_the_pitch_standard',
    'keepers_dream_standard',
    'keepers_nightmare_standard',
    'mash_and_grab_standard'
  ];
  v_skills text[]:=array[
    'woodcutting','mining','fishing','agility','slayer','attack','strength','defence',
    'magic','ranged','sailing','runecrafting','cooking','farming'
  ];
  v_skill_one text;
  v_skill_two text;
  v_column_one text;
  v_column_two text;
  v_total_one integer;
  v_total_two integer;
  v_username text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select coalesce(c.bank_items,'{}'::jsonb),lower(trim(coalesce(c.username,'')))
    into v_items,v_username
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then raise exception 'Character not found.'; end if;

  v_quantity:=greatest(0,coalesce((v_items->>'quidditch_tcg_pack')::integer,0));
  if v_username='admin' then
    v_quantity:=greatest(1,v_quantity);
    v_items:=jsonb_set(v_items,'{quidditch_tcg_pack}','1'::jsonb,true);
  elsif v_quantity<1 then
    raise exception 'You do not have a Quidditch TCG pack.';
  end if;

  insert into public.quidditch_tcg_collections(user_id,cards)
  values(auth.uid(),'{}'::text[])
  on conflict(user_id) do nothing;

  select coalesce(q.cards,'{}'::text[])
    into v_owned
  from public.quidditch_tcg_collections q
  where q.user_id=auth.uid()
  for update;

  select coalesce(array_agg(card order by ord),'{}'::text[])
    into v_available
  from unnest(v_all_cards) with ordinality as available(card,ord)
  where not (card=any(v_owned));

  if cardinality(v_available)=0 then
    raise exception 'You already own every current Quidditch TCG pack card. The pack was not consumed.';
  end if;

  -- Duplicate-proof rarity pools.
  -- Millennium 2%, Signature 3%, Gold Legendary 4%, Rival 7%, Platinum 8%, Full Art 22%, Standard 54%.
  declare
    v_standard_available text[];
    v_full_art_available text[];
    v_platinum_available text[];
    v_rival_available text[];
    v_legendary_available text[];
    v_signature_available text[];
    v_millennium_available text[];
    v_roll double precision:=random();
  begin
    select coalesce(array_agg(card),'{}'::text[]) into v_millennium_available
      from unnest(v_available) card where card like '%_millennium';
    select coalesce(array_agg(card),'{}'::text[]) into v_signature_available
      from unnest(v_available) card where card like '%_signature';
    select coalesce(array_agg(card),'{}'::text[]) into v_legendary_available
      from unnest(v_available) card where card like '%_legendary_full_art';
    select coalesce(array_agg(card),'{}'::text[]) into v_rival_available
      from unnest(v_available) card where card like '%_rival';
    select coalesce(array_agg(card),'{}'::text[]) into v_platinum_available
      from unnest(v_available) card where card like '%_platinum';
    select coalesce(array_agg(card),'{}'::text[]) into v_full_art_available
      from unnest(v_available) card
      where card like '%_full_art' and card not like '%_legendary_full_art';
    select coalesce(array_agg(card),'{}'::text[]) into v_standard_available
      from unnest(v_available) card
      where card not like '%_millennium'
        and card not like '%_signature'
        and card not like '%_legendary_full_art'
        and card not like '%_rival'
        and card not like '%_platinum'
        and card not like '%_full_art';

    if cardinality(v_millennium_available)>0 and v_roll<0.02 then
      v_card:=v_millennium_available[1+floor(random()*cardinality(v_millennium_available))::integer];
    elsif cardinality(v_signature_available)>0 and v_roll<0.05 then
      v_card:=v_signature_available[1+floor(random()*cardinality(v_signature_available))::integer];
    elsif cardinality(v_legendary_available)>0 and v_roll<0.09 then
      v_card:=v_legendary_available[1+floor(random()*cardinality(v_legendary_available))::integer];
    elsif cardinality(v_rival_available)>0 and v_roll<0.16 then
      v_card:=v_rival_available[1+floor(random()*cardinality(v_rival_available))::integer];
    elsif cardinality(v_platinum_available)>0 and v_roll<0.24 then
      v_card:=v_platinum_available[1+floor(random()*cardinality(v_platinum_available))::integer];
    elsif cardinality(v_full_art_available)>0 and v_roll<0.46 then
      v_card:=v_full_art_available[1+floor(random()*cardinality(v_full_art_available))::integer];
    elsif cardinality(v_standard_available)>0 then
      v_card:=v_standard_available[1+floor(random()*cardinality(v_standard_available))::integer];
    elsif cardinality(v_full_art_available)>0 then
      v_card:=v_full_art_available[1+floor(random()*cardinality(v_full_art_available))::integer];
    elsif cardinality(v_platinum_available)>0 then
      v_card:=v_platinum_available[1+floor(random()*cardinality(v_platinum_available))::integer];
    elsif cardinality(v_rival_available)>0 then
      v_card:=v_rival_available[1+floor(random()*cardinality(v_rival_available))::integer];
    elsif cardinality(v_legendary_available)>0 then
      v_card:=v_legendary_available[1+floor(random()*cardinality(v_legendary_available))::integer];
    elsif cardinality(v_signature_available)>0 then
      v_card:=v_signature_available[1+floor(random()*cardinality(v_signature_available))::integer];
    else
      v_card:=v_millennium_available[1+floor(random()*cardinality(v_millennium_available))::integer];
    end if;
  end;

  v_skill_one:=v_skills[1+floor(random()*cardinality(v_skills))::integer];
  loop
    v_skill_two:=v_skills[1+floor(random()*cardinality(v_skills))::integer];
    exit when v_skill_two<>v_skill_one;
  end loop;

  v_column_one:=v_skill_one||'_xp';
  v_column_two:=v_skill_two||'_xp';
  if v_username='admin' then
    v_items:=jsonb_set(v_items,'{quidditch_tcg_pack}','1'::jsonb,true);
  else
    v_items:=jsonb_set(v_items,'{quidditch_tcg_pack}',to_jsonb(v_quantity-1),true);
  end if;

  execute format(
    'update public.characters
        set bank_items=$1,
            %I=coalesce(%I,0)+$2,
            %I=coalesce(%I,0)+$3
      where user_id=$4
      returning %I,%I',
    v_column_one,v_column_one,v_column_two,v_column_two,v_column_one,v_column_two
  ) into v_total_one,v_total_two
  using v_items,5000,10000,auth.uid();

  v_owned:=array_append(v_owned,v_card);
  update public.quidditch_tcg_collections
     set cards=v_owned,
         opened_count=opened_count+1,
         updated_at=now()
   where user_id=auth.uid();

  return query select
    v_card,v_owned,v_items,v_skill_one,5000,v_total_one,
    v_skill_two,10000,v_total_two,
    cardinality(v_owned)>=cardinality(v_all_cards);
end;
$$;

grant execute on function public.open_quidditch_tcg_pack() to authenticated;
notify pgrst,'reload schema';
commit;
