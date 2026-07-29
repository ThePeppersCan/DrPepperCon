-- REPO COMPANY GRAND EXCHANGE SHOP
-- Run once in Supabase -> SQL Editor. Preserves all accounts, GP and Bank items.

alter table public.characters
  add column if not exists bank_items jsonb not null default '{}'::jsonb;

create table if not exists public.grand_exchange_items (
  item_id text primary key check (item_id ~ '^[a-z0-9_\-]{2,50}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  price integer not null check (price > 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.grand_exchange_items enable row level security;
revoke all on public.grand_exchange_items from anon, authenticated;

create or replace function public.get_grand_exchange_items(p_search text default '')
returns table(item_id text, name text, description text, price integer, image_url text)
language sql security definer set search_path=public as $$
  select i.item_id,i.name,i.description,i.price,i.image_url
  from public.grand_exchange_items i
  where i.active
    and (coalesce(trim(p_search),'')='' or i.name ilike '%'||trim(p_search)||'%' or i.description ilike '%'||trim(p_search)||'%')
  order by i.sort_order asc,i.name asc
  limit 100;
$$;

create or replace function public.buy_grand_exchange_item(p_item_id text,p_quantity integer default 1)
returns table(new_gp integer,bank_items jsonb,item_name text,quantity integer,spent_gp integer)
language plpgsql security definer set search_path=public as $$
declare
  v_item public.grand_exchange_items%rowtype;
  v_gp integer;
  v_items jsonb;
  v_cost integer;
  v_current integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if p_quantity < 1 or p_quantity > 100 then raise exception 'Invalid quantity'; end if;
  select * into v_item from public.grand_exchange_items where item_id=p_item_id and active limit 1;
  if v_item.item_id is null then raise exception 'Item is not available'; end if;
  v_cost:=v_item.price*p_quantity;
  select coalesce(c.gp,0),coalesce(c.bank_items,'{}'::jsonb) into v_gp,v_items
  from public.characters c where c.user_id=auth.uid() for update;
  if v_gp is null then raise exception 'Character not found'; end if;
  if v_gp<v_cost then raise exception 'Not enough Gold pieces'; end if;
  v_current:=coalesce((v_items->>p_item_id)::integer,0);
  v_items:=jsonb_set(v_items,array[p_item_id],to_jsonb(v_current+p_quantity),true);
  update public.characters set gp=v_gp-v_cost,bank_items=v_items where user_id=auth.uid();
  return query select v_gp-v_cost,v_items,v_item.name,p_quantity,v_cost;
end;
$$;

grant execute on function public.get_grand_exchange_items(text) to authenticated;
grant execute on function public.buy_grand_exchange_item(text,integer) to authenticated;
notify pgrst,'reload schema';

-- Add future shop items with commands like:
-- insert into public.grand_exchange_items(item_id,name,description,price,image_url,sort_order)
-- values ('example_item','Example Item','A future Repo Company reward.',250,null,10);
