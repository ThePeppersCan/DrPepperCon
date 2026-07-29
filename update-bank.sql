-- REPO COMPANY PERSONAL BANK
-- Run once in Supabase -> SQL Editor. Preserves all accounts, XP, GP and tasks.

alter table public.characters
  add column if not exists bank_items jsonb not null default '{}'::jsonb;

create or replace function public.get_my_bank()
returns table(gp integer, items jsonb)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(c.gp, 0)::integer,
    coalesce(c.bank_items, '{}'::jsonb)
  from public.characters c
  where c.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_bank() to authenticated;
notify pgrst, 'reload schema';
