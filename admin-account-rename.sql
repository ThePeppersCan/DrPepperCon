-- Run once in the Supabase SQL editor.
-- Enables CatAsthma to rename existing accounts while preserving their auth UUID.

create table if not exists public.account_rename_aliases (
  username_key text primary key,
  identity_key text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.account_rename_aliases enable row level security;
drop policy if exists "Public can read account artwork aliases" on public.account_rename_aliases;
create policy "Public can read account artwork aliases"
on public.account_rename_aliases for select using (true);

-- Seed permanent artwork identities for accounts with bespoke assets.
insert into public.account_rename_aliases(username_key,identity_key,user_id)
select lower(regexp_replace(c.username,'[^a-zA-Z0-9]','','g')), lower(regexp_replace(c.username,'[^a-zA-Z0-9]','','g')), c.user_id
from public.characters c
where lower(regexp_replace(c.username,'[^a-zA-Z0-9]','','g')) in ('catasthma','lemime','emlux','proco','smokedrope1028')
on conflict (username_key) do nothing;

create or replace function public.is_repo_site_admin()
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists (
    select 1 from public.characters c
    left join public.account_rename_aliases a on a.user_id=c.user_id
    where c.user_id=auth.uid()
      and coalesce(a.identity_key,lower(regexp_replace(c.username,'[^a-zA-Z0-9]','','g')))='catasthma'
  );
$$;

create or replace function public.admin_list_accounts_for_rename()
returns table(user_id uuid, username text)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_repo_site_admin() then raise exception 'Admin access required'; end if;
  return query select c.user_id,c.username from public.characters c order by lower(c.username);
end;
$$;

create or replace function public.admin_rename_account(p_user_id uuid,p_new_username text)
returns table(old_username text,new_username text,identity_key text)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_old text;
  v_new text:=trim(p_new_username);
  v_identity text;
  v_old_key text;
  v_new_key text;
begin
  if not public.is_repo_site_admin() then raise exception 'Admin access required'; end if;
  if v_new !~ '^[A-Za-z0-9_-]{3,16}$' then raise exception 'Name must use 3-16 letters, numbers, underscores or hyphens'; end if;
  select c.username into v_old from public.characters c where c.user_id=p_user_id for update;
  if v_old is null then raise exception 'Account not found'; end if;
  if exists(select 1 from public.characters c where lower(c.username)=lower(v_new) and c.user_id<>p_user_id) then raise exception 'That account name is already taken'; end if;
  v_old_key:=lower(regexp_replace(v_old,'[^a-zA-Z0-9]','','g'));
  v_new_key:=lower(regexp_replace(v_new,'[^a-zA-Z0-9]','','g'));
  select a.identity_key into v_identity from public.account_rename_aliases a where a.user_id=p_user_id order by a.created_at limit 1;
  v_identity:=coalesce(v_identity,v_old_key);

  update public.characters set username=v_new where user_id=p_user_id;
  update auth.users
     set email=lower(v_new)||'@conofdrpepper.local',
         raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',v_new),
         updated_at=now()
   where id=p_user_id;

  insert into public.account_rename_aliases(username_key,identity_key,user_id)
  values(v_old_key,v_identity,p_user_id),(v_new_key,v_identity,p_user_id)
  on conflict(username_key) do update set identity_key=excluded.identity_key,user_id=excluded.user_id;

  return query select v_old,v_new,v_identity;
end;
$$;

grant execute on function public.admin_list_accounts_for_rename() to authenticated;
grant execute on function public.admin_rename_account(uuid,text) to authenticated;
grant execute on function public.is_repo_site_admin() to authenticated;
