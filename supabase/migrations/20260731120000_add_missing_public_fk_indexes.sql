-- Cover every public-schema foreign key with a valid, full B-tree index.
--
-- PostgreSQL does not create indexes for the referencing side of foreign keys.
-- This block is deliberately catalog-driven so it:
--   * accepts an existing composite index when the FK columns are its prefix;
--   * ignores partial, invalid, non-ready, and non-B-tree indexes;
--   * creates only indexes that are still missing when the migration runs;
--   * remains idempotent if it is executed more than once.
do $migration$
declare
  fk_record record;
  index_name text;
  index_name_attempt integer;
  index_columns_sql text;
begin
  for fk_record in
    select
      constraint_record.oid as constraint_oid,
      constraint_record.conrelid,
      constraint_record.conname,
      constraint_record.conkey,
      namespace_record.nspname as schema_name,
      table_record.relname as table_name,
      array_agg(
        attribute_record.attname
        order by key_column.ordinality
      ) as column_names
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as table_record
      on table_record.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    cross join lateral unnest(constraint_record.conkey)
      with ordinality as key_column(attribute_number, ordinality)
    join pg_catalog.pg_attribute as attribute_record
      on attribute_record.attrelid = constraint_record.conrelid
     and attribute_record.attnum = key_column.attribute_number
    where constraint_record.contype = 'f'
      and namespace_record.nspname = 'public'
    group by
      constraint_record.oid,
      constraint_record.conrelid,
      constraint_record.conname,
      constraint_record.conkey,
      namespace_record.nspname,
      table_record.relname
    order by table_record.relname, constraint_record.conname
  loop
    if not exists (
      select 1
      from pg_catalog.pg_index as index_record
      join pg_catalog.pg_class as index_class
        on index_class.oid = index_record.indexrelid
      join pg_catalog.pg_am as access_method
        on access_method.oid = index_class.relam
      where index_record.indrelid = fk_record.conrelid
        and index_record.indisvalid
        and index_record.indisready
        and index_record.indpred is null
        and access_method.amname = 'btree'
        and index_record.indnkeyatts >= cardinality(fk_record.conkey)
        and (
          select array_agg(
            index_key.attribute_number
            order by index_key.ordinality
          )
          from unnest(index_record.indkey)
            with ordinality as index_key(attribute_number, ordinality)
          where index_key.ordinality <= cardinality(fk_record.conkey)
        ) = fk_record.conkey
    ) then
      select string_agg(
        format('%I', column_name),
        ', '
        order by ordinality
      )
      into index_columns_sql
      from unnest(fk_record.column_names)
        with ordinality as columns(column_name, ordinality);

      index_name_attempt := 0;

      loop
        index_name := format(
          'fk_%s_%s_idx',
          left(fk_record.table_name, 24),
          substr(
            md5(
              format(
                '%s.%s:%s:%s',
                fk_record.schema_name,
                fk_record.table_name,
                fk_record.conname,
                index_name_attempt
              )
            ),
            1,
            12
          )
        );

        exit when to_regclass(
          format('%I.%I', fk_record.schema_name, index_name)
        ) is null;

        index_name_attempt := index_name_attempt + 1;
      end loop;

      execute format(
        'create index %I on %I.%I using btree (%s)',
        index_name,
        fk_record.schema_name,
        fk_record.table_name,
        index_columns_sql
      );
    end if;
  end loop;
end;
$migration$;
