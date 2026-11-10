-- Revert the frontend consumer first. Existing transactions and schedule rows are retained.
DROP FUNCTION IF EXISTS public.dom_post_purchase_with_due_date(integer,uuid,integer,jsonb,jsonb,jsonb,date,integer);
