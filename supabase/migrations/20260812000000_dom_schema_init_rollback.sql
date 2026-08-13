-- Rollback Script: 20260812000000_dom_schema_init_rollback.sql
-- Proporciona un rollback idempotente de TODOS los objetos dom_ creados por esta migración.
-- IMPORTANTE: Solo elimina objetos prefijados estrictamente con dom_

DROP FUNCTION IF EXISTS dom_allocate_payment(INTEGER, UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS dom_current_persona_padre_id() CASCADE;

DROP TABLE IF EXISTS dom_audit_log CASCADE;
DROP TABLE IF EXISTS dom_scenario_results CASCADE;
DROP TABLE IF EXISTS dom_scenarios CASCADE;
DROP TABLE IF EXISTS dom_monthly_parameters CASCADE;
DROP TABLE IF EXISTS dom_parameters CASCADE;
DROP TABLE IF EXISTS dom_payment_priorities CASCADE;
DROP TABLE IF EXISTS dom_card_installments CASCADE;
DROP TABLE IF EXISTS dom_card_purchases CASCADE;
DROP TABLE IF EXISTS dom_cards CASCADE;
DROP TABLE IF EXISTS dom_debt_payments CASCADE;
DROP TABLE IF EXISTS dom_debt_installments CASCADE;
DROP TABLE IF EXISTS dom_debts CASCADE;
DROP TABLE IF EXISTS dom_receivables CASCADE;
DROP TABLE IF EXISTS dom_projected_transactions CASCADE;
DROP TABLE IF EXISTS dom_transactions CASCADE;
DROP TABLE IF EXISTS dom_categories CASCADE;
DROP TABLE IF EXISTS dom_accounts CASCADE;
