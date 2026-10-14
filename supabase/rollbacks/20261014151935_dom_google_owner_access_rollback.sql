-- Emergency rollback to the verified pre-auth Domestic schema on 2026-10-14.
-- Restores the former anonymous grants; use only to recover service, then reapply a corrected security migration.
-- Business rows in public.dom_* are never deleted or moved.
BEGIN;

DROP POLICY IF EXISTS "dom_accounts_authenticated_owner" ON public."dom_accounts";
DROP POLICY IF EXISTS "dom_audit_log_authenticated_owner" ON public."dom_audit_log";
DROP POLICY IF EXISTS "dom_card_installments_authenticated_owner" ON public."dom_card_installments";
DROP POLICY IF EXISTS "dom_card_purchases_authenticated_owner" ON public."dom_card_purchases";
DROP POLICY IF EXISTS "dom_cards_authenticated_owner" ON public."dom_cards";
DROP POLICY IF EXISTS "dom_categories_authenticated_owner" ON public."dom_categories";
DROP POLICY IF EXISTS "dom_debt_installments_authenticated_owner" ON public."dom_debt_installments";
DROP POLICY IF EXISTS "dom_debt_payments_authenticated_owner" ON public."dom_debt_payments";
DROP POLICY IF EXISTS "dom_debts_authenticated_owner" ON public."dom_debts";
DROP POLICY IF EXISTS "dom_entries_authenticated_owner" ON public."dom_entries";
DROP POLICY IF EXISTS "dom_expenses_authenticated_owner" ON public."dom_expenses";
DROP POLICY IF EXISTS "dom_fiscal_years_authenticated_owner" ON public."dom_fiscal_years";
DROP POLICY IF EXISTS "dom_journal_entries_authenticated_owner" ON public."dom_journal_entries";
DROP POLICY IF EXISTS "dom_journal_lines_authenticated_owner" ON public."dom_journal_lines";
DROP POLICY IF EXISTS "dom_monthly_parameters_authenticated_owner" ON public."dom_monthly_parameters";
DROP POLICY IF EXISTS "dom_parameters_authenticated_owner" ON public."dom_parameters";
DROP POLICY IF EXISTS "dom_projected_transactions_authenticated_owner" ON public."dom_projected_transactions";
DROP POLICY IF EXISTS "dom_receivables_authenticated_owner" ON public."dom_receivables";
DROP POLICY IF EXISTS "dom_scenario_results_authenticated_owner" ON public."dom_scenario_results";
DROP POLICY IF EXISTS "dom_scenarios_authenticated_owner" ON public."dom_scenarios";
DROP POLICY IF EXISTS "dom_transactions_authenticated_owner" ON public."dom_transactions";
DROP POLICY IF EXISTS "dom_ventures_authenticated_owner" ON public."dom_ventures";

CREATE OR REPLACE FUNCTION public.dom_assert_tenant_access(p_persona_padre_id integer)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.tenant_can_access(p_persona_padre_id) then
    raise exception 'No tiene acceso al contexto solicitado' using errcode = '42501';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dom_current_persona_padre_id()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth_uid uuid := auth.uid();
  v_persona_padre_id integer;
begin
  if v_auth_uid is null then
    raise exception 'Usuario no autenticado' using errcode = '42501';
  end if;

  select u.persona_padre_id
    into v_persona_padre_id
  from public.usuarios u
  where u.auth_uuid = v_auth_uid
    and coalesce(u.activo, true)
    and u.persona_padre_id is not null
  order by u.id
  limit 1;

  if v_persona_padre_id is null then
    select ue.persona_padre_id
      into v_persona_padre_id
    from public.usuarios_empresas ue
    where ue.usuario_id = v_auth_uid
      and coalesce(ue.es_activo, true)
    order by ue.persona_padre_id
    limit 1;
  end if;

  if v_persona_padre_id is null
     or not private.tenant_can_access(v_persona_padre_id) then
    raise exception 'No hay un contexto personal activo para el usuario autenticado'
      using errcode = '42501';
  end if;

  return v_persona_padre_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dom_expenses_paginated_list(p_persona_padre_id integer, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT ''::text, p_source_type text DEFAULT 'todos'::text, p_expense_type text DEFAULT 'todos'::text, p_status text DEFAULT 'activo'::text, p_order_by text DEFAULT 'id'::text, p_order_dir text DEFAULT 'desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_total_filtered integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_tab_counts jsonb;
  v_order_dir text;
  v_order_by text;
  v_clean_search text;
BEGIN
  -- Param sanitization
  p_page := GREATEST(1, COALESCE(p_page, 1));
  p_page_size := GREATEST(1, LEAST(COALESCE(p_page_size, 10), 100));
  v_offset := (p_page - 1) * p_page_size;
  v_order_dir := LOWER(COALESCE(p_order_dir, 'desc'));
  IF v_order_dir NOT IN ('asc', 'desc') THEN
    v_order_dir := 'desc';
  END IF;
  v_order_by := LOWER(COALESCE(p_order_by, 'id'));
  v_clean_search := TRIM(COALESCE(p_search, ''));

  -- Global Summary (for KPI cards across tenant)
  SELECT jsonb_build_object(
    'active_count', COUNT(*) FILTER (WHERE status = 'activo'),
    'total_count', COUNT(*),
    'total_domestic_monthly', COALESCE(SUM(base_monthly_amount) FILTER (WHERE status = 'activo' AND source_type = 'domestico'), 0),
    'total_business_monthly', COALESCE(SUM(base_monthly_amount) FILTER (WHERE status = 'activo' AND source_type = 'emprendimiento'), 0),
    'total_monthly_all', COALESCE(SUM(base_monthly_amount) FILTER (WHERE status = 'activo'), 0)
  )
  INTO v_summary
  FROM public.dom_expenses
  WHERE persona_padre_id = p_persona_padre_id;

  -- Tab Counts (filtered by status and search)
  SELECT jsonb_build_object(
    'todos', COUNT(*),
    'domestico', COUNT(*) FILTER (WHERE source_type = 'domestico'),
    'emprendimiento', COUNT(*) FILTER (WHERE source_type = 'emprendimiento'),
    'extraordinario', COUNT(*) FILTER (WHERE source_type = 'extraordinario')
  )
  INTO v_tab_counts
  FROM public.dom_expenses
  WHERE persona_padre_id = p_persona_padre_id
    AND (p_status = 'todos' OR status = p_status)
    AND (v_clean_search = '' OR (
      supplier_name ILIKE '%' || v_clean_search || '%' OR
      concept ILIKE '%' || v_clean_search || '%' OR
      category ILIKE '%' || v_clean_search || '%'
    ));

  -- Total count for current filter
  SELECT COUNT(*)
  INTO v_total_filtered
  FROM public.dom_expenses
  WHERE persona_padre_id = p_persona_padre_id
    AND (p_source_type = 'todos' OR source_type = p_source_type)
    AND (p_expense_type = 'todos' OR expense_type = p_expense_type)
    AND (p_status = 'todos' OR status = p_status)
    AND (v_clean_search = '' OR (
      supplier_name ILIKE '%' || v_clean_search || '%' OR
      concept ILIKE '%' || v_clean_search || '%' OR
      category ILIKE '%' || v_clean_search || '%'
    ));

  -- Paginated & Sorted Items
  WITH filtered_records AS (
    SELECT
      id,
      persona_padre_id,
      supplier_name,
      concept,
      category,
      source_type,
      expense_type,
      status,
      base_monthly_amount,
      monthly_projections,
      default_payment_method,
      notes,
      created_at
    FROM public.dom_expenses
    WHERE persona_padre_id = p_persona_padre_id
      AND (p_source_type = 'todos' OR source_type = p_source_type)
      AND (p_expense_type = 'todos' OR expense_type = p_expense_type)
      AND (p_status = 'todos' OR status = p_status)
      AND (v_clean_search = '' OR (
        supplier_name ILIKE '%' || v_clean_search || '%' OR
        concept ILIKE '%' || v_clean_search || '%' OR
        category ILIKE '%' || v_clean_search || '%'
      ))
    ORDER BY
      CASE WHEN v_order_by = 'source_type' AND v_order_dir = 'asc' THEN source_type END ASC,
      CASE WHEN v_order_by = 'source_type' AND v_order_dir = 'desc' THEN source_type END DESC,
      CASE WHEN v_order_by = 'supplier_name' AND v_order_dir = 'asc' THEN supplier_name END ASC,
      CASE WHEN v_order_by = 'supplier_name' AND v_order_dir = 'desc' THEN supplier_name END DESC,
      CASE WHEN v_order_by = 'concept' AND v_order_dir = 'asc' THEN concept END ASC,
      CASE WHEN v_order_by = 'concept' AND v_order_dir = 'desc' THEN concept END DESC,
      CASE WHEN v_order_by = 'expense_type' AND v_order_dir = 'asc' THEN expense_type END ASC,
      CASE WHEN v_order_by = 'expense_type' AND v_order_dir = 'desc' THEN expense_type END DESC,
      CASE WHEN v_order_by = 'status' AND v_order_dir = 'asc' THEN status END ASC,
      CASE WHEN v_order_by = 'status' AND v_order_dir = 'desc' THEN status END DESC,
      CASE WHEN v_order_by = 'base_monthly_amount' AND v_order_dir = 'asc' THEN base_monthly_amount END ASC,
      CASE WHEN v_order_by = 'base_monthly_amount' AND v_order_dir = 'desc' THEN base_monthly_amount END DESC,
      CASE WHEN v_order_by = 'projection' AND v_order_dir = 'asc' THEN COALESCE((monthly_projections->>'Ago-26')::numeric, base_monthly_amount) END ASC,
      CASE WHEN v_order_by = 'projection' AND v_order_dir = 'desc' THEN COALESCE((monthly_projections->>'Ago-26')::numeric, base_monthly_amount) END DESC,
      CASE WHEN v_order_by = 'created_at' AND v_order_dir = 'asc' THEN created_at END ASC,
      CASE WHEN v_order_by = 'created_at' AND v_order_dir = 'desc' THEN created_at END DESC,
      CASE WHEN v_order_by = 'id' AND v_order_dir = 'asc' THEN id END ASC,
      CASE WHEN v_order_by = 'id' AND v_order_dir = 'desc' THEN id END DESC,
      id DESC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'persona_padre_id', persona_padre_id,
      'supplier_name', supplier_name,
      'concept', concept,
      'category', category,
      'source_type', source_type,
      'expense_type', expense_type,
      'status', status,
      'base_monthly_amount', base_monthly_amount,
      'monthly_projections', monthly_projections,
      'default_payment_method', default_payment_method,
      'notes', notes,
      'created_at', created_at
    )
  ), '[]'::jsonb)
  INTO v_items
  FROM filtered_records;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total_filtered,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', GREATEST(1, CEIL(v_total_filtered::numeric / GREATEST(1, p_page_size))::integer),
    'summary', v_summary,
    'tab_counts', v_tab_counts
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dom_fn_registrar_asiento(p_persona_padre_id integer, p_fecha date, p_concepto text, p_lineas jsonb, p_referencia_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_entry_id BIGINT;
  v_next_number BIGINT;
  v_sum_debit NUMERIC(15,2) := 0;
  v_sum_credit NUMERIC(15,2) := 0;
  v_elem JSONB;
  v_account_id BIGINT;
  v_debit NUMERIC(15,2);
  v_credit NUMERIC(15,2);
  v_nature TEXT;
BEGIN
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_sum_debit := v_sum_debit + COALESCE((v_elem->>'debit')::NUMERIC, 0.00);
    v_sum_credit := v_sum_credit + COALESCE((v_elem->>'credit')::NUMERIC, 0.00);
  END LOOP;

  IF v_sum_debit <> v_sum_credit THEN
    RAISE EXCEPTION 'El asiento contable no cuadra: Total Debe (%) != Total Haber (%)', v_sum_debit, v_sum_credit;
  END IF;

  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_next_number
  FROM public.dom_journal_entries
  WHERE persona_padre_id = p_persona_padre_id;

  INSERT INTO public.dom_journal_entries (
    persona_padre_id,
    entry_number,
    entry_date,
    description,
    reference_id
  ) VALUES (
    p_persona_padre_id,
    v_next_number,
    COALESCE(p_fecha, CURRENT_DATE),
    p_concepto,
    p_referencia_id
  ) RETURNING id INTO v_entry_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_account_id := (v_elem->>'account_id')::BIGINT;
    v_debit := COALESCE((v_elem->>'debit')::NUMERIC, 0.00);
    v_credit := COALESCE((v_elem->>'credit')::NUMERIC, 0.00);

    INSERT INTO public.dom_journal_lines (
      persona_padre_id,
      journal_entry_id,
      account_id,
      debit,
      credit,
      memo
    ) VALUES (
      p_persona_padre_id,
      v_entry_id,
      v_account_id,
      v_debit,
      v_credit,
      v_elem->>'memo'
    );

    SELECT nature INTO v_nature FROM public.dom_accounts WHERE id = v_account_id;

    IF v_nature = 'debit' THEN
      UPDATE public.dom_accounts
      SET current_balance = current_balance + (v_debit - v_credit),
          updated_at = NOW()
      WHERE id = v_account_id;
    ELSE
      UPDATE public.dom_accounts
      SET current_balance = current_balance + (v_credit - v_debit),
          updated_at = NOW()
      WHERE id = v_account_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'entry_number', v_next_number,
    'message', 'Asiento registrado exitosamente en Partida Doble'
  );
END;
$function$
;

CREATE POLICY "dom_accounts_all_policy" ON public."dom_accounts" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "dom_accounts_select_own" ON public."dom_accounts" AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.tenant_can_access(dom_accounts.persona_padre_id) AS tenant_can_access));
CREATE POLICY "dom_categories_all_policy" ON public."dom_categories" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "dom_categories_select_own" ON public."dom_categories" AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.tenant_can_access(dom_categories.persona_padre_id) AS tenant_can_access));
CREATE POLICY "dom_entries_all_policy" ON public."dom_entries" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "dom_entries_select_own" ON public."dom_entries" AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.tenant_can_access(dom_entries.persona_padre_id) AS tenant_can_access));
CREATE POLICY "dom_fiscal_years_tenant_policy" ON public."dom_fiscal_years" AS PERMISSIVE FOR ALL TO public USING ((persona_padre_id = dom_current_persona_padre_id()));

ALTER TABLE public."dom_accounts" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_accounts" TO anon, authenticated;
ALTER TABLE public."dom_audit_log" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_audit_log" TO anon, authenticated;
ALTER TABLE public."dom_card_installments" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_card_installments" TO anon, authenticated;
ALTER TABLE public."dom_card_purchases" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_card_purchases" TO anon, authenticated;
ALTER TABLE public."dom_cards" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_cards" TO anon, authenticated;
ALTER TABLE public."dom_categories" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_categories" TO anon, authenticated;
ALTER TABLE public."dom_debt_installments" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_debt_installments" TO anon, authenticated;
ALTER TABLE public."dom_debt_payments" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_debt_payments" TO anon, authenticated;
ALTER TABLE public."dom_debts" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_debts" TO anon, authenticated;
ALTER TABLE public."dom_entries" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_entries" TO anon, authenticated;
ALTER TABLE public."dom_expenses" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_expenses" TO anon, authenticated;
ALTER TABLE public."dom_fiscal_years" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_fiscal_years" TO anon, authenticated;
ALTER TABLE public."dom_journal_entries" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_journal_entries" TO anon, authenticated;
ALTER TABLE public."dom_journal_lines" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_journal_lines" TO anon, authenticated;
ALTER TABLE public."dom_monthly_parameters" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_monthly_parameters" TO anon, authenticated;
ALTER TABLE public."dom_parameters" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_parameters" TO anon, authenticated;
ALTER TABLE public."dom_projected_transactions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_projected_transactions" TO anon, authenticated;
ALTER TABLE public."dom_receivables" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_receivables" TO anon, authenticated;
ALTER TABLE public."dom_scenario_results" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_scenario_results" TO anon, authenticated;
ALTER TABLE public."dom_scenarios" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_scenarios" TO anon, authenticated;
ALTER TABLE public."dom_transactions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_transactions" TO anon, authenticated;
ALTER TABLE public."dom_ventures" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public."dom_ventures" TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dom_account_create(integer,text,text,numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_allocate_payment(integer,uuid,numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_assert_tenant_access(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_catalog_get(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_category_create(integer,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_context_get(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_current_persona_padre_id() TO anon;
GRANT EXECUTE ON FUNCTION public.dom_dashboard_summary(integer,date) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_entries_list(integer,integer) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_entry_create(integer,bigint,bigint,text,text,numeric,text,date) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_expenses_paginated_list(integer,integer,integer,text,text,text,text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.dom_expenses_paginated_list(integer,integer,integer,text,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_fn_registrar_asiento(integer,date,text,jsonb,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.dom_fn_registrar_asiento(integer,date,text,jsonb,text) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_onboarding_complete(integer,text,numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.dom_set_audit_fields() TO anon;

GRANT SELECT, USAGE ON SEQUENCE public.dom_expenses_id_seq, public.dom_ventures_id_seq TO anon;
GRANT UPDATE ON SEQUENCE public.dom_expenses_id_seq, public.dom_ventures_id_seq TO authenticated;
DROP TABLE public.dom_access_grants;
COMMIT;
