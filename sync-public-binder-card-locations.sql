-- Repo Company: synchronise TCG binder card positions between players.
-- Safe additive migration. Existing cards and local layouts are preserved.

alter table public.quidditch_tcg_collections
  add column if not exists binder_layout jsonb not null default '[]'::jsonb;

create or replace function public.set_my_quidditch_tcg_binder_layout(p_layout jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_layout jsonb:=coalesce(p_layout,'[]'::jsonb);
  v_owned text[];
  v_value jsonb;
  v_card text;
  v_seen text[]:='{}'::text[];
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if jsonb_typeof(v_layout)<>'array' then
    raise exception 'Binder layout must be an array.';
  end if;
  if jsonb_array_length(v_layout)>126 then
    raise exception 'Binder layout exceeds 126 slots.';
  end if;

  insert into public.quidditch_tcg_collections(user_id,cards,binder_layout)
  values(auth.uid(),'{}'::text[],'[]'::jsonb)
  on conflict(user_id) do nothing;

  select coalesce(q.cards,'{}'::text[])
    into v_owned
  from public.quidditch_tcg_collections q
  where q.user_id=auth.uid()
  for update;

  for v_value in select value from jsonb_array_elements(v_layout)
  loop
    if jsonb_typeof(v_value)='null' then
      continue;
    end if;
    if jsonb_typeof(v_value)<>'string' then
      raise exception 'Binder slots may contain only card IDs or null.';
    end if;
    v_card:=trim(both '"' from v_value::text);
    if not (v_card=any(v_owned)) then
      raise exception 'Binder layout contains a card that this account does not own.';
    end if;
    if v_card=any(v_seen) then
      raise exception 'A card cannot occupy more than one binder slot.';
    end if;
    v_seen:=array_append(v_seen,v_card);
  end loop;

  update public.quidditch_tcg_collections q
     set binder_layout=v_layout,
         updated_at=now()
   where q.user_id=auth.uid();

  return v_layout;
end;
$$;

create or replace function public.get_my_quidditch_tcg_binder_layout()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select coalesce(q.binder_layout,'[]'::jsonb)
  from public.quidditch_tcg_collections q
  where q.user_id=auth.uid()
$$;

create or replace function public.get_public_quidditch_tcg_binder_layout(p_username text)
returns jsonb
language sql
security definer
set search_path=public
as $$
  select coalesce(q.binder_layout,'[]'::jsonb)
  from public.characters c
  left join public.quidditch_tcg_collections q on q.user_id=c.user_id
  where lower(c.username)=lower(trim(p_username))
    and lower(c.username)<>'admin'
  limit 1
$$;

revoke all on function public.set_my_quidditch_tcg_binder_layout(jsonb) from public;
revoke all on function public.get_my_quidditch_tcg_binder_layout() from public;
revoke all on function public.get_public_quidditch_tcg_binder_layout(text) from public;

grant execute on function public.set_my_quidditch_tcg_binder_layout(jsonb) to authenticated;
grant execute on function public.get_my_quidditch_tcg_binder_layout() to authenticated;
grant execute on function public.get_public_quidditch_tcg_binder_layout(text) to anon, authenticated;
