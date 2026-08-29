create or replace function public.get_sendgrid_api_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'SENDGRID_API_KEY'
  limit 1;
$$;

revoke all on function public.get_sendgrid_api_key() from public, anon, authenticated;
grant execute on function public.get_sendgrid_api_key() to service_role;
