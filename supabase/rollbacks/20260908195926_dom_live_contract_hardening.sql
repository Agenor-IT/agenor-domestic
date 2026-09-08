-- Exact emergency rollback for production state observed before
-- 20260908195926_dom_live_contract_hardening.
-- It restores definitions and privileges; it never removes data or tables.

drop index if exists public.dom_entries_category_idx;

create or replace function public.dom_current_persona_padre_id()
returns integer
language plpgsql
security definer
as $$
begin
  return coalesce((current_setting('app.current_persona_padre_id', true))::integer, 1);
end;
$$;

create or replace function public.dom_assert_tenant_access(p_persona_padre_id integer)
returns void
language plpgsql
stable
security definer
set search_path to public, auth
as $$
begin
  if p_persona_padre_id is null
     or p_persona_padre_id <> public.dom_current_persona_padre_id() then
    raise exception 'No tiene acceso al contexto solicitado' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.dom_allocate_payment(
  p_persona_padre_id integer,
  p_debt_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_debt public.dom_debts%rowtype;
  v_allocated_arrears numeric(18, 2) := 0;
  v_allocated_principal numeric(18, 2) := 0;
  v_remaining numeric(18, 2) := coalesce(p_amount, 0);
begin
  select * into v_debt from public.dom_debts
  where id = p_debt_id and persona_padre_id = p_persona_padre_id;
  if not found then
    raise exception 'Deuda no encontrada para el tenant especificado';
  end if;
  if v_debt.arrears_balance > 0 and v_remaining > 0 then
    if v_remaining >= v_debt.arrears_balance then
      v_allocated_arrears := v_debt.arrears_balance;
      v_remaining := v_remaining - v_debt.arrears_balance;
    else
      v_allocated_arrears := v_remaining;
      v_remaining := 0;
    end if;
  end if;
  if v_remaining > 0 then
    v_allocated_principal := v_remaining;
  end if;
  insert into public.dom_debt_payments (
    persona_padre_id, debt_id, amount_paid, payment_date,
    allocated_to_principal, allocated_to_arrears
  ) values (
    p_persona_padre_id, p_debt_id, p_amount, current_date,
    v_allocated_principal, v_allocated_arrears
  );
  update public.dom_debts
  set arrears_balance = greatest(0, arrears_balance - v_allocated_arrears),
      total_principal = greatest(0, total_principal - v_allocated_principal)
  where id = p_debt_id and persona_padre_id = p_persona_padre_id;
  insert into public.dom_audit_log (
    persona_padre_id, user_id, entity_type, entity_id, action, new_value
  ) values (
    p_persona_padre_id, auth.uid(), 'dom_debts', p_debt_id::text,
    'ALLOCATE_PAYMENT', jsonb_build_object(
      'amount_paid', p_amount,
      'allocated_to_arrears', v_allocated_arrears,
      'allocated_to_principal', v_allocated_principal
    )
  );
  return jsonb_build_object(
    'success', true,
    'allocated_arrears', v_allocated_arrears,
    'allocated_principal', v_allocated_principal
  );
end;
$$;

alter function public.dom_account_create(integer, text, text, numeric) set search_path to public, auth;
alter function public.dom_assert_tenant_access(integer) set search_path to public, auth;
alter function public.dom_catalog_get(integer) set search_path to public, auth;
alter function public.dom_category_create(integer, text, text, text) set search_path to public, auth;
alter function public.dom_context_get(integer) set search_path to public, auth;
alter function public.dom_dashboard_summary(integer, date) set search_path to public, auth;
alter function public.dom_entries_list(integer, integer) set search_path to public, auth;
alter function public.dom_entry_create(integer, bigint, bigint, text, text, numeric, text, date) set search_path to public, auth;
alter function public.dom_onboarding_complete(integer, text, numeric) set search_path to public, auth;
alter function public.dom_set_audit_fields() set search_path to public, auth;
alter function public.dom_current_persona_padre_id() reset search_path;
alter function public.dom_allocate_payment(integer, uuid, numeric) reset search_path;

drop policy if exists dom_accounts_select_own on public.dom_accounts;
create policy dom_accounts_select_own on public.dom_accounts
for select to authenticated
using (persona_padre_id = public.dom_current_persona_padre_id());

drop policy if exists dom_categories_select_own on public.dom_categories;
create policy dom_categories_select_own on public.dom_categories
for select to authenticated
using (persona_padre_id = public.dom_current_persona_padre_id());

drop policy if exists dom_entries_select_own on public.dom_entries;
create policy dom_entries_select_own on public.dom_entries
for select to authenticated
using (persona_padre_id = public.dom_current_persona_padre_id());

create policy dom_payment_priorities_tenant_policy
on public.dom_payment_priorities
for all to public
using (persona_padre_id = public.dom_current_persona_padre_id());

grant select on table
  public.dom_accounts,
  public.dom_categories,
  public.dom_entries
to authenticated;

grant select, insert, update, delete on table
  public.dom_transactions,
  public.dom_projected_transactions,
  public.dom_receivables,
  public.dom_debts,
  public.dom_debt_installments,
  public.dom_debt_payments,
  public.dom_cards,
  public.dom_card_purchases,
  public.dom_card_installments,
  public.dom_payment_priorities,
  public.dom_parameters,
  public.dom_monthly_parameters,
  public.dom_scenarios,
  public.dom_scenario_results,
  public.dom_audit_log
to authenticated;

grant execute on function
  public.dom_current_persona_padre_id(),
  public.dom_assert_tenant_access(integer),
  public.dom_set_audit_fields(),
  public.dom_context_get(integer),
  public.dom_catalog_get(integer),
  public.dom_onboarding_complete(integer, text, numeric),
  public.dom_account_create(integer, text, text, numeric),
  public.dom_category_create(integer, text, text, text),
  public.dom_entry_create(integer, bigint, bigint, text, text, numeric, text, date),
  public.dom_entries_list(integer, integer),
  public.dom_dashboard_summary(integer, date),
  public.dom_allocate_payment(integer, uuid, numeric)
to public, authenticated, service_role;
