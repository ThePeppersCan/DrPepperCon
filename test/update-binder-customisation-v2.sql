-- REPO COMPANY: BINDER CUSTOMISATION V2
-- Run this whole file once in Supabase -> SQL Editor.
-- Keeps every account, card, GP balance and existing binder choice unchanged.

alter table public.characters
  add column if not exists binder_theme text not null default 'midnight',
  add column if not exists binder_effect text not null default 'stardust',
  add column if not exists binder_finish text not null default 'classic';

update public.characters
set binder_theme = case
      when lower(coalesce(binder_theme,'')) in (
        'midnight','emerald','royal','crimson','frost','golden',
        'ocean','rose','obsidian','sunfire'
      ) then lower(binder_theme)
      else 'midnight'
    end,
    binder_effect = case
      when lower(coalesce(binder_effect,'')) in (
        'calm','stardust','aurora','embers','goldfall','moonmist',
        'runes','fireflies','comet','ripple'
      ) then lower(binder_effect)
      else 'stardust'
    end,
    binder_finish = case
      when lower(coalesce(binder_finish,'')) in (
        'classic','crystal','shadow','platinum','enchanted'
      ) then lower(binder_finish)
      else 'classic'
    end;

-- Keep the original two-setting RPC compatible with the expanded choices.
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
  if v_theme not in (
    'midnight','emerald','royal','crimson','frost','golden',
    'ocean','rose','obsidian','sunfire'
  ) then
    raise exception 'Invalid binder colour theme';
  end if;
  if v_effect not in (
    'calm','stardust','aurora','embers','goldfall','moonmist',
    'runes','fireflies','comet','ripple'
  ) then
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

-- V2 RPCs include the new pocket finish setting.
create or replace function public.get_my_quidditch_binder_style_v2()
returns table(username text, theme text, effect text, finish text)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         coalesce(c.binder_effect,'stardust')::text,
         coalesce(c.binder_finish,'classic')::text
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_public_quidditch_binder_style_v2(p_username text)
returns table(username text, theme text, effect text, finish text)
language sql
security definer
set search_path = public
as $$
  select c.username::text,
         coalesce(c.binder_theme,'midnight')::text,
         coalesce(c.binder_effect,'stardust')::text,
         coalesce(c.binder_finish,'classic')::text
  from public.characters c
  where lower(c.username) = lower(btrim(p_username))
    and lower(c.username) <> 'admin'
  limit 1;
$$;

create or replace function public.set_my_quidditch_binder_style_v2(
  p_theme text,
  p_effect text,
  p_finish text
)
returns table(theme text, effect text, finish text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text := lower(btrim(coalesce(p_theme,'')));
  v_effect text := lower(btrim(coalesce(p_effect,'')));
  v_finish text := lower(btrim(coalesce(p_finish,'')));
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;
  if v_theme not in (
    'midnight','emerald','royal','crimson','frost','golden',
    'ocean','rose','obsidian','sunfire'
  ) then
    raise exception 'Invalid binder colour theme';
  end if;
  if v_effect not in (
    'calm','stardust','aurora','embers','goldfall','moonmist',
    'runes','fireflies','comet','ripple'
  ) then
    raise exception 'Invalid binder background effect';
  end if;
  if v_finish not in ('classic','crystal','shadow','platinum','enchanted') then
    raise exception 'Invalid binder pocket finish';
  end if;

  return query
  update public.characters c
     set binder_theme = v_theme,
         binder_effect = v_effect,
         binder_finish = v_finish
   where c.user_id = auth.uid()
  returning c.binder_theme::text, c.binder_effect::text, c.binder_finish::text;

  if not found then
    raise exception 'Character not found';
  end if;
end;
$$;

revoke all on function public.get_my_quidditch_binder_style_v2() from public;
revoke all on function public.get_public_quidditch_binder_style_v2(text) from public;
revoke all on function public.set_my_quidditch_binder_style_v2(text,text,text) from public;

grant execute on function public.get_my_quidditch_binder_style_v2() to authenticated;
grant execute on function public.get_public_quidditch_binder_style_v2(text) to anon, authenticated;
grant execute on function public.set_my_quidditch_binder_style_v2(text,text,text) to authenticated;
grant execute on function public.set_my_quidditch_binder_style(text,text) to authenticated;

notify pgrst, 'reload schema';
