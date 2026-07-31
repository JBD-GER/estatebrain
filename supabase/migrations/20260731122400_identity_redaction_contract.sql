-- Complete the identity-redaction contract for retained business history.
-- Direct attribution edits remain forbidden; only PostgreSQL's exact,
-- immediate ON DELETE SET NULL referential action may anonymize an actor.

begin;

create or replace function private.is_exact_fk_set_null(
  p_table oid,
  p_old jsonb,
  p_new jsonb,
  p_allowed_columns text[] default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_candidate_columns text[];
  v_changed_column text;
  v_changed_count integer;
  v_old_value text;
  v_fk record;
  v_parent_is_absent boolean;
begin
  if pg_catalog.pg_trigger_depth() <> 2 then
    return false;
  end if;

  select pg_catalog.array_agg(child_attribute.attname order by child_attribute.attname)
    into v_candidate_columns
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_attribute as child_attribute
      on child_attribute.attrelid = fk.conrelid
     and child_attribute.attnum = fk.conkey[1]
     and not child_attribute.attisdropped
   where fk.contype = 'f'
     and fk.conrelid = p_table
     and fk.confdeltype = 'n'
     and pg_catalog.array_length(fk.conkey, 1) = 1
     and pg_catalog.array_length(fk.confkey, 1) = 1
     and (
       p_allowed_columns is null
       or child_attribute.attname = any(p_allowed_columns)
     );

  if v_candidate_columns is null then
    return false;
  end if;

  select count(*), min(column_name)
    into v_changed_count, v_changed_column
    from pg_catalog.unnest(v_candidate_columns) as column_name
   where (p_new -> column_name) is distinct from
         (p_old -> column_name);

  if v_changed_count <> 1
     or (p_new - v_candidate_columns)
        is distinct from
        (p_old - v_candidate_columns)
     or (p_old ->> v_changed_column) is null
     or (p_new ->> v_changed_column) is not null then
    return false;
  end if;

  select
      parent_namespace.nspname as parent_schema,
      parent_table.relname as parent_table,
      parent_attribute.attname as parent_column,
      pg_catalog.format_type(
        parent_attribute.atttypid,
        parent_attribute.atttypmod
      ) as parent_type
    into v_fk
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_class as parent_table
      on parent_table.oid = fk.confrelid
    join pg_catalog.pg_namespace as parent_namespace
      on parent_namespace.oid = parent_table.relnamespace
    join pg_catalog.pg_attribute as child_attribute
      on child_attribute.attrelid = fk.conrelid
     and child_attribute.attnum = fk.conkey[1]
     and not child_attribute.attisdropped
    join pg_catalog.pg_attribute as parent_attribute
      on parent_attribute.attrelid = fk.confrelid
     and parent_attribute.attnum = fk.confkey[1]
     and not parent_attribute.attisdropped
   where fk.contype = 'f'
     and fk.conrelid = p_table
     and fk.confdeltype = 'n'
     and pg_catalog.array_length(fk.conkey, 1) = 1
     and pg_catalog.array_length(fk.confkey, 1) = 1
     and child_attribute.attname = v_changed_column
   limit 1;

  if not found then
    return false;
  end if;

  v_old_value := p_old ->> v_changed_column;

  execute pg_catalog.format(
    'select not exists (
       select 1
       from %I.%I as parent_row
       where parent_row.%I = $1::%s
     )',
    v_fk.parent_schema,
    v_fk.parent_table,
    v_fk.parent_column,
    v_fk.parent_type
  )
    into v_parent_is_absent
    using v_old_value;

  return coalesce(v_parent_is_absent, false);
end
$$;

revoke all
  on function private.is_exact_fk_set_null(oid, jsonb, jsonb, text[])
  from public, anon, authenticated, service_role;

comment on function private.is_exact_fk_set_null(oid, jsonb, jsonb, text[]) is
  'Validates one immediate declared FK SET NULL action, with unchanged payload and an already deleted parent.';

create or replace function private.enforce_created_by()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_user_id is not null and new.created_by is null then
      new.created_by := v_user_id;
    elsif v_user_id is not null and new.created_by <> v_user_id then
      raise exception 'created_by must match the authenticated user'
        using errcode = '42501';
    end if;
  elsif new.created_by is distinct from old.created_by
        and not private.is_exact_fk_set_null(
          tg_relid,
          pg_catalog.to_jsonb(old),
          pg_catalog.to_jsonb(new),
          array['created_by']
        ) then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all
  on function private.enforce_created_by()
  from public, anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if private.is_exact_fk_set_null(
       tg_relid,
       pg_catalog.to_jsonb(old),
       pg_catalog.to_jsonb(new),
       null
     ) then
    return new;
  end if;

  new.updated_at := now();
  return new;
end
$$;

revoke all
  on function private.set_updated_at()
  from public, anon, authenticated, service_role;

do $created_by_guard_install$
declare
  v_table record;
begin
  for v_table in
    select namespace.nspname as table_schema, relation.relname as table_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = relation.oid
     and attribute.attname = 'created_by'
     and not attribute.attisdropped
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
    order by relation.relname
  loop
    execute pg_catalog.format(
      'drop trigger if exists %I on %I.%I',
      v_table.table_name || '_created_by',
      v_table.table_schema,
      v_table.table_name
    );
    execute pg_catalog.format(
      'create trigger %I
       before insert or update of created_by on %I.%I
       for each row execute function private.enforce_created_by()',
      v_table.table_name || '_created_by',
      v_table.table_schema,
      v_table.table_name
    );
  end loop;
end
$created_by_guard_install$;

create or replace function private.enforce_authored_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old jsonb;
  v_new jsonb := pg_catalog.to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    if pg_catalog.num_nonnulls(
         v_new ->> 'author_user_id',
         v_new ->> 'author_tenant_id'
       ) <> 1 then
      raise exception 'Exactly one message/comment author is required'
        using errcode = '23514';
    end if;
    return new;
  end if;

  v_old := pg_catalog.to_jsonb(old);

  if (v_new -> 'author_user_id') is distinct from
       (v_old -> 'author_user_id')
     or (v_new -> 'author_tenant_id') is distinct from
       (v_old -> 'author_tenant_id') then
    if private.is_exact_fk_set_null(
         tg_relid,
         v_old,
         v_new,
         array['author_user_id', 'author_tenant_id']
       ) then
      return new;
    end if;

    raise exception 'Message/comment authorship is immutable'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all
  on function private.enforce_authored_identity()
  from public, anon, authenticated, service_role;

alter table public.messages
  drop constraint messages_one_author,
  add constraint messages_one_author
    check (num_nonnulls(author_user_id, author_tenant_id) <= 1);

alter table public.comments
  drop constraint comments_one_author,
  add constraint comments_one_author
    check (num_nonnulls(author_user_id, author_tenant_id) <= 1);

drop trigger if exists messages_author_identity on public.messages;
create trigger messages_author_identity
  before insert or update of author_user_id, author_tenant_id
  on public.messages
  for each row execute function private.enforce_authored_identity();

drop trigger if exists comments_author_identity on public.comments;
create trigger comments_author_identity
  before insert or update of author_user_id, author_tenant_id
  on public.comments
  for each row execute function private.enforce_authored_identity();

create or replace function private.enforce_action_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old jsonb;
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_actor_column text := tg_argv[0];
  v_status_column text := tg_argv[1];
  v_action_status text := tg_argv[2];
  v_timestamp_column text := tg_argv[3];
  v_is_action boolean :=
    (v_new ->> v_status_column) = v_action_status;
  v_actor_changed boolean;
  v_timestamp_changed boolean;
  v_status_entered boolean;
  v_user_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_is_action and (
         (v_new ->> v_actor_column) is null
         or (v_new ->> v_timestamp_column) is null
         or (
           v_user_id is not null
           and (v_new ->> v_actor_column)::uuid <> v_user_id
         )
       ) then
      raise exception 'Action status requires actor and timestamp'
        using errcode = '23514';
    end if;

    if not v_is_action and (
         (v_new ->> v_actor_column) is not null
         or (v_new ->> v_timestamp_column) is not null
       ) then
      raise exception 'Action attribution requires its matching status'
        using errcode = '23514';
    end if;

    return new;
  end if;

  v_old := pg_catalog.to_jsonb(old);
  v_actor_changed :=
    (v_new -> v_actor_column) is distinct from
    (v_old -> v_actor_column);
  v_timestamp_changed :=
    (v_new -> v_timestamp_column) is distinct from
    (v_old -> v_timestamp_column);
  v_status_entered :=
    v_is_action
    and (v_old ->> v_status_column) is distinct from v_action_status;

  if v_actor_changed
     and private.is_exact_fk_set_null(
       tg_relid,
       v_old,
       v_new,
       array[v_actor_column]
     ) then
    return new;
  end if;

  if (v_actor_changed or v_timestamp_changed)
     and not v_status_entered then
    raise exception 'Action attribution is immutable'
      using errcode = '42501';
  end if;

  if v_status_entered and (
       (v_new ->> v_actor_column) is null
       or (v_new ->> v_timestamp_column) is null
       or (
         v_user_id is not null
         and (v_new ->> v_actor_column)::uuid <> v_user_id
       )
     ) then
    raise exception 'Action status requires actor and timestamp'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all
  on function private.enforce_action_actor()
  from public, anon, authenticated, service_role;

alter table public.invitations
  drop constraint invitations_acceptance_consistent,
  add constraint invitations_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null)
    or status <> 'accepted'
  );

alter table public.transaction_matches
  drop constraint transaction_matches_confirmation,
  add constraint transaction_matches_confirmation check (
    (status = 'confirmed' and confirmed_at is not null)
    or status <> 'confirmed'
  ),
  drop constraint transaction_matches_rejection,
  add constraint transaction_matches_rejection check (
    (status = 'rejected' and rejected_at is not null)
    or status <> 'rejected'
  );

alter table public.tax_years
  drop constraint tax_years_lock_consistent,
  add constraint tax_years_lock_consistent check (
    (status = 'locked' and locked_at is not null)
    or status <> 'locked'
  );

alter table public.optimization_insights
  drop constraint optimization_insights_dismissal,
  add constraint optimization_insights_dismissal check (
    (status = 'dismissed' and dismissed_at is not null)
    or status <> 'dismissed'
  );

drop trigger if exists invitations_acceptance_actor on public.invitations;
create trigger invitations_acceptance_actor
  before insert or update of status, accepted_by, accepted_at
  on public.invitations
  for each row execute function private.enforce_action_actor(
    'accepted_by', 'status', 'accepted', 'accepted_at'
  );

drop trigger if exists transaction_matches_confirmation_actor
  on public.transaction_matches;
create trigger transaction_matches_confirmation_actor
  before insert or update of status, confirmed_by, confirmed_at
  on public.transaction_matches
  for each row execute function private.enforce_action_actor(
    'confirmed_by', 'status', 'confirmed', 'confirmed_at'
  );

drop trigger if exists transaction_matches_rejection_actor
  on public.transaction_matches;
create trigger transaction_matches_rejection_actor
  before insert or update of status, rejected_by, rejected_at
  on public.transaction_matches
  for each row execute function private.enforce_action_actor(
    'rejected_by', 'status', 'rejected', 'rejected_at'
  );

drop trigger if exists tax_years_lock_actor on public.tax_years;
create trigger tax_years_lock_actor
  before insert or update of status, locked_by, locked_at
  on public.tax_years
  for each row execute function private.enforce_action_actor(
    'locked_by', 'status', 'locked', 'locked_at'
  );

drop trigger if exists optimization_insights_dismissal_actor
  on public.optimization_insights;
create trigger optimization_insights_dismissal_actor
  before insert or update of status, dismissed_by, dismissed_at
  on public.optimization_insights
  for each row execute function private.enforce_action_actor(
    'dismissed_by', 'status', 'dismissed', 'dismissed_at'
  );

create or replace function private.enforce_required_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_column text := tg_argv[0];
  v_old jsonb;
  v_new jsonb := pg_catalog.to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    if (v_new ->> v_column) is null then
      raise exception 'Required attribution is missing'
        using errcode = '23514';
    end if;
    return new;
  end if;

  v_old := pg_catalog.to_jsonb(old);

  if (v_new -> v_column) is distinct from
       (v_old -> v_column)
     and not private.is_exact_fk_set_null(
       tg_relid,
       v_old,
       v_new,
       array[v_column]
     ) then
    raise exception 'Required attribution is immutable'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all
  on function private.enforce_required_attribution()
  from public, anon, authenticated, service_role;

alter table public.invitations
  alter column invited_by drop not null,
  drop constraint invitations_invited_by_fkey,
  add constraint invitations_invited_by_fkey
    foreign key (invited_by)
    references auth.users(id)
    on delete set null;

drop trigger if exists invitations_invited_by_attribution
  on public.invitations;
create trigger invitations_invited_by_attribution
  before insert or update of invited_by on public.invitations
  for each row execute function private.enforce_required_attribution(
    'invited_by'
  );

create or replace function private.prevent_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and private.is_exact_fk_set_null(
       tg_relid,
       pg_catalog.to_jsonb(old),
       pg_catalog.to_jsonb(new),
       array['created_by', 'calculated_for_user_id']
     ) then
    return new;
  end if;

  if tg_op = 'DELETE'
     and private.is_snapshot_parent_cascade_delete(
       pg_catalog.to_jsonb(old)
     ) then
    return old;
  end if;

  raise exception 'tax calculation snapshots are immutable'
    using errcode = '55000';
end
$$;

revoke all
  on function private.prevent_snapshot_mutation()
  from public, anon, authenticated, service_role;

commit;
