-- Quidditch broadcast Sailing advertisement purchase.
-- Run once in the Supabase SQL editor.
create or replace function public.purchase_quidditch_sailing_ad()
returns table(new_gp integer, new_sailing_xp integer, xp_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gp integer;
  v_xp integer;
  v_new_xp integer;
begin
  select coalesce(c.gp,0), coalesce(c.sailing_xp,0)
    into v_gp, v_xp
  from public.characters c
  where c.user_id = auth.uid()
  for update;

  if not found then raise exception 'Character not found.'; end if;
  if v_gp < 1200 then raise exception 'You need 1,200 GP to purchase this advertisement.'; end if;

  v_new_xp := least(13034431, v_xp + 1200);
  update public.characters
  set gp = v_gp - 1200,
      sailing_xp = v_new_xp
  where user_id = auth.uid();

  return query select v_gp - 1200, v_new_xp, v_new_xp - v_xp;
end;
$$;

grant execute on function public.purchase_quidditch_sailing_ad() to authenticated;
