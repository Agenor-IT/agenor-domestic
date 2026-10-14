-- Domestic-only Google authorization. Existing business rows keep their persona_padre_id.
-- This migration intentionally touches only public.dom_* objects.
DO $preflight$
DECLARE
  expected_tables text[] := ARRAY[
    'dom_accounts',
    'dom_audit_log',
    'dom_card_installments',
    'dom_card_purchases',
    'dom_cards',
    'dom_categories',
    'dom_debt_installments',
    'dom_debt_payments',
    'dom_debts',
    'dom_entries',
    'dom_expenses',
    'dom_fiscal_years',
    'dom_journal_entries',
    'dom_journal_lines',
    'dom_monthly_parameters',
    'dom_parameters',
    'dom_projected_transactions',
    'dom_receivables',
    'dom_scenario_results',
    'dom_scenarios',
    'dom_transactions',
    'dom_ventures'
  ];
  expected_functions text[] := ARRAY[
    'dom_account_create',
    'dom_allocate_payment',
    'dom_assert_tenant_access',
    'dom_catalog_get',
    'dom_category_create',
    'dom_context_get',
    'dom_current_persona_padre_id',
    'dom_dashboard_summary',
    'dom_entries_list',
    'dom_entry_create',
    'dom_expenses_paginated_list',
    'dom_fn_registrar_asiento',
    'dom_onboarding_complete',
    'dom_set_audit_fields'
  ];
  actual_tables text[];
  actual_functions text[];
  owner_tenant integer;
  tenant_count integer;
  table_name text;
  foreign_rows boolean;
  owner_count integer;
BEGIN
  SELECT array_agg(tablename::text ORDER BY tablename) INTO actual_tables
  FROM pg_tables WHERE schemaname = 'public' AND left(tablename, 4) = 'dom_';
  IF actual_tables IS DISTINCT FROM expected_tables THEN
    RAISE EXCEPTION 'Domestic table inventory changed; review before applying auth migration';
  END IF;
  SELECT array_agg(p.proname::text ORDER BY p.proname) INTO actual_functions
  FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND left(p.proname, 4) = 'dom_';
  IF actual_functions IS DISTINCT FROM expected_functions THEN
    RAISE EXCEPTION 'Domestic function inventory changed; review before applying auth migration';
  END IF;

  SELECT count(DISTINCT persona_padre_id), min(persona_padre_id)
    INTO tenant_count, owner_tenant FROM public.dom_accounts;
  IF tenant_count <> 1 OR owner_tenant IS NULL THEN
    RAISE EXCEPTION 'Domestic owner tenant could not be uniquely identified';
  END IF;
  FOREACH table_name IN ARRAY expected_tables LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE persona_padre_id IS DISTINCT FROM $1)', table_name)
      INTO foreign_rows USING owner_tenant;
    IF foreign_rows THEN
      RAISE EXCEPTION 'Unexpected tenant in Domestic table %', table_name;
    END IF;
  END LOOP;

  SELECT count(*) INTO owner_count FROM auth.users AS u
  WHERE lower(u.email) = 'hergro1987@gmail.com'
    AND EXISTS (SELECT 1 FROM auth.identities AS i WHERE i.user_id = u.id AND i.provider = 'google');
  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one existing Google identity for Domestic owner';
  END IF;
END;
$preflight$;

CREATE TABLE public.dom_access_grants (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  persona_padre_id integer NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dom_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dom_access_grants FROM PUBLIC, anon, authenticated;

INSERT INTO public.dom_access_grants (auth_user_id, email, persona_padre_id)
SELECT u.id, lower(u.email), (SELECT min(persona_padre_id) FROM public.dom_accounts)
FROM auth.users AS u
WHERE lower(u.email) = 'hergro1987@gmail.com'
  AND EXISTS (SELECT 1 FROM auth.identities AS i WHERE i.user_id = u.id AND i.provider = 'google');

CREATE OR REPLACE FUNCTION public.dom_current_persona_padre_id()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT g.persona_padre_id
  FROM public.dom_access_grants AS g
  JOIN auth.users AS u ON u.id = g.auth_user_id
  WHERE g.auth_user_id = (SELECT auth.uid())
    AND lower(u.email) = g.email
    AND u.email_confirmed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.identities AS i
      WHERE i.user_id = u.id AND i.provider = 'google'
    )
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS s
      JOIN auth.mfa_amr_claims AS amr ON amr.session_id = s.id
      WHERE s.id = nullif(auth.jwt()->>'session_id', '')::uuid
        AND s.user_id = u.id
        AND amr.authentication_method = 'oauth'
    )
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.dom_assert_tenant_access(p_persona_padre_id integer)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_persona_padre_id IS DISTINCT FROM public.dom_current_persona_padre_id() THEN
    RAISE EXCEPTION 'No tiene acceso al contexto solicitado' USING errcode = '42501';
  END IF;
END;
$function$;

-- Guard privileged Domestic RPC before any read or write.
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
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
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

-- Guard privileged Domestic RPC before any read or write.
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
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
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
    SELECT nature INTO v_nature FROM public.dom_accounts
    WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La cuenta no pertenece al contexto activo' USING errcode = '42501';
    END IF;

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

    IF v_nature = 'debit' THEN
      UPDATE public.dom_accounts
      SET current_balance = current_balance + (v_debit - v_credit),
          updated_at = NOW()
      WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id;
    ELSE
      UPDATE public.dom_accounts
      SET current_balance = current_balance + (v_credit - v_debit),
          updated_at = NOW()
      WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id;
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

DO $secure$
DECLARE
  table_name text;
  policy_record record;
  function_record record;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND left(tablename, 4) = 'dom_'
      AND tablename <> 'dom_access_grants'
  LOOP
    FOR policy_record IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, table_name);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (persona_padre_id = (SELECT public.dom_current_persona_padre_id())) WITH CHECK (persona_padre_id = (SELECT public.dom_current_persona_padre_id()))',
      table_name || '_authenticated_owner', table_name
    );
  END LOOP;

  FOR function_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 4) = 'dom_'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_record.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_record.signature);
  END LOOP;
END;
$secure$;

REVOKE ALL ON SEQUENCE public.dom_expenses_id_seq, public.dom_ventures_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.dom_expenses_id_seq, public.dom_ventures_id_seq TO authenticated;
