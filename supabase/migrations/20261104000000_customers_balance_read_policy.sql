-- Allow every signed-in customer to read their own customers row.
-- This is required by dashboard, airtime, data, and deposit balance loaders.

alter table public.customers enable row level security;

drop policy if exists "Customers can read own row" on public.customers;

drop policy if exists "Customers can select own row" on public.customers;

create policy "Customers can read own row"
on public.customers
for select
to authenticated
using (
  auth_id::text = (select auth.uid())::text
);

grant select on public.customers to authenticated;
