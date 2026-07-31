-- A rent payment must never point to a claim from another organization.
-- RLS validates the submitted organization, while this composite foreign key
-- binds the related claim to that exact tenant scope for every write path.

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'rent_claims_organization_id_id_key'
       and conrelid = 'public.rent_claims'::regclass
  ) then
    alter table public.rent_claims
      add constraint rent_claims_organization_id_id_key
      unique (organization_id, id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'rent_payments_organization_claim_fkey'
       and conrelid = 'public.rent_payments'::regclass
  ) then
    alter table public.rent_payments
      add constraint rent_payments_organization_claim_fkey
      foreign key (organization_id, rent_claim_id)
      references public.rent_claims (organization_id, id)
      on delete restrict;
  end if;
end
$$;

create index if not exists rent_payments_organization_claim_idx
  on public.rent_payments (organization_id, rent_claim_id);

comment on constraint rent_payments_organization_claim_fkey
  on public.rent_payments is
  'Prevents a payment or its trigger from mutating a rent claim in another organization.';
