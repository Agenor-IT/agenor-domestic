BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dom_debt_installments GROUP BY persona_padre_id, debt_id, installment_number HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.dom_debt_installments i JOIN public.dom_debts d ON d.id=i.debt_id
    WHERE d.persona_padre_id <> i.persona_padre_id
  ) THEN
    RAISE EXCEPTION 'Existen cuotas históricas duplicadas o de otro contexto; revisar sin modificar datos automáticamente';
  END IF;
END
$preflight$;

CREATE TABLE public.dom_creditors (
  id uuid PRIMARY KEY,
  persona_padre_id integer NOT NULL,
  name text NOT NULL CHECK (name = btrim(name) AND length(name) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('person', 'organization')),
  document text NOT NULL DEFAULT '' CHECK (document = btrim(document) AND length(document) <= 40),
  contact text NOT NULL DEFAULT '' CHECK (contact = btrim(contact) AND length(contact) <= 120),
  UNIQUE (persona_padre_id, id)
);
CREATE UNIQUE INDEX dom_creditors_document_key ON public.dom_creditors (persona_padre_id, lower(document))
  WHERE document <> '';
ALTER TABLE public.dom_creditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY dom_creditors_read ON public.dom_creditors FOR SELECT TO authenticated
  USING (persona_padre_id = (SELECT public.dom_current_persona_padre_id()));
CREATE POLICY dom_creditors_create ON public.dom_creditors FOR INSERT TO authenticated
  WITH CHECK (persona_padre_id = (SELECT public.dom_current_persona_padre_id()));
REVOKE ALL ON public.dom_creditors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.dom_creditors TO authenticated;

ALTER TABLE public.dom_debts
  ADD COLUMN creditor_id uuid,
  ADD COLUMN operation_number text,
  ADD COLUMN debt_relationship text,
  ADD COLUMN nominal_annual_rate numeric(8,4),
  ADD CONSTRAINT dom_debts_creditor_tenant_fk FOREIGN KEY (persona_padre_id, creditor_id)
    REFERENCES public.dom_creditors(persona_padre_id, id),
  ADD CONSTRAINT dom_debts_plan_metadata_check CHECK (
    (creditor_id IS NULL AND operation_number IS NULL AND debt_relationship IS NULL AND nominal_annual_rate IS NULL)
    OR (
      creditor_id IS NOT NULL AND operation_number IS NOT NULL AND debt_relationship IS NOT NULL
      AND nominal_annual_rate IS NOT NULL AND original_principal IS NOT NULL
      AND operation_number = btrim(operation_number) AND length(operation_number) BETWEEN 1 AND 80
      AND length(debt_relationship) <= 160 AND nominal_annual_rate BETWEEN 0 AND 1200
      AND interest_rate_monthly = round(nominal_annual_rate / 12, 4)
    )
  );
ALTER TABLE public.dom_debts ADD CONSTRAINT dom_debts_id_context_key UNIQUE (id, persona_padre_id);
ALTER TABLE public.dom_debt_installments ADD CONSTRAINT dom_debt_installments_debt_context_fk
  FOREIGN KEY (debt_id, persona_padre_id) REFERENCES public.dom_debts(id, persona_padre_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX dom_debt_installments_number_key
  ON public.dom_debt_installments (persona_padre_id, debt_id, installment_number);

CREATE FUNCTION public.dom_create_debt_plan(
  p_id uuid, p_persona_padre_id integer, p_creditor_id uuid, p_operation_number text,
  p_relationship text, p_type text, p_opened_on date, p_principal numeric, p_term_months integer,
  p_nominal_annual_rate numeric, p_first_due_on date, p_method text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  creditor_name text;
  existing public.dom_debts%ROWTYPE;
  monthly_rate numeric;
  rate_units numeric;
  rate_factor numeric := 1;
  base_factor numeric := 1;
  numerator numeric;
  denominator numeric;
  fixed_payment numeric;
  balance numeric;
  principal_part numeric;
  interest_part numeric;
BEGIN
  IF p_persona_padre_id IS NULL THEN
    RAISE EXCEPTION 'Contexto de Domestic requerido' USING ERRCODE = '42501';
  END IF;
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  IF p_id IS NULL OR p_creditor_id IS NULL OR p_operation_number IS NULL
    OR length(btrim(p_operation_number)) NOT BETWEEN 1 AND 80 OR p_relationship IS NULL
    OR length(btrim(p_relationship)) > 160 OR p_nominal_annual_rate IS NULL
    OR p_nominal_annual_rate NOT BETWEEN 0 AND 1200 OR p_nominal_annual_rate <> round(p_nominal_annual_rate, 4) THEN
    RAISE EXCEPTION 'Datos de operación inválidos' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 110011));
  SELECT debt.* INTO existing FROM public.dom_debts debt
    WHERE debt.id = p_id AND debt.persona_padre_id = p_persona_padre_id;
  IF FOUND THEN
    IF existing.creditor_id = p_creditor_id AND existing.operation_number = btrim(p_operation_number)
      AND existing.debt_relationship = btrim(p_relationship) AND existing.nominal_annual_rate = p_nominal_annual_rate
      AND existing.debt_type = btrim(p_type) AND existing.opened_on = p_opened_on
      AND existing.original_principal = p_principal AND existing.term_months = p_term_months
      AND existing.first_due_on = p_first_due_on AND existing.amortization_method = p_method THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'El alta previa tiene otros datos' USING ERRCODE = '23505';
  END IF;

  SELECT c.name INTO creditor_name FROM public.dom_creditors c
    WHERE c.persona_padre_id = p_persona_padre_id AND c.id = p_creditor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acreedor no disponible en este contexto' USING ERRCODE = '42501';
  END IF;

  monthly_rate := round(p_nominal_annual_rate / 12, 4);
  PERFORM public.dom_create_debt_projection(
    p_id, p_persona_padre_id, creditor_name, p_type, p_opened_on, p_principal,
    p_term_months, monthly_rate, p_first_due_on, p_method
  );
  UPDATE public.dom_debts debt SET creditor_id = p_creditor_id, operation_number = btrim(p_operation_number),
    debt_relationship = btrim(p_relationship), nominal_annual_rate = p_nominal_annual_rate
    WHERE debt.id = p_id AND debt.persona_padre_id = p_persona_padre_id;

  -- Igual a la fórmula en centavos del dominio. Div usa división entera exacta.
  IF p_method = 'french' AND p_term_months > 1 THEN
    IF monthly_rate = 0 THEN
      fixed_payment := div(2 * p_principal * 100 + p_term_months, 2 * p_term_months) / 100;
    ELSE
      rate_units := trunc(monthly_rate * 10000);
      FOR period_number IN 1..p_term_months LOOP
        rate_factor := rate_factor * (1000000 + rate_units);
        base_factor := base_factor * 1000000;
      END LOOP;
      numerator := p_principal * 100 * rate_units * rate_factor;
      denominator := 1000000 * (rate_factor - base_factor);
      fixed_payment := div(2 * numerator + denominator, 2 * denominator) / 100;
    END IF;
  END IF;

  balance := p_principal;
  FOR period_number IN 1..p_term_months LOOP
    interest_part := round(balance * monthly_rate / 100, 2);
    principal_part := CASE
      WHEN period_number = p_term_months THEN balance
      WHEN p_method = 'german' THEN div(p_principal * 100, p_term_months) / 100
      ELSE least(balance - (p_term_months - period_number) * 0.01, greatest(0, fixed_payment - interest_part))
    END;
    INSERT INTO public.dom_debt_installments (
      persona_padre_id, debt_id, installment_number, due_date, amount_principal, amount_interest, status
    ) VALUES (
      p_persona_padre_id, p_id, period_number, (p_first_due_on + make_interval(months => period_number - 1))::date,
      principal_part, interest_part, 'pending'
    );
    balance := balance - principal_part;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.dom_create_debt_plan(uuid, integer, uuid, text, text, text, date, numeric, integer, numeric, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dom_create_debt_plan(uuid, integer, uuid, text, text, text, date, numeric, integer, numeric, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
