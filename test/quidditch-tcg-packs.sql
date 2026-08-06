-- Repo Company: Quidditch TCG card packs and public binders
-- Run this file once in the Supabase SQL Editor.
-- It adds persistent, duplicate-proof card collections and two secure pack RPCs.

create table if not exists public.quidditch_tcg_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cards text[] not null default '{}'::text[],
  opened_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.quidditch_tcg_collections enable row level security;
revoke all on table public.quidditch_tcg_collections from anon, authenticated;

create or replace function public.get_my_quidditch_tcg_collection()
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql security definer set search_path=public as $$
  select c.username,
         coalesce(q.cards,'{}'::text[]) as cards,
         cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
         20::integer as total_cards
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
         20::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username)=lower(trim(p_username))
  limit 1
$$;

grant execute on function public.get_public_quidditch_tcg_collection(text) to anon, authenticated;

create or replace function public.buy_quidditch_tcg_pack()
returns table(new_gp integer, bank_items jsonb, quantity integer)
language plpgsql security definer set search_path=public as $$
declare
  v_gp integer;
  v_items jsonb;
  v_quantity integer;
  v_price constant integer := 25000;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb)
    into v_gp,v_items
  from public.characters c
  where c.user_id=auth.uid()
  for update;

  if not found then raise exception 'Character not found.'; end if;
  if v_gp<v_price then raise exception 'You need 25,000 GP to buy this pack.'; end if;

  v_quantity:=greatest(0,coalesce((v_items->>'quidditch_tcg_pack')::integer,0))+1;
  v_items:=jsonb_set(v_items,'{quidditch_tcg_pack}',to_jsonb(v_quantity),true);

  update public.characters
     set gp=v_gp-v_price,
         bank_items=v_items
   where user_id=auth.uid();

  return query select v_gp-v_price,v_items,v_quantity;
end;
$$;

grant execute on function public.buy_quidditch_tcg_pack() to authenticated;

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
    'soup','besquelcher','debbie','dopey_dom','jud','mad_rager','mod_ash','nimbler_2000','rocky',
    'rocky_full_art','soup_full_art','nimbler_2000_full_art','debbie_full_art',
    'besquelcher_full_art','changing_room_full_art','barry_bramble_full_art',
    'golden_snitch_rising_full_art','healers_bench_full_art','matchday_tunnel_full_art','reposports_castle_arena_full_art',
    'rocky_legendary_full_art','debbie_legendary_full_art','soup_legendary_full_art','besquelcher_legendary_full_art',
    'proco_legendary_full_art','emlux_legendary_full_art','catasthma_legendary_full_art','covidpanda_legendary_full_art',
    'smokedrope1028_legendary_full_art','nimbler_2000_legendary_full_art'
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
  -- The Admin account has one permanent testing pack. It may always open the
  -- pack and the quantity is restored to 1 inside the same locked transaction.
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
    raise exception 'You already own every current Quidditch TCG card. The pack was not consumed.';
  end if;

  -- Three rarity pools with duplicate protection:
  -- Legendary Full Art: 1/25, Special Full Art: 1/3 when Legendary does not hit, then Standard.
  declare
    v_standard_available text[];
    v_full_art_available text[];
    v_legendary_available text[];
    v_roll double precision:=random();
  begin
    select coalesce(array_agg(card),'{}'::text[]) into v_legendary_available
    from unnest(v_available) card where card like '%_legendary_full_art';
    select coalesce(array_agg(card),'{}'::text[]) into v_full_art_available
    from unnest(v_available) card where card like '%_full_art' and card not like '%_legendary_full_art';
    select coalesce(array_agg(card),'{}'::text[]) into v_standard_available
    from unnest(v_available) card where card not like '%_full_art';

    if cardinality(v_legendary_available)>0 and (
      (cardinality(v_full_art_available)=0 and cardinality(v_standard_available)=0) or v_roll<1.0/25.0
    ) then
      v_card:=v_legendary_available[1+floor(random()*cardinality(v_legendary_available))::integer];
    elsif cardinality(v_full_art_available)>0 and (
      cardinality(v_standard_available)=0 or random()<1.0/3.0
    ) then
      v_card:=v_full_art_available[1+floor(random()*cardinality(v_full_art_available))::integer];
    elsif cardinality(v_standard_available)>0 then
      v_card:=v_standard_available[1+floor(random()*cardinality(v_standard_available))::integer];
    elsif cardinality(v_full_art_available)>0 then
      v_card:=v_full_art_available[1+floor(random()*cardinality(v_full_art_available))::integer];
    else
      v_card:=v_legendary_available[1+floor(random()*cardinality(v_legendary_available))::integer];
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
    v_card,
    v_owned,
    v_items,
    v_skill_one,
    5000,
    v_total_one,
    v_skill_two,
    10000,
    v_total_two,
    cardinality(v_owned)>=cardinality(v_all_cards);
end;
$$;

grant execute on function public.open_quidditch_tcg_pack() to authenticated;
notify pgrst,'reload schema';
