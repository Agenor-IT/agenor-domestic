BEGIN;

-- Los registros anteriores conservan su saldo y pueden tener condiciones desconocidas.
ALTER TABLE public.dom_debts
  ADD COLUMN opened_on date,
  ADD COLUMN original_principal numeric(11,2),
  ADD COLUMN term_months integer,
  ADD COLUMN first_due_on date,
  ADD COLUMN amortization_method text,
  ADD CONSTRAINT dom_debts_projection_terms_check CHECK (
    (opened_on IS NULL AND original_principal IS NULL AND term_months IS NULL
      AND first_due_on IS NULL AND amortization_method IS NULL)
    OR (
      opened_on IS NOT NULL AND original_principal IS NOT NULL AND term_months IS NOT NULL
      AND first_due_on IS NOT NULL AND amortization_method IS NOT NULL
      AND opened_on BETWEEN DATE '1000-01-01' AND first_due_on
      AND first_due_on <= DATE '9969-12-31'
      AND original_principal BETWEEN 0.01 AND 999999999.99
      AND term_months BETWEEN 1 AND 360
      AND interest_rate_monthly BETWEEN 0 AND 100
      AND amortization_method IN ('french', 'german')
    )
  );

CREATE INDEX dom_debts_projection_tenant_id_idx ON public.dom_debts (persona_padre_id, id);

-- SECURITY INVOKER: mantiene la política existente de dom_debts en cada lectura/escritura.
CREATE FUNCTION public.dom_create_debt_projection(
  p_id uuid, p_persona_padre_id integer, p_creditor text, p_type text, p_opened_on date,
  p_principal numeric, p_term_months integer, p_monthly_rate numeric, p_first_due_on date, p_method text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  rate_fraction numeric;
  first_interest numeric;
  first_payment numeric;
  french_payment numeric;
  rate_units numeric;
  rate_factor numeric := 1;
  base_factor numeric := 1;
  numerator numeric;
  denominator numeric;
BEGIN
  IF p_persona_padre_id IS NULL THEN
    RAISE EXCEPTION 'Contexto de Domestic requerido' USING ERRCODE = '42501';
  END IF;
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);

  IF p_id IS NULL OR p_creditor IS NULL OR length(btrim(p_creditor)) NOT BETWEEN 1 AND 120
    OR p_type IS NULL OR length(btrim(p_type)) NOT BETWEEN 1 AND 60
    OR p_opened_on IS NULL OR p_first_due_on IS NULL
    OR p_opened_on NOT BETWEEN DATE '1000-01-01' AND p_first_due_on OR p_first_due_on > DATE '9969-12-31'
    OR p_principal IS NULL OR p_principal NOT BETWEEN 0.01 AND 999999999.99 OR p_principal <> round(p_principal, 2)
    OR p_term_months IS NULL OR p_term_months NOT BETWEEN 1 AND 360 OR p_principal * 100 < p_term_months
    OR p_monthly_rate IS NULL OR p_monthly_rate NOT BETWEEN 0 AND 100 OR p_monthly_rate <> round(p_monthly_rate, 4)
    OR p_method IS NULL OR p_method NOT IN ('french', 'german') THEN
    RAISE EXCEPTION 'Condiciones de deuda inválidas' USING ERRCODE = '22023';
  END IF;

  rate_fraction := p_monthly_rate / 100;
  first_interest := round(p_principal * rate_fraction, 2);
  IF p_method = 'french' AND p_term_months > 1 THEN
    IF rate_fraction = 0 THEN
      french_payment := div(2 * p_principal * 100 + p_term_months, 2 * p_term_months) / 100;
    ELSE
      -- La misma cuota racional y el mismo redondeo de medio centavo que en el dominio.
      rate_units := trunc(p_monthly_rate * 10000);
      FOR period_number IN 1..p_term_months LOOP
        rate_factor := rate_factor * (1000000 + rate_units);
        base_factor := base_factor * 1000000;
      END LOOP;
      numerator := p_principal * 100 * rate_units * rate_factor;
      denominator := 1000000 * (rate_factor - base_factor);
      french_payment := div(2 * numerator + denominator, 2 * denominator) / 100;
    END IF;
    IF french_payment <= first_interest THEN
      RAISE EXCEPTION 'El plazo y la tasa no permiten amortizar capital por cuota' USING ERRCODE = '22023';
    END IF;
  END IF;
  first_payment := CASE
    WHEN p_term_months = 1 THEN p_principal + first_interest
    WHEN p_method = 'german' THEN trunc(p_principal / p_term_months, 2) + first_interest
    ELSE first_interest + least(p_principal - (p_term_months - 1) * 0.01, french_payment - first_interest)
  END;

  INSERT INTO public.dom_debts (
    id, persona_padre_id, creditor_name, debt_type, total_principal, monthly_installment,
    interest_rate_monthly, opened_on, original_principal, term_months, first_due_on, amortization_method
  ) VALUES (
    p_id, p_persona_padre_id, btrim(p_creditor), btrim(p_type), p_principal, first_payment,
    p_monthly_rate, p_opened_on, p_principal, p_term_months, p_first_due_on, p_method
  ) ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.dom_debts AS debt
    WHERE debt.id = p_id AND debt.persona_padre_id = p_persona_padre_id
      AND debt.creditor_name = btrim(p_creditor) AND debt.debt_type = btrim(p_type)
      AND debt.opened_on = p_opened_on AND debt.original_principal = p_principal
      AND debt.term_months = p_term_months AND debt.interest_rate_monthly = p_monthly_rate
      AND debt.first_due_on = p_first_due_on AND debt.amortization_method = p_method
  ) THEN
    RAISE EXCEPTION 'No se pudo recuperar el alta de la deuda' USING ERRCODE = '23505';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.dom_create_debt_projection(uuid, integer, text, text, date, numeric, integer, numeric, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dom_create_debt_projection(uuid, integer, text, text, date, numeric, integer, numeric, date, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
