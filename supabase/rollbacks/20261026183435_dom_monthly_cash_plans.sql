-- Export the new planning tables before rollback if they contain owner data.
-- Existing cards, invoices, purchases, accounting entries and payments are preserved.
BEGIN;
DROP FUNCTION IF EXISTS public.dom_monthly_cash_snapshot(integer);
DROP FUNCTION IF EXISTS public.dom_schedule_cash_bill(integer,uuid,date,bigint,date,integer);
DROP FUNCTION IF EXISTS public.dom_allocate_card_cash_payment(integer,uuid,uuid,numeric,integer);
DROP FUNCTION IF EXISTS public.dom_save_card_cash_plan(integer,jsonb);
DROP FUNCTION IF EXISTS public.dom_save_cash_card(integer,jsonb);
DROP TABLE IF EXISTS public.dom_cash_bill_schedule;
DROP TABLE IF EXISTS public.dom_card_cash_payments;
DROP TABLE IF EXISTS public.dom_card_cash_plans;
DROP INDEX IF EXISTS public.dom_expenses_cashflow_owner_key;
DROP INDEX IF EXISTS public.dom_transactions_cashflow_owner_key;
DROP INDEX IF EXISTS public.dom_cards_cashflow_owner_key;
COMMIT;
