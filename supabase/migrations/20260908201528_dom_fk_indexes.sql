-- Cover every Agenor Domestic foreign key reported by the live advisor.
create index if not exists dom_accounts_unidad_negocio_idx
  on public.dom_accounts (unidad_negocio_id);
create index if not exists dom_categories_unidad_negocio_idx
  on public.dom_categories (unidad_negocio_id);
create index if not exists dom_entries_unidad_negocio_idx
  on public.dom_entries (unidad_negocio_id);
create index if not exists dom_transactions_account_idx
  on public.dom_transactions (account_id);
create index if not exists dom_transactions_category_idx
  on public.dom_transactions (category_id);
create index if not exists dom_projected_transactions_category_idx
  on public.dom_projected_transactions (category_id);
create index if not exists dom_debt_installments_debt_idx
  on public.dom_debt_installments (debt_id);
create index if not exists dom_debt_payments_debt_idx
  on public.dom_debt_payments (debt_id);
create index if not exists dom_card_purchases_card_idx
  on public.dom_card_purchases (card_id);
create index if not exists dom_card_installments_purchase_idx
  on public.dom_card_installments (purchase_id);
create index if not exists dom_scenario_results_scenario_idx
  on public.dom_scenario_results (scenario_id);
