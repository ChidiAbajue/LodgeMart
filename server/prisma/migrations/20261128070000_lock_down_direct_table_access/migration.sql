-- Lock down direct table access (Supabase).
--
-- Supabase publishes every table in the "public" schema through its auto-generated
-- REST/GraphQL API to the "anon" and "authenticated" roles (anyone holding the public
-- anon key). LodgeMart must ONLY be reached through our API server, which enforces
-- prices, payments and PINs. So:
--   1. Row Level Security ON for every table, with NO policies → the API roles see nothing.
--      Our server connects as the table owner, which bypasses RLS, so the app is unaffected.
--   2. Revoke all privileges from anon/authenticated (those roles only exist on Supabase;
--      on local docker this part is skipped).
-- New tables added by later migrations must also get RLS (tests/phase7.test.js checks this).

DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
