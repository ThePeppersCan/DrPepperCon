-- Repo Company: keep the Admin Quidditch TCG binder private.
-- Run this once in Supabase > SQL Editor.
-- Other public binders remain visible.

create or replace function public.get_public_quidditch_tcg_collection(p_username text)
returns table(username text, cards text[], card_count integer, total_cards integer)
language sql
security definer
set search_path=public
as $$
  select
    c.username,
    coalesce(q.cards,'{}'::text[]) as cards,
    cardinality(coalesce(q.cards,'{}'::text[]))::integer as card_count,
    55::integer as total_cards
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username)=lower(trim(p_username))
    and (
      lower(trim(c.username)) <> 'admin'
      or c.user_id = auth.uid()
    )
  limit 1
$$;

grant execute on function public.get_public_quidditch_tcg_collection(text) to anon, authenticated;
