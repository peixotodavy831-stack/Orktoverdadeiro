-- Read-only capture of Supabase migration history; never changes the ledger.
begin transaction read only;
select jsonb_build_object(
  'captured_at', now(),
  'source', 'supabase_migrations.schema_migrations',
  'migrations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'version', version::text,
      'name', name
    ) order by version::text)
    from supabase_migrations.schema_migrations
  ), '[]'::jsonb)
);
commit;
