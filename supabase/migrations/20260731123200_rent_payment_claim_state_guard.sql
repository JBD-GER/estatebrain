-- Serialize rent-payment writes with their claim and protect cancelled or
-- already-settled claims even when a client bypasses the application action.

create or replace function private.guard_rent_payment_claim_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_claim_id uuid := case
    when tg_op = 'DELETE' then old.rent_claim_id
    else new.rent_claim_id
  end;
  v_payment_organization_id uuid := case
    when tg_op = 'DELETE' then old.organization_id
    else new.organization_id
  end;
  v_claim_organization_id uuid;
  v_status public.payment_status;
begin
  if tg_op = 'UPDATE'
     and (
       new.organization_id is distinct from old.organization_id
       or new.rent_claim_id is distinct from old.rent_claim_id
     ) then
    raise exception 'A rent payment cannot be moved to another claim'
      using errcode = '23514';
  end if;

  select rc.organization_id, rc.status
    into v_claim_organization_id, v_status
    from public.rent_claims as rc
   where rc.id = v_claim_id
   for update;

  if v_claim_organization_id is null then
    if tg_op = 'DELETE'
       and not exists (
         select 1
           from public.organizations as organization_row
          where organization_row.id = v_payment_organization_id
       ) then
      return old;
    end if;
    raise exception 'Rent claim not found' using errcode = 'P0002';
  end if;

  if tg_op <> 'DELETE'
     and new.organization_id <> v_claim_organization_id then
    raise exception 'Rent payment and claim organization differ'
      using errcode = '23514';
  end if;

  if v_status = 'cancelled'
     and not (
       tg_op = 'DELETE'
       and not exists (
         select 1
           from public.organizations as organization_row
          where organization_row.id = v_payment_organization_id
       )
     ) then
    raise exception 'Cancelled rent claims cannot be changed by payments'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and v_status not in ('open', 'partial') then
    raise exception 'The rent claim no longer accepts new payments'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists rent_payments_claim_state_guard
  on public.rent_payments;
create trigger rent_payments_claim_state_guard
  before insert or update or delete on public.rent_payments
  for each row execute function private.guard_rent_payment_claim_state();

comment on function private.guard_rent_payment_claim_state() is
  'Locks the related claim and prevents stale, cross-claim, settled, or cancelled payment mutations.';
