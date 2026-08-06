-- REPO COMPANY: QUIDDITCH TCG BINDER CUSTOMISATION
-- Run this whole file once in Supabase -> SQL Editor.
-- It keeps all existing accounts, cards, GP and progress unchanged.

alter table public.characters
  add column if not exists binder_theme text not null default 'midnight',
  add column if not exists binder_effect text not null default 'stardust';

update public.characters
set binder_theme = case
      when lower(coalesce(binder_theme,'')) in ('midnight','emerald','royal','crimson','frost','golden') then lower(binder_theme)
      else 'midnight'
    end,
    binder_effect = case
      when lower(coalesce(binder_effect,'')) in ('calm','stardust','aurora','embers','goldfall','moonmist') then lower(binder_effect)
      else 'stardust'
    end;

create or replace function public.get_my_quidditch_binder_style()
returns table(username text, theme text, effect text)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         coalesce(c.binder_effect,'stardust')::text
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_public_quidditch_binder_style(p_username text)
returns table(username text, theme text, effect text)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         coalesce(c.binder_effect,'stardust')::text
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
    and lower(c.username) <> 'admin'
  limit 1;
$$;

create or replace function public.set_my_quidditch_binder_style(p_theme text, p_effect text)
returns table(theme text, effect text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text := lower(btrim(coalesce(p_theme,'')));
  v_effect text := lower(btrim(coalesce(p_effect,'')));
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;
  if v_theme not in ('midnight','emerald','royal','crimson','frost','golden') then
    raise exception 'Invalid binder colour theme';
  end if;
  if v_effect not in ('calm','stardust','aurora','embers','goldfall','moonmist') then
    raise exception 'Invalid binder background effect';
  end if;

  return query
  update public.characters c
     set binder_theme = v_theme,
         binder_effect = v_effect
   where c.user_id = auth.uid()
  returning c.binder_theme::text, c.binder_effect::text;

  if not found then
    raise exception 'Character not found';
  end if;
end;
$$;

revoke all on function public.get_my_quidditch_binder_style() from public;
revoke all on function public.set_my_quidditch_binder_style(text,text) from public;
grant execute on function public.get_my_quidditch_binder_style() to authenticated;
grant execute on function public.set_my_quidditch_binder_style(text,text) to authenticated;
grant execute on function public.get_public_quidditch_binder_style(text) to anon, authenticated;

notify pgrst, 'reload schema';
