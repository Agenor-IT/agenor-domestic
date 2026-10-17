-- Registro contable doméstico: operaciones y asientos atómicos, sin alterar datos históricos.
-- La publicación exige respaldo, revisión del esquema vivo y despliegue coordinado del frontend.

ALTER TABLE public.dom_transactions
  ADD COLUMN IF NOT EXISTS journal_entry_id bigint,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_fingerprint text,
  ADD COLUMN IF NOT EXISTS settles_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS classification_account_id bigint;

ALTER TABLE public.dom_journal_entries
  ADD COLUMN IF NOT EXISTS source_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS reverses_entry_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_transactions'::regclass
      AND conname = 'dom_transactions_journal_entry_id_fkey'
  ) THEN
    ALTER TABLE public.dom_transactions
      ADD CONSTRAINT dom_transactions_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES public.dom_journal_entries(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_journal_entries'::regclass
      AND conname = 'dom_journal_entries_source_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.dom_journal_entries
      ADD CONSTRAINT dom_journal_entries_source_transaction_id_fkey
      FOREIGN KEY (source_transaction_id) REFERENCES public.dom_transactions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_journal_entries'::regclass
      AND conname = 'dom_journal_entries_reverses_entry_id_fkey'
  ) THEN
    ALTER TABLE public.dom_journal_entries
      ADD CONSTRAINT dom_journal_entries_reverses_entry_id_fkey
      FOREIGN KEY (reverses_entry_id) REFERENCES public.dom_journal_entries(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_transactions'::regclass
      AND conname = 'dom_transactions_settles_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.dom_transactions
      ADD CONSTRAINT dom_transactions_settles_transaction_id_fkey
      FOREIGN KEY (settles_transaction_id) REFERENCES public.dom_transactions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_transactions'::regclass
      AND conname = 'dom_transactions_classification_account_id_fkey'
  ) THEN
    ALTER TABLE public.dom_transactions
      ADD CONSTRAINT dom_transactions_classification_account_id_fkey
      FOREIGN KEY (classification_account_id) REFERENCES public.dom_accounts(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dom_journal_lines'::regclass
      AND conname = 'dom_journal_lines_one_side_chk'
  ) THEN
    ALTER TABLE public.dom_journal_lines
      ADD CONSTRAINT dom_journal_lines_one_side_chk
      CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dom_journal_entries_tenant_number_uq
  ON public.dom_journal_entries(persona_padre_id, entry_number);
CREATE INDEX IF NOT EXISTS dom_journal_entries_source_transaction_idx
  ON public.dom_journal_entries(persona_padre_id, source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dom_transactions_settlements_idx
  ON public.dom_transactions(persona_padre_id, settles_transaction_id)
  WHERE settles_transaction_id IS NOT NULL AND status <> 'voided';

CREATE OR REPLACE FUNCTION public.dom_fn_registrar_asiento(
  p_persona_padre_id integer,
  p_fecha date,
  p_concepto text,
  p_lineas jsonb,
  p_referencia_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_entry_id bigint;
  v_next_number bigint;
  v_sum_debit numeric(18,2) := 0;
  v_sum_credit numeric(18,2) := 0;
  v_line jsonb;
  v_account_id bigint;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_nature text;
  v_archived boolean;
  v_open_periods integer;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  IF p_fecha IS NULL OR btrim(coalesce(p_concepto, '')) = '' THEN
    RAISE EXCEPTION 'Fecha y concepto son obligatorios' USING errcode = '22023';
  END IF;
  IF p_fecha > (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN
    RAISE EXCEPTION 'No se puede registrar un hecho contable futuro'
      USING errcode = '22023';
  END IF;
  IF jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lineas) < 2 THEN
    RAISE EXCEPTION 'El asiento requiere al menos dos renglones' USING errcode = '22023';
  END IF;
  -- También protege la comprobación de ejercicio frente a un cierre concurrente.
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, p_persona_padre_id);
  SELECT count(*) INTO v_open_periods
  FROM public.dom_fiscal_years
  WHERE persona_padre_id = p_persona_padre_id
    AND p_fecha BETWEEN start_date AND end_date
    AND status = 'open';
  IF v_open_periods <> 1 THEN
    RAISE EXCEPTION 'La fecha debe pertenecer a un único ejercicio abierto' USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dom_fiscal_years
    WHERE persona_padre_id = p_persona_padre_id
      AND status = 'closed' AND start_date > p_fecha
  ) THEN
    RAISE EXCEPTION 'No se puede registrar en un ejercicio anterior a otro ya cerrado'
      USING errcode = '22023';
  END IF;

  -- El mismo bloqueo serializa la numeración entre todos los RPC.
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lineas)
  LOOP
    v_account_id := (v_line->>'account_id')::bigint;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    IF v_debit < 0 OR v_credit < 0
       OR (v_debit = 0 AND v_credit = 0)
       OR (v_debit > 0 AND v_credit > 0)
       OR round(v_debit, 2) <> v_debit
       OR round(v_credit, 2) <> v_credit THEN
      RAISE EXCEPTION 'Cada renglón debe tener un único importe positivo de dos decimales'
        USING errcode = '22023';
    END IF;
    SELECT nature, is_archived INTO v_nature, v_archived
    FROM public.dom_accounts
    WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
    IF NOT FOUND OR v_archived THEN
      RAISE EXCEPTION 'Cuenta inexistente, archivada o ajena al contexto'
        USING errcode = '42501';
    END IF;
    v_sum_debit := v_sum_debit + v_debit;
    v_sum_credit := v_sum_credit + v_credit;
  END LOOP;
  IF v_sum_debit <= 0 OR v_sum_debit <> v_sum_credit THEN
    RAISE EXCEPTION 'El asiento no cuadra' USING errcode = '22023';
  END IF;

  SELECT coalesce(max(entry_number), 0) + 1 INTO v_next_number
  FROM public.dom_journal_entries WHERE persona_padre_id = p_persona_padre_id;
  INSERT INTO public.dom_journal_entries
    (persona_padre_id, entry_number, entry_date, description, reference_id)
  VALUES
    (p_persona_padre_id, v_next_number, p_fecha, btrim(p_concepto), nullif(btrim(p_referencia_id), ''))
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lineas)
  LOOP
    v_account_id := (v_line->>'account_id')::bigint;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    SELECT nature INTO v_nature FROM public.dom_accounts
    WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id;
    INSERT INTO public.dom_journal_lines
      (persona_padre_id, journal_entry_id, account_id, debit, credit, memo)
    VALUES
      (p_persona_padre_id, v_entry_id, v_account_id, v_debit, v_credit, v_line->>'memo');
    UPDATE public.dom_accounts
    SET current_balance = current_balance +
      CASE WHEN v_nature = 'debit' THEN v_debit - v_credit ELSE v_credit - v_debit END,
      updated_at = now()
    WHERE id = v_account_id AND persona_padre_id = p_persona_padre_id;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.dom_accounts
    WHERE persona_padre_id = p_persona_padre_id
      AND (code LIKE '1.1.01.%' OR code LIKE '1.1.02.%')
      AND current_balance < -0.01
  ) THEN
    RAISE EXCEPTION 'Un asiento dejaría la tesorería con saldo negativo'
      USING errcode = '22023';
  END IF;
  RETURN jsonb_build_object(
    'success', true, 'entry_id', v_entry_id, 'entry_number', v_next_number,
    'message', 'Asiento registrado'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dom_post_transaction(
  p_persona_padre_id integer,
  p_id uuid,
  p_expected_revision integer,
  p_transaction jsonb,
  p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_existing public.dom_transactions%ROWTYPE;
  v_origin public.dom_transactions%ROWTYPE;
  v_old_entry public.dom_journal_entries%ROWTYPE;
  v_fingerprint text;
  v_amount numeric(18,2);
  v_date date;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_distinct_accounts integer;
  v_operation_type text;
  v_payment_condition text;
  v_method_kind text;
  v_debit_code text;
  v_credit_code text;
  v_debit_id bigint;
  v_credit_id bigint;
  v_payment_id bigint;
  v_payment_code text;
  v_matches integer;
  v_available numeric(18,2);
  v_settled numeric(18,2);
  v_settles_id uuid;
  v_classification_id bigint;
  v_classification_kind text;
  v_classification_nature text;
  v_reversal_lines jsonb;
  v_reversal jsonb;
  v_entry jsonb;
  v_revision integer;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, p_persona_padre_id);
  IF p_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR jsonb_typeof(p_transaction) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Solicitud de operación inválida' USING errcode = '22023';
  END IF;
  v_amount := (p_transaction->>'amount')::numeric;
  v_date := (p_transaction->>'occurred_on')::date;
  IF v_amount IS NULL OR v_amount <= 0 OR round(v_amount, 2) <> v_amount
     OR v_date IS NULL OR btrim(coalesce(p_transaction->>'description', '')) = ''
     OR btrim(coalesce(p_transaction->>'counterparty', '')) = ''
     OR btrim(coalesce(p_transaction->>'op_number', '')) = ''
     OR coalesce(p_transaction->>'direction', '') NOT IN ('income', 'expense')
     OR coalesce(p_transaction->>'payment_condition', '') NOT IN ('contado', 'cta_cte')
     OR coalesce(p_transaction->>'operation_type', '') NOT IN
       ('venta', 'compra', 'cobro', 'pago', 'pago_tarjeta', 'alquiler_ganado', 'alquiler_perdido', 'honorarios')
     OR btrim(coalesce(p_transaction->>'payment_method', '')) = '' THEN
    RAISE EXCEPTION 'Datos de operación incompletos o inválidos' USING errcode = '22023';
  END IF;
  IF (p_transaction->>'operation_type' IN ('venta','cobro','alquiler_ganado','honorarios'))
       <> (p_transaction->>'direction' = 'income') THEN
    RAISE EXCEPTION 'Tipo y dirección de operación incompatibles' USING errcode = '22023';
  END IF;
  IF jsonb_array_length(p_lines) <> 2 THEN
    RAISE EXCEPTION 'La operación requiere exactamente un debe y un haber'
      USING errcode = '22023';
  END IF;
  SELECT sum(coalesce((value->>'debit')::numeric, 0)),
         sum(coalesce((value->>'credit')::numeric, 0)),
         count(DISTINCT (value->>'account_id')::bigint)
    INTO v_debit, v_credit, v_distinct_accounts
  FROM jsonb_array_elements(p_lines);
  IF v_debit <> v_amount OR v_credit <> v_amount OR v_distinct_accounts <> 2 THEN
    RAISE EXCEPTION 'El asiento no coincide con el importe de la operación'
      USING errcode = '22023';
  END IF;
  v_operation_type := p_transaction->>'operation_type';
  v_payment_condition := p_transaction->>'payment_condition';
  v_method_kind := p_transaction->>'payment_method_kind';
  v_settles_id := nullif(p_transaction->>'settles_transaction_id', '')::uuid;
  v_classification_id := nullif(p_transaction->>'classification_account_id', '')::bigint;
  IF v_operation_type NOT IN ('cobro', 'pago', 'pago_tarjeta') THEN
    SELECT kind, nature INTO v_classification_kind, v_classification_nature
    FROM public.dom_accounts
    WHERE id = v_classification_id AND persona_padre_id = p_persona_padre_id
      AND NOT is_archived;
    IF NOT FOUND OR (v_classification_kind <> (p_transaction->>'direction') AND NOT
      (v_operation_type = 'compra' AND v_classification_kind = 'asset' AND
       EXISTS (SELECT 1 FROM public.dom_accounts
         WHERE id = v_classification_id AND persona_padre_id = p_persona_padre_id
           AND (code LIKE '1.2.01.%' OR code LIKE '1.1.05.%'))))
       OR v_classification_nature <> CASE WHEN v_classification_kind = 'income'
          THEN 'credit' ELSE 'debit' END THEN
      RAISE EXCEPTION 'Seleccioná una cuenta de resultado válida del hogar'
        USING errcode = '22023';
    END IF;
  ELSIF v_classification_id IS NOT NULL THEN
    RAISE EXCEPTION 'Un cobro o pago no registra un nuevo resultado'
      USING errcode = '22023';
  END IF;
  IF v_operation_type IN ('cobro', 'pago') THEN
    IF v_settles_id IS NULL OR v_settles_id = p_id THEN
      RAISE EXCEPTION 'Seleccioná la operación pendiente que se cancela'
        USING errcode = '22023';
    END IF;
    SELECT * INTO v_origin FROM public.dom_transactions
    WHERE id = v_settles_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
    IF NOT FOUND OR v_origin.status <> 'confirmed'
       OR v_origin.payment_condition <> 'cta_cte'
       OR v_origin.journal_entry_id IS NULL
       OR (v_operation_type = 'cobro' AND v_origin.operation_type NOT IN
         ('venta', 'honorarios', 'alquiler_ganado'))
       OR (v_operation_type = 'pago' AND v_origin.operation_type NOT IN
         ('compra', 'alquiler_perdido'))
       OR lower(btrim(v_origin.counterparty)) <> lower(btrim(p_transaction->>'counterparty')) THEN
      RAISE EXCEPTION 'La operación pendiente no corresponde al cobro o pago'
        USING errcode = '22023';
    END IF;
    SELECT coalesce(sum(amount), 0) INTO v_settled
    FROM public.dom_transactions
    WHERE persona_padre_id = p_persona_padre_id
      AND settles_transaction_id = v_settles_id
      AND status = 'confirmed' AND id <> p_id;
    IF v_amount > v_origin.amount - v_settled THEN
      RAISE EXCEPTION 'El importe supera el saldo pendiente de la operación vinculada'
        USING errcode = '22023';
    END IF;
  ELSIF v_settles_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sólo cobros y pagos pueden cancelar operaciones pendientes'
      USING errcode = '22023';
  END IF;
  IF v_payment_condition = 'contado' AND v_operation_type <> 'canje' THEN
    IF coalesce(v_method_kind, '') NOT IN ('cash', 'bank', 'card') THEN
      RAISE EXCEPTION 'Medio de pago inválido' USING errcode = '22023';
    END IF;
    IF v_method_kind = 'card' AND v_operation_type NOT IN ('compra', 'alquiler_perdido') THEN
      RAISE EXCEPTION 'La tarjeta sólo puede registrar compras en este formulario'
        USING errcode = '22023';
    END IF;
    IF v_method_kind <> 'card' THEN
      v_payment_id := nullif(p_transaction->>'payment_account_id', '')::bigint;
      SELECT code INTO v_payment_code FROM public.dom_accounts
      WHERE id = v_payment_id AND persona_padre_id = p_persona_padre_id
        AND kind IN ('asset', 'cash', 'bank', 'wallet') AND NOT is_archived;
      IF v_payment_code IS NULL OR
         (v_method_kind = 'cash' AND v_payment_code NOT LIKE '1.1.01.%') OR
         (v_method_kind = 'bank' AND v_payment_code NOT IN ('1.1.02.01', '1.1.02.02')) THEN
        RAISE EXCEPTION 'Seleccioná una cuenta de tesorería válida'
          USING errcode = '22023';
      END IF;
    END IF;
  END IF;
  IF v_operation_type IN ('cobro', 'pago', 'pago_tarjeta') AND v_payment_condition <> 'contado' THEN
    RAISE EXCEPTION 'Cobros y pagos requieren una cuenta de tesorería'
      USING errcode = '22023';
  END IF;
  CASE v_operation_type
    WHEN 'venta', 'honorarios' THEN
      v_debit_code := CASE WHEN v_payment_condition = 'cta_cte'
        THEN '1.1.03.01' ELSE v_payment_code END;
      v_credit_id := v_classification_id;
    WHEN 'alquiler_ganado' THEN
      v_debit_code := CASE WHEN v_payment_condition = 'cta_cte'
        THEN '1.1.03.01' ELSE v_payment_code END;
      v_credit_id := v_classification_id;
    WHEN 'compra', 'alquiler_perdido' THEN
      v_debit_id := v_classification_id;
      v_credit_code := CASE
        WHEN v_payment_condition = 'cta_cte' THEN '2.1.01.01'
        WHEN v_method_kind = 'card' THEN '2.1.01.04'
        ELSE v_payment_code END;
    WHEN 'cobro' THEN
      v_debit_code := v_payment_code;
      v_credit_code := '1.1.03.01';
    WHEN 'pago' THEN
      v_debit_code := '2.1.01.01';
      v_credit_code := v_payment_code;
    WHEN 'pago_tarjeta' THEN
      v_debit_code := '2.1.01.04';
      v_credit_code := v_payment_code;
  END CASE;
  IF v_debit_id IS NULL THEN
    SELECT id INTO v_debit_id FROM public.dom_accounts
    WHERE persona_padre_id = p_persona_padre_id AND code = v_debit_code
      AND NOT is_archived;
  END IF;
  IF v_credit_id IS NULL THEN
    SELECT id INTO v_credit_id FROM public.dom_accounts
    WHERE persona_padre_id = p_persona_padre_id AND code = v_credit_code
      AND NOT is_archived;
  END IF;
  IF v_debit_id IS NULL OR v_credit_id IS NULL OR v_debit_id = v_credit_id THEN
    RAISE EXCEPTION 'Faltan cuentas activas del plan contable'
      USING errcode = '22023';
  END IF;
  SELECT count(*) INTO v_matches FROM jsonb_array_elements(p_lines)
  WHERE
    ((value->>'account_id')::bigint = v_debit_id
      AND coalesce((value->>'debit')::numeric, 0) = v_amount
      AND coalesce((value->>'credit')::numeric, 0) = 0)
    OR
    ((value->>'account_id')::bigint = v_credit_id
      AND coalesce((value->>'credit')::numeric, 0) = v_amount
      AND coalesce((value->>'debit')::numeric, 0) = 0);
  IF v_matches <> 2 THEN
    RAISE EXCEPTION 'Las cuentas del asiento no corresponden al tipo de operación'
      USING errcode = '22023';
  END IF;
  v_fingerprint := md5(p_transaction::text || p_lines::text);

  SELECT * INTO v_existing FROM public.dom_transactions
  WHERE id = p_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'voided' THEN
      RAISE EXCEPTION 'La operación ya fue anulada' USING errcode = '22023';
    END IF;
    IF v_existing.revision <> p_expected_revision THEN
      IF v_existing.revision = p_expected_revision + 1
         AND v_existing.last_fingerprint = v_fingerprint THEN
        RETURN jsonb_build_object(
          'success', true, 'id', p_id, 'revision', v_existing.revision,
          'entry_id', v_existing.journal_entry_id, 'replayed', true
        );
      END IF;
      RAISE EXCEPTION 'La operación cambió; actualizá la lista antes de editar'
        USING errcode = '40001';
    END IF;
    IF v_existing.journal_entry_id IS NULL THEN
      RAISE EXCEPTION 'Operación histórica sin asiento vinculado: requiere conciliación'
        USING errcode = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.dom_transactions
      WHERE persona_padre_id = p_persona_padre_id
        AND settles_transaction_id = p_id AND status = 'confirmed'
    ) THEN
      RAISE EXCEPTION 'La operación tiene cobros o pagos asociados; anulalos antes de editarla'
        USING errcode = '22023';
    END IF;
    SELECT * INTO v_old_entry FROM public.dom_journal_entries
    WHERE id = v_existing.journal_entry_id
      AND persona_padre_id = p_persona_padre_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Asiento original no encontrado' USING errcode = '22023';
    END IF;
    SELECT jsonb_agg(jsonb_build_object(
      'account_id', account_id, 'debit', credit, 'credit', debit,
      'memo', 'Reversión de asiento ' || v_old_entry.entry_number
    ) ORDER BY id) INTO v_reversal_lines
    FROM public.dom_journal_lines
    WHERE journal_entry_id = v_old_entry.id AND persona_padre_id = p_persona_padre_id;
    v_reversal := public.dom_fn_registrar_asiento(
      p_persona_padre_id, v_old_entry.entry_date,
      'Reversión de operación ' || v_existing.op_number,
      v_reversal_lines, 'REV-' || p_id::text || '-' || v_existing.revision::text
    );
    UPDATE public.dom_journal_entries
    SET source_transaction_id = p_id, reverses_entry_id = v_old_entry.id
    WHERE id = (v_reversal->>'entry_id')::bigint;
    v_revision := v_existing.revision + 1;
    UPDATE public.dom_transactions SET
      direction = p_transaction->>'direction',
      amount = v_amount,
      description = btrim(p_transaction->>'description'),
      occurred_on = v_date,
      payment_method = p_transaction->>'payment_method',
      op_number = p_transaction->>'op_number',
      counterparty = btrim(p_transaction->>'counterparty'),
      operation_type = p_transaction->>'operation_type',
      payment_condition = p_transaction->>'payment_condition',
      settles_transaction_id = v_settles_id,
      classification_account_id = v_classification_id,
      last_fingerprint = v_fingerprint,
      revision = v_revision,
      updated_at = now()
    WHERE id = p_id AND persona_padre_id = p_persona_padre_id;
  ELSE
    IF p_expected_revision <> 0 THEN
      RAISE EXCEPTION 'La operación ya no existe; actualizá la lista'
        USING errcode = '40001';
    END IF;
    v_revision := 1;
    INSERT INTO public.dom_transactions
      (id, persona_padre_id, direction, amount, description, occurred_on,
       payment_method, status, op_number, counterparty, operation_type,
       payment_condition, settles_transaction_id, classification_account_id,
       revision, last_fingerprint, created_by)
    VALUES
      (p_id, p_persona_padre_id, p_transaction->>'direction', v_amount,
       btrim(p_transaction->>'description'), v_date,
       p_transaction->>'payment_method', 'confirmed',
       p_transaction->>'op_number', btrim(p_transaction->>'counterparty'),
       p_transaction->>'operation_type', p_transaction->>'payment_condition',
       v_settles_id, v_classification_id,
       v_revision, v_fingerprint, auth.uid());
  END IF;

  -- El saldo se verifica después de revertir una edición, bajo el bloqueo del tenant.
  IF v_operation_type IN ('cobro', 'pago', 'pago_tarjeta') THEN
    SELECT current_balance INTO v_available FROM public.dom_accounts
    WHERE id = CASE WHEN v_operation_type = 'cobro' THEN v_credit_id ELSE v_debit_id END
      AND persona_padre_id = p_persona_padre_id FOR UPDATE;
    IF v_available < v_amount THEN
      RAISE EXCEPTION 'El cobro o pago supera la cuenta pendiente'
        USING errcode = '22023';
    END IF;
  END IF;
  IF v_operation_type IN ('compra', 'alquiler_perdido', 'pago', 'pago_tarjeta')
     AND v_payment_condition = 'contado' AND v_method_kind IN ('cash', 'bank') THEN
    SELECT current_balance INTO v_available FROM public.dom_accounts
    WHERE id = v_payment_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
    IF v_available < v_amount THEN
      RAISE EXCEPTION 'La cuenta de pago no tiene saldo suficiente'
        USING errcode = '22023';
    END IF;
  END IF;

  v_entry := public.dom_fn_registrar_asiento(
    p_persona_padre_id, v_date,
    '[' || upper(p_transaction->>'operation_type') || '] ' ||
      btrim(p_transaction->>'counterparty') || ': ' ||
      btrim(p_transaction->>'description'),
    p_lines, p_transaction->>'op_number'
  );
  UPDATE public.dom_journal_entries SET source_transaction_id = p_id
  WHERE id = (v_entry->>'entry_id')::bigint
    AND persona_padre_id = p_persona_padre_id;
  UPDATE public.dom_transactions
  SET journal_entry_id = (v_entry->>'entry_id')::bigint
  WHERE id = p_id AND persona_padre_id = p_persona_padre_id;
  RETURN jsonb_build_object(
    'success', true, 'id', p_id, 'revision', v_revision,
    'entry_id', (v_entry->>'entry_id')::bigint,
    'entry_number', (v_entry->>'entry_number')::bigint
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dom_void_transaction(
  p_persona_padre_id integer,
  p_id uuid,
  p_expected_revision integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tx public.dom_transactions%ROWTYPE;
  v_entry public.dom_journal_entries%ROWTYPE;
  v_lines jsonb;
  v_reversal jsonb;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, p_persona_padre_id);
  SELECT * INTO v_tx FROM public.dom_transactions
  WHERE id = p_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING errcode = '22023';
  END IF;
  IF v_tx.status = 'voided' THEN
    RETURN jsonb_build_object('success', true, 'id', p_id, 'revision', v_tx.revision, 'replayed', true);
  END IF;
  IF v_tx.revision <> p_expected_revision OR v_tx.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Operación desactualizada o sin asiento conciliado'
      USING errcode = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dom_transactions
    WHERE persona_padre_id = p_persona_padre_id
      AND settles_transaction_id = p_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Primero anulá los cobros o pagos de esta operación'
      USING errcode = '22023';
  END IF;
  SELECT * INTO v_entry FROM public.dom_journal_entries
  WHERE id = v_tx.journal_entry_id AND persona_padre_id = p_persona_padre_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asiento original no encontrado' USING errcode = '22023';
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'account_id', account_id, 'debit', credit, 'credit', debit,
    'memo', 'Anulación de asiento ' || v_entry.entry_number
  ) ORDER BY id) INTO v_lines
  FROM public.dom_journal_lines
  WHERE journal_entry_id = v_entry.id AND persona_padre_id = p_persona_padre_id;
  v_reversal := public.dom_fn_registrar_asiento(
    p_persona_padre_id, v_entry.entry_date,
    'Anulación de operación ' || v_tx.op_number, v_lines,
    'ANU-' || p_id::text || '-' || v_tx.revision::text
  );
  UPDATE public.dom_journal_entries
  SET source_transaction_id = p_id, reverses_entry_id = v_entry.id
  WHERE id = (v_reversal->>'entry_id')::bigint;
  UPDATE public.dom_transactions
  SET status = 'voided', voided_at = now(), revision = revision + 1, updated_at = now()
  WHERE id = p_id AND persona_padre_id = p_persona_padre_id;
  RETURN jsonb_build_object(
    'success', true, 'id', p_id, 'revision', v_tx.revision + 1,
    'reversal_entry_id', (v_reversal->>'entry_id')::bigint
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dom_open_fiscal_year(
  p_persona_padre_id integer,
  p_fiscal_year_id bigint,
  p_balances jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_year public.dom_fiscal_years%ROWTYPE;
  v_balance jsonb;
  v_account public.dom_accounts%ROWTYPE;
  v_amount numeric(18,2);
  v_debit numeric(18,2) := 0;
  v_credit numeric(18,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_capital_id bigint;
  v_entry jsonb;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, p_persona_padre_id);
  SELECT * INTO v_year FROM public.dom_fiscal_years
  WHERE id = p_fiscal_year_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
  IF NOT FOUND OR v_year.status <> 'open' OR v_year.opening_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'El ejercicio no admite otra apertura' USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dom_journal_entries
    WHERE persona_padre_id = p_persona_padre_id
  ) THEN
    RAISE EXCEPTION 'La apertura manual sólo se admite antes del primer asiento; los ejercicios siguientes arrastran saldos'
      USING errcode = '22023';
  END IF;
  IF jsonb_typeof(p_balances) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_balances) = 0 THEN
    RAISE EXCEPTION 'Ingresá saldos patrimoniales de apertura' USING errcode = '22023';
  END IF;
  IF (SELECT count(DISTINCT (value->>'account_id')::bigint)
      FROM jsonb_array_elements(p_balances)) <> jsonb_array_length(p_balances) THEN
    RAISE EXCEPTION 'Una cuenta figura más de una vez' USING errcode = '22023';
  END IF;
  SELECT id INTO v_capital_id FROM public.dom_accounts
  WHERE persona_padre_id = p_persona_padre_id AND code = '3.1.01.01'
    AND kind = 'equity' AND NOT is_archived;
  IF v_capital_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta de patrimonio neto' USING errcode = '22023';
  END IF;
  FOR v_balance IN SELECT value FROM jsonb_array_elements(p_balances)
  LOOP
    v_amount := (v_balance->>'opening_balance')::numeric;
    SELECT * INTO v_account FROM public.dom_accounts
    WHERE id = (v_balance->>'account_id')::bigint
      AND persona_padre_id = p_persona_padre_id;
    IF NOT FOUND OR v_account.is_archived OR v_account.kind NOT IN
      ('asset', 'cash', 'bank', 'wallet', 'liability', 'card')
      OR v_amount IS NULL OR v_amount < 0 OR round(v_amount, 2) <> v_amount THEN
      RAISE EXCEPTION 'Saldo inicial o cuenta patrimonial inválidos'
        USING errcode = '22023';
    END IF;
    IF v_amount = 0 THEN CONTINUE; END IF;
    IF v_account.nature = 'debit' THEN
      v_debit := v_debit + v_amount;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_id', v_account.id, 'debit', v_amount, 'credit', 0,
        'memo', 'Saldo inicial ' || v_account.code
      ));
    ELSE
      v_credit := v_credit + v_amount;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_id', v_account.id, 'debit', 0, 'credit', v_amount,
        'memo', 'Saldo inicial ' || v_account.code
      ));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'Ingresá al menos un saldo inicial distinto de cero'
      USING errcode = '22023';
  END IF;
  IF v_debit <> v_credit THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_capital_id,
      'debit', greatest(v_credit - v_debit, 0),
      'credit', greatest(v_debit - v_credit, 0),
      'memo', 'Patrimonio neto inicial calculado'
    ));
  END IF;
  IF jsonb_array_length(v_lines) < 2 THEN
    RAISE EXCEPTION 'La apertura debe tener una contrapartida' USING errcode = '22023';
  END IF;
  v_entry := public.dom_fn_registrar_asiento(
    p_persona_padre_id, v_year.start_date,
    'Apertura del ejercicio ' || v_year.year,
    v_lines, 'APERTURA-' || v_year.year
  );
  UPDATE public.dom_fiscal_years
  SET opening_entry_id = (v_entry->>'entry_id')::bigint, updated_at = now()
  WHERE id = p_fiscal_year_id AND persona_padre_id = p_persona_padre_id;
  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.dom_close_fiscal_year(
  p_persona_padre_id integer,
  p_fiscal_year_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_year public.dom_fiscal_years%ROWTYPE;
  v_result record;
  v_lines jsonb := '[]'::jsonb;
  v_net numeric(18,2);
  v_debit numeric(18,2) := 0;
  v_credit numeric(18,2) := 0;
  v_capital_id bigint;
  v_entry jsonb;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, p_persona_padre_id);
  SELECT * INTO v_year FROM public.dom_fiscal_years
  WHERE id = p_fiscal_year_id AND persona_padre_id = p_persona_padre_id FOR UPDATE;
  IF NOT FOUND OR v_year.status <> 'open' OR v_year.closing_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'El ejercicio ya está cerrado o no existe' USING errcode = '22023';
  END IF;
  IF v_year.end_date > (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN
    RAISE EXCEPTION 'El ejercicio todavía no finalizó' USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dom_fiscal_years
    WHERE persona_padre_id = p_persona_padre_id
      AND end_date < v_year.start_date AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Primero cerrá los ejercicios anteriores'
      USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dom_accounts a
    LEFT JOIN (
      SELECT l.account_id,
        sum(CASE WHEN a2.nature = 'debit' THEN l.debit - l.credit
                 ELSE l.credit - l.debit END) AS balance
      FROM public.dom_journal_lines l
      JOIN public.dom_accounts a2 ON a2.id = l.account_id
        AND a2.persona_padre_id = p_persona_padre_id
      WHERE l.persona_padre_id = p_persona_padre_id
      GROUP BY l.account_id
    ) ledger ON ledger.account_id = a.id
    WHERE a.persona_padre_id = p_persona_padre_id
      AND abs(a.current_balance - coalesce(ledger.balance, 0)) > 0.01
  ) THEN
    RAISE EXCEPTION 'Los saldos de cuentas no coinciden con el Libro Diario; conciliá antes de cerrar'
      USING errcode = '22023';
  END IF;
  SELECT id INTO v_capital_id FROM public.dom_accounts
  WHERE persona_padre_id = p_persona_padre_id AND code = '3.1.01.01'
    AND kind = 'equity' AND NOT is_archived;
  IF v_capital_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta de patrimonio neto' USING errcode = '22023';
  END IF;
  FOR v_result IN
    SELECT a.id, a.code, a.kind,
      sum(CASE WHEN a.kind = 'income' THEN l.credit - l.debit
               ELSE l.debit - l.credit END) AS balance
    FROM public.dom_journal_lines l
    JOIN public.dom_journal_entries e ON e.id = l.journal_entry_id
      AND e.persona_padre_id = p_persona_padre_id
    JOIN public.dom_accounts a ON a.id = l.account_id
      AND a.persona_padre_id = p_persona_padre_id
    WHERE l.persona_padre_id = p_persona_padre_id
      AND e.entry_date BETWEEN v_year.start_date AND v_year.end_date
      AND a.kind IN ('income', 'expense')
    GROUP BY a.id, a.code, a.kind
    ORDER BY a.id
  LOOP
    v_net := round(v_result.balance, 2);
    IF v_net = 0 THEN CONTINUE; END IF;
    IF (v_result.kind = 'income' AND v_net > 0) OR
       (v_result.kind = 'expense' AND v_net < 0) THEN
      v_debit := v_debit + abs(v_net);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_id', v_result.id, 'debit', abs(v_net), 'credit', 0,
        'memo', 'Cierre de ' || v_result.code
      ));
    ELSE
      v_credit := v_credit + abs(v_net);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_id', v_result.id, 'debit', 0, 'credit', abs(v_net),
        'memo', 'Cierre de ' || v_result.code
      ));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_lines) > 0 THEN
    IF v_debit <> v_credit THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_id', v_capital_id,
        'debit', greatest(v_credit - v_debit, 0),
        'credit', greatest(v_debit - v_credit, 0),
        'memo', 'Resultado del ejercicio ' || v_year.year
      ));
    END IF;
    v_entry := public.dom_fn_registrar_asiento(
      p_persona_padre_id, v_year.end_date,
      'Cierre del ejercicio ' || v_year.year,
      v_lines, 'REFUNDICION-' || v_year.year
    );
    UPDATE public.dom_fiscal_years
    SET status = 'closed', closing_entry_id = (v_entry->>'entry_id')::bigint,
        updated_at = now()
    WHERE id = p_fiscal_year_id AND persona_padre_id = p_persona_padre_id;
    RETURN v_entry;
  END IF;
  UPDATE public.dom_fiscal_years
  SET status = 'closed', updated_at = now()
  WHERE id = p_fiscal_year_id AND persona_padre_id = p_persona_padre_id;
  RETURN jsonb_build_object('success', true, 'entry_number', NULL,
    'message', 'Ejercicio sin resultados cerrado');
END;
$$;

CREATE OR REPLACE FUNCTION public.dom_validate_fiscal_year()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.start_date > NEW.end_date THEN
    RAISE EXCEPTION 'Fechas de ejercicio inválidas' USING errcode = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND
     (NEW.status <> 'open' OR NEW.opening_entry_id IS NOT NULL
      OR NEW.closing_entry_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Un ejercicio nuevo debe comenzar abierto y sin asientos de cierre'
      USING errcode = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(21452, NEW.persona_padre_id);
  IF EXISTS (
    SELECT 1 FROM public.dom_fiscal_years y
    WHERE y.persona_padre_id = NEW.persona_padre_id
      AND y.id IS DISTINCT FROM NEW.id
      AND daterange(y.start_date, y.end_date, '[]') &&
          daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'El período se superpone con otro ejercicio'
      USING errcode = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dom_fiscal_years_validate_period ON public.dom_fiscal_years;
CREATE TRIGGER dom_fiscal_years_validate_period
  BEFORE INSERT OR UPDATE OF start_date, end_date, persona_padre_id
  ON public.dom_fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.dom_validate_fiscal_year();

CREATE OR REPLACE FUNCTION public.dom_guard_account_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.persona_padre_id IS DISTINCT FROM OLD.persona_padre_id THEN
    RAISE EXCEPTION 'No se puede trasladar una cuenta entre hogares'
      USING errcode = '42501';
  END IF;
  IF (NEW.code IS DISTINCT FROM OLD.code OR
      NEW.kind IS DISTINCT FROM OLD.kind OR
      NEW.nature IS DISTINCT FROM OLD.nature) AND EXISTS (
    SELECT 1 FROM public.dom_journal_lines
    WHERE account_id = OLD.id AND persona_padre_id = OLD.persona_padre_id
  ) THEN
    RAISE EXCEPTION 'Una cuenta con movimientos no puede cambiar código, clase ni naturaleza'
      USING errcode = '22023';
  END IF;
  IF NEW.is_archived AND NOT OLD.is_archived AND abs(OLD.current_balance) > 0.01 THEN
    RAISE EXCEPTION 'Conciliá la cuenta antes de archivarla: tiene saldo pendiente'
      USING errcode = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dom_accounts_guard_metadata ON public.dom_accounts;
CREATE TRIGGER dom_accounts_guard_metadata
  BEFORE UPDATE ON public.dom_accounts
  FOR EACH ROW EXECUTE FUNCTION public.dom_guard_account_metadata();

REVOKE ALL ON FUNCTION public.dom_post_transaction(integer, uuid, integer, jsonb, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dom_void_transaction(integer, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dom_post_transaction(integer, uuid, integer, jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dom_void_transaction(integer, uuid, integer)
  TO authenticated;
REVOKE ALL ON FUNCTION public.dom_open_fiscal_year(integer, bigint, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dom_close_fiscal_year(integer, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dom_open_fiscal_year(integer, bigint, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dom_close_fiscal_year(integer, bigint)
  TO authenticated;
REVOKE ALL ON FUNCTION public.dom_fn_registrar_asiento(integer, date, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dom_fn_registrar_asiento(integer, date, text, jsonb, text)
  TO authenticated;

-- El cliente sólo lee estas tablas. Las escrituras se realizan por RPC autenticados.
REVOKE INSERT, UPDATE, DELETE ON public.dom_transactions,
  public.dom_journal_entries, public.dom_journal_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dom_transactions,
  public.dom_journal_entries, public.dom_journal_lines TO authenticated;
REVOKE UPDATE, DELETE ON public.dom_fiscal_years FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.dom_fiscal_years TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dom_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dom_accounts TO authenticated;
GRANT INSERT (persona_padre_id, code, name, kind, nature, subrubro, color)
  ON public.dom_accounts TO authenticated;
GRANT UPDATE (code, name, kind, nature, subrubro, color, is_archived, updated_at)
  ON public.dom_accounts TO authenticated;
