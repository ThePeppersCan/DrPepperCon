-- Repo Company: persistent favourite Quidditch TCG card
-- Run once in Supabase -> SQL Editor.
-- Preserves all existing cards, packs, binder layouts and account data.

alter table public.quidditch_tcg_collections
  add column if not exists favourite_card text;

create or replace function public.get_my_favourite_quidditch_tcg_card()
returns table(username text, favourite_card text)
language sql
security definer
set search_path=public
as $$
  select c.username, q.favourite_card
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where c.user_id=auth.uid()
  limit 1
$$;

grant execute on function public.get_my_favourite_quidditch_tcg_card() to authenticated;

create or replace function public.set_favourite_quidditch_tcg_card(p_card_id text)
returns table(favourite_card text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_card text:=nullif(btrim(coalesce(p_card_id,'')),'');
  v_cards text[];
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  insert into public.quidditch_tcg_collections(user_id,cards)
  values(auth.uid(),'{}'::text[])
  on conflict(user_id) do nothing;

  select coalesce(q.cards,'{}'::text[])
    into v_cards
  from public.quidditch_tcg_collections q
  where q.user_id=auth.uid()
  for update;

  if v_card is not null and not (v_card=any(v_cards)) then
    raise exception 'You can only favourite a card you own.';
  end if;

  update public.quidditch_tcg_collections q
     set favourite_card=v_card,
         updated_at=now()
   where q.user_id=auth.uid();

  return query select v_card;
end;
$$;

grant execute on function public.set_favourite_quidditch_tcg_card(text) to authenticated;

create or replace function public.get_favourite_quidditch_tcg_cards(p_usernames text[])
returns table(username text, favourite_card text)
language sql
security definer
set search_path=public
as $$
  select c.username, q.favourite_card
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username) in (
    select lower(btrim(name))
    from unnest(coalesce(p_usernames,'{}'::text[])) as requested(name)
    where btrim(name)<>''
  )
  order by c.username
$$;

grant execute on function public.get_favourite_quidditch_tcg_cards(text[]) to anon, authenticated;

notify pgrst,'reload schema';
