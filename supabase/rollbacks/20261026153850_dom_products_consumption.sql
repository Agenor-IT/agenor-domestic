-- Apply only with explicit production rollback authorization, after exporting the NEW module's data.
-- No CASCADE: unexpected consumers must stop the rollback instead of being deleted.
BEGIN;
DROP FUNCTION public.dom_delete_shopping_item(integer,uuid,integer);
DROP FUNCTION public.dom_save_shopping_item(integer,jsonb);
DROP FUNCTION public.dom_post_purchase_transaction(integer,uuid,integer,jsonb,jsonb,jsonb);
DROP FUNCTION public.dom_create_consumption_product(integer,jsonb);
DROP FUNCTION public.dom_resolve_consumption_product(integer,jsonb);
DROP FUNCTION public.dom_consumption_contract(integer);
DROP TABLE public.dom_shopping_items;
DROP TABLE public.dom_purchase_items;
DROP TABLE public.dom_consumption_products;
DROP INDEX public.dom_consumption_transactions_owner_uidx;
COMMIT;
