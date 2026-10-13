create unique index if not exists deposits_reference_unique
  on public.deposits (reference);

create or replace function public.process_paystack_deposit(
  p_user_id uuid,
  p_reference text,
  p_amount numeric,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_deposit public.deposits%rowtype;
begin
  if p_reference is null or length(trim(p_reference)) = 0 then
    raise exception 'Payment reference is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Deposit amount must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_reference, 0));

  select *
    into existing_deposit
    from public.deposits
   where reference = p_reference
   for update;

  if found then
    if existing_deposit.user_id <> p_user_id
      or existing_deposit.amount <> p_amount then
      raise exception 'Reference already belongs to a different payment';
    end if;

    if lower(coalesce(existing_deposit.status, '')) = 'completed' then
      return jsonb_build_object(
        'already_processed', true,
        'reference', p_reference
      );
    end if;

    update public.customers
       set balance = coalesce(balance, 0) + p_amount
     where auth_id = p_user_id;

    if not found then
      raise exception 'Customer not found for user %', p_user_id;
    end if;

    update public.deposits
       set status = 'completed',
           payment_method = coalesce(nullif(p_payment_method, ''), 'unknown'),
           completed_at = now()
     where id = existing_deposit.id;

    return jsonb_build_object(
      'already_processed', false,
      'reference', p_reference
    );
  end if;

  update public.customers
     set balance = coalesce(balance, 0) + p_amount
   where auth_id = p_user_id;

  if not found then
    raise exception 'Customer not found for user %', p_user_id;
  end if;

  insert into public.deposits (
    user_id,
    reference,
    amount,
    status,
    payment_method,
    completed_at
  ) values (
    p_user_id,
    p_reference,
    p_amount,
    'completed',
    coalesce(nullif(p_payment_method, ''), 'unknown'),
    now()
  );

  return jsonb_build_object(
    'already_processed', false,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.process_paystack_deposit(uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.process_paystack_deposit(uuid, text, numeric, text)
  to service_role;