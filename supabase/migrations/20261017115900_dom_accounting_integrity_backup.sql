-- Private, point-in-time rollback material for the accounting integrity release.
-- Restore only after reconciling any entries created after this snapshot.
CREATE SCHEMA dom_backup_20261017_integrity;
REVOKE ALL ON SCHEMA dom_backup_20261017_integrity FROM PUBLIC, anon, authenticated;

CREATE TABLE dom_backup_20261017_integrity.dom_accounts AS TABLE public.dom_accounts;
CREATE TABLE dom_backup_20261017_integrity.dom_transactions AS TABLE public.dom_transactions;
CREATE TABLE dom_backup_20261017_integrity.dom_journal_entries AS TABLE public.dom_journal_entries;
CREATE TABLE dom_backup_20261017_integrity.dom_journal_lines AS TABLE public.dom_journal_lines;
CREATE TABLE dom_backup_20261017_integrity.dom_fiscal_years AS TABLE public.dom_fiscal_years;

CREATE TABLE dom_backup_20261017_integrity.snapshot_metadata AS
SELECT clock_timestamp() AS captured_at,
       current_database() AS database_name,
       (SELECT count(*) FROM public.dom_accounts) AS account_count,
       (SELECT count(*) FROM public.dom_transactions) AS transaction_count,
       (SELECT count(*) FROM public.dom_journal_entries) AS entry_count,
       (SELECT count(*) FROM public.dom_journal_lines) AS line_count,
       (SELECT count(*) FROM public.dom_fiscal_years) AS fiscal_year_count;

CREATE TABLE dom_backup_20261017_integrity.function_definitions AS
SELECT p.oid::regprocedure::text AS signature,
       pg_get_functiondef(p.oid) AS definition,
       p.proacl::text AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'dom\_%' ESCAPE '\';

CREATE TABLE dom_backup_20261017_integrity.table_policies AS
SELECT * FROM pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('dom_accounts', 'dom_transactions', 'dom_journal_entries',
   'dom_journal_lines', 'dom_fiscal_years');

CREATE TABLE dom_backup_20261017_integrity.table_grants AS
SELECT * FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN
  ('dom_accounts', 'dom_transactions', 'dom_journal_entries',
   'dom_journal_lines', 'dom_fiscal_years');

CREATE TABLE dom_backup_20261017_integrity.column_grants AS
SELECT * FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN
  ('dom_accounts', 'dom_transactions', 'dom_journal_entries',
   'dom_journal_lines', 'dom_fiscal_years');

CREATE TABLE dom_backup_20261017_integrity.trigger_definitions AS
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
  ('dom_accounts', 'dom_transactions', 'dom_journal_entries',
   'dom_journal_lines', 'dom_fiscal_years')
  AND NOT t.tgisinternal;

REVOKE ALL ON ALL TABLES IN SCHEMA dom_backup_20261017_integrity
FROM PUBLIC, anon, authenticated;
