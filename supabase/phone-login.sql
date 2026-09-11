create or replace function public.get_login_email_by_phone(phone_value text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.customers
  where (
    case
      when regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g') like '234%'
        then '0' || substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 4)
      else regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g')
    end
  ) = (
    case
      when regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g') like '234%'
        then '0' || substring(regexp_replace(phone_value, '[^0-9]', '', 'g') from 4)
      else regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g')
    end
  )
  limit 1;
$$;

revoke all on function public.get_login_email_by_phone(text) from public;
grant execute on function public.get_login_email_by_phone(text) to anon, authenticated;
