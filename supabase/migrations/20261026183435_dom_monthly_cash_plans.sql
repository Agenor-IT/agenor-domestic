-- LOCAL PREPARATION ONLY. Requires explicit production approval.
-- Planning metadata; never posts, modifies or voids an accounting transaction.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS dom_cards_cashflow_owner_key ON public.dom_cards(persona_padre_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS dom_transactions_cashflow_owner_key ON public.dom_transactions(persona_padre_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS dom_expenses_cashflow_owner_key ON public.dom_expenses(persona_padre_id,id);

CREATE TABLE public.dom_card_cash_plans (
  id uuid PRIMARY KEY, persona_padre_id integer NOT NULL,
  card_id uuid NOT NULL, month date NOT NULL, due_date date NOT NULL, closing_date date,
  source text NOT NULL CHECK (source IN ('statement','estimate')),
  total numeric(14,2) NOT NULL CHECK (total>=0), minimum numeric(14,2),
  planned numeric(14,2), planned_date date, revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  UNIQUE(persona_padre_id,id), UNIQUE(persona_padre_id,card_id,month),
  FOREIGN KEY(persona_padre_id,card_id) REFERENCES public.dom_cards(persona_padre_id,id),
  CHECK (extract(day FROM month)=1 AND date_trunc('month',due_date)::date=month),
  CHECK (minimum IS NULL OR (minimum>=0 AND minimum<=total)),
  CHECK (source<>'statement' OR minimum IS NOT NULL),
  CHECK (source<>'statement' OR closing_date IS NOT NULL),
  CHECK (closing_date IS NULL OR closing_date<=due_date),
  CHECK (planned_date IS NULL OR closing_date IS NULL OR planned_date>=closing_date),
  CHECK ((planned IS NULL AND planned_date IS NULL) OR (planned IS NOT NULL AND planned>=0 AND planned<=total AND planned_date IS NOT NULL))
);
CREATE TABLE public.dom_card_cash_payments (
  persona_padre_id integer NOT NULL, plan_id uuid NOT NULL, transaction_id uuid NOT NULL,
  transaction_revision integer NOT NULL, amount numeric(14,2) NOT NULL CHECK (amount>0),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  PRIMARY KEY(persona_padre_id,plan_id,transaction_id),
  FOREIGN KEY(persona_padre_id,plan_id) REFERENCES public.dom_card_cash_plans(persona_padre_id,id),
  FOREIGN KEY(persona_padre_id,transaction_id) REFERENCES public.dom_transactions(persona_padre_id,id)
);
CREATE INDEX dom_card_cash_payments_transaction ON public.dom_card_cash_payments(persona_padre_id,transaction_id);
CREATE TABLE public.dom_cash_bill_schedule (
  persona_padre_id integer NOT NULL, transaction_id uuid NOT NULL,
  transaction_revision integer NOT NULL, due_date date NOT NULL,
  expense_id bigint, budget_month date, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  PRIMARY KEY(persona_padre_id,transaction_id),
  FOREIGN KEY(persona_padre_id,transaction_id) REFERENCES public.dom_transactions(persona_padre_id,id),
  FOREIGN KEY(persona_padre_id,expense_id) REFERENCES public.dom_expenses(persona_padre_id,id),
  CHECK ((expense_id IS NULL AND budget_month IS NULL) OR (expense_id IS NOT NULL AND budget_month IS NOT NULL AND extract(day FROM budget_month)=1))
);
CREATE INDEX dom_cash_bill_schedule_due ON public.dom_cash_bill_schedule(persona_padre_id,due_date);

ALTER TABLE public.dom_card_cash_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dom_card_cash_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dom_cash_bill_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY dom_card_cash_plans_owner_read ON public.dom_card_cash_plans FOR SELECT TO authenticated
  USING(persona_padre_id=(SELECT public.dom_current_persona_padre_id()));
CREATE POLICY dom_card_cash_payments_owner_read ON public.dom_card_cash_payments FOR SELECT TO authenticated
  USING(persona_padre_id=(SELECT public.dom_current_persona_padre_id()));
CREATE POLICY dom_cash_bill_schedule_owner_read ON public.dom_cash_bill_schedule FOR SELECT TO authenticated
  USING(persona_padre_id=(SELECT public.dom_current_persona_padre_id()));
REVOKE ALL ON public.dom_card_cash_plans,public.dom_card_cash_payments,public.dom_cash_bill_schedule FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dom_card_cash_plans,public.dom_card_cash_payments,public.dom_cash_bill_schedule TO authenticated;

CREATE FUNCTION public.dom_save_cash_card(p_persona_padre_id integer,p_card jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=(p_card->>'id')::uuid; v_name text:=btrim(p_card->>'name');
  v_closing integer:=(p_card->>'closingDay')::integer; v_due integer:=(p_card->>'dueDay')::integer;
  v_status text:=CASE WHEN coalesce((p_card->>'active')::boolean,true) THEN 'active' ELSE 'inactive' END;
  v_existing public.dom_cards%ROWTYPE;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(32626,p_persona_padre_id);
  IF v_id IS NULL OR v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80 OR
    v_closing IS NULL OR v_closing NOT BETWEEN 1 AND 31 OR v_due IS NULL OR v_due NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Revisá nombre, cierre y vencimiento de la tarjeta.';
  END IF;
  SELECT * INTO v_existing FROM public.dom_cards WHERE id=v_id AND persona_padre_id=p_persona_padre_id FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.name=v_name AND v_existing.closing_day=v_closing AND v_existing.due_day=v_due AND v_existing.status=v_status THEN RETURN; END IF;
    IF (p_card->'expected'->>'name') IS DISTINCT FROM v_existing.name
      OR (p_card->'expected'->>'closingDay')::integer IS DISTINCT FROM v_existing.closing_day
      OR (p_card->'expected'->>'dueDay')::integer IS DISTINCT FROM v_existing.due_day
      OR coalesce((p_card->'expected'->>'active')::boolean,true) IS DISTINCT FROM (v_existing.status='active') THEN
      RAISE EXCEPTION 'La tarjeta cambió. Actualizá antes de guardar.';
    END IF;
    UPDATE public.dom_cards SET name=v_name,closing_day=v_closing,due_day=v_due,status=v_status
      WHERE id=v_id AND persona_padre_id=p_persona_padre_id;
    RETURN;
  END IF;
  INSERT INTO public.dom_cards(id,persona_padre_id,name,closing_day,due_day,status)
    VALUES(v_id,p_persona_padre_id,v_name,v_closing,v_due,v_status);
END $$;

CREATE FUNCTION public.dom_save_card_cash_plan(p_persona_padre_id integer,p_plan jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=(p_plan->>'id')::uuid; v_card uuid:=(p_plan->>'cardId')::uuid;
  v_expected integer:=(p_plan->>'revision')::integer; v_existing public.dom_card_cash_plans%ROWTYPE;
  v_total numeric:=(p_plan->>'total')::numeric; v_min numeric:=(p_plan->>'minimum')::numeric;
  v_planned numeric:=(p_plan->>'planned')::numeric; v_paid numeric;
  v_month date:=((p_plan->>'month')||'-01')::date; v_due date:=(p_plan->>'dueDate')::date;
  v_date date:=(p_plan->>'plannedDate')::date; v_source text:=p_plan->>'source'; v_closing date:=(p_plan->>'closingDate')::date;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(32626,p_persona_padre_id);
  IF v_id IS NULL OR v_expected IS NULL OR v_expected<0 OR v_total IS NULL OR v_total<0 OR v_total>999999999999.99
    OR v_total<>round(v_total,2) OR (v_min IS NOT NULL AND (v_min<0 OR v_min>v_total OR v_min<>round(v_min,2)))
    OR (v_planned IS NOT NULL AND (v_planned<0 OR v_planned>v_total OR v_planned<>round(v_planned,2)))
    OR NOT EXISTS(SELECT 1 FROM public.dom_cards WHERE id=v_card AND persona_padre_id=p_persona_padre_id) THEN
    RAISE EXCEPTION 'Tarjeta o importes inválidos.';
  END IF;
  SELECT * INTO v_existing FROM public.dom_card_cash_plans WHERE persona_padre_id=p_persona_padre_id AND id=v_id FOR UPDATE;
  IF FOUND AND v_existing.revision<>v_expected THEN RAISE EXCEPTION 'El plan cambió. Actualizá antes de guardar.'; END IF;
  IF v_existing.id IS NULL AND v_expected<>0 THEN RAISE EXCEPTION 'El plan ya no está disponible.'; END IF;
  SELECT coalesce(sum(a.amount),0) INTO v_paid FROM public.dom_card_cash_payments a
    JOIN public.dom_transactions t ON t.id=a.transaction_id AND t.persona_padre_id=a.persona_padre_id
    WHERE a.persona_padre_id=p_persona_padre_id AND a.plan_id=v_id AND t.status='confirmed'
      AND t.revision=a.transaction_revision AND t.journal_entry_id IS NOT NULL AND t.operation_type='pago_tarjeta';
  IF v_total<v_paid THEN RAISE EXCEPTION 'El total no puede ser menor que los pagos vinculados.'; END IF;
  IF v_closing IS NOT NULL AND EXISTS(SELECT 1 FROM public.dom_card_cash_payments a
    JOIN public.dom_transactions t ON t.id=a.transaction_id AND t.persona_padre_id=a.persona_padre_id
    WHERE a.persona_padre_id=p_persona_padre_id AND a.plan_id=v_id AND t.status='confirmed'
      AND t.revision=a.transaction_revision AND t.journal_entry_id IS NOT NULL AND t.occurred_on<v_closing) THEN
    RAISE EXCEPTION 'Hay pagos vinculados anteriores al cierre indicado. Revisá los vínculos.';
  END IF;
  IF v_existing.id IS NULL THEN
    INSERT INTO public.dom_card_cash_plans(id,persona_padre_id,card_id,month,due_date,closing_date,source,total,minimum,planned,planned_date)
      VALUES(v_id,p_persona_padre_id,v_card,v_month,v_due,v_closing,v_source,v_total,v_min,v_planned,v_date);
  ELSE
    IF v_paid>0 AND (v_existing.card_id<>v_card OR v_existing.month<>v_month) THEN RAISE EXCEPTION 'Quitá los vínculos de pagos antes de cambiar tarjeta o mes.'; END IF;
    UPDATE public.dom_card_cash_plans SET card_id=v_card,month=v_month,due_date=v_due,closing_date=v_closing,source=v_source,total=v_total,minimum=v_min,
      planned=v_planned,planned_date=v_date,revision=revision+1 WHERE id=v_id AND persona_padre_id=p_persona_padre_id;
  END IF;
END $$;

CREATE FUNCTION public.dom_allocate_card_cash_payment(p_persona_padre_id integer,p_plan_id uuid,p_transaction_id uuid,p_amount numeric,p_expected_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tx public.dom_transactions%ROWTYPE; v_plan public.dom_card_cash_plans%ROWTYPE;
  v_existing public.dom_card_cash_payments%ROWTYPE; v_other numeric; v_plan_paid numeric;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(32626,p_persona_padre_id);
  SELECT * INTO v_tx FROM public.dom_transactions WHERE id=p_transaction_id AND persona_padre_id=p_persona_padre_id FOR UPDATE;
  IF v_tx.id IS NULL OR v_tx.status<>'confirmed' OR v_tx.journal_entry_id IS NULL OR v_tx.operation_type<>'pago_tarjeta' THEN
    RAISE EXCEPTION 'Elegí un pago de tarjeta confirmado del mismo titular.';
  END IF;
  SELECT * INTO v_plan FROM public.dom_card_cash_plans WHERE id=p_plan_id AND persona_padre_id=p_persona_padre_id;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Resumen no disponible.'; END IF;
  IF v_plan.closing_date IS NOT NULL AND v_tx.occurred_on<v_plan.closing_date AND p_amount>0 THEN
    RAISE EXCEPTION 'El pago es anterior al cierre. Revisá si ya está descontado del total del resumen.';
  END IF;
  SELECT * INTO v_existing FROM public.dom_card_cash_payments
    WHERE persona_padre_id=p_persona_padre_id AND plan_id=p_plan_id AND transaction_id=p_transaction_id FOR UPDATE;
  IF p_amount=0 AND v_existing.transaction_id IS NULL THEN RETURN; END IF;
  IF v_existing.transaction_revision=v_tx.revision AND v_existing.amount=p_amount THEN RETURN; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<>(CASE WHEN v_existing.transaction_revision=v_tx.revision THEN v_existing.revision ELSE 0 END) THEN
    RAISE EXCEPTION 'El vínculo cambió. Actualizá antes de guardar.';
  END IF;
  IF p_amount IS NULL OR p_amount<0 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Importe inválido.'; END IF;
  IF p_amount=0 THEN
    DELETE FROM public.dom_card_cash_payments WHERE persona_padre_id=p_persona_padre_id AND plan_id=p_plan_id AND transaction_id=p_transaction_id;
    RETURN;
  END IF;
  SELECT coalesce(sum(amount),0) INTO v_other FROM public.dom_card_cash_payments
    WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_transaction_id
      AND transaction_revision=v_tx.revision AND plan_id<>p_plan_id;
  SELECT coalesce(sum(a.amount),0) INTO v_plan_paid FROM public.dom_card_cash_payments a
    JOIN public.dom_transactions t ON t.id=a.transaction_id AND t.persona_padre_id=a.persona_padre_id
    WHERE a.persona_padre_id=p_persona_padre_id AND a.plan_id=p_plan_id AND a.transaction_id<>p_transaction_id
      AND t.status='confirmed' AND t.revision=a.transaction_revision AND t.journal_entry_id IS NOT NULL AND t.operation_type='pago_tarjeta';
  IF v_other+p_amount>v_tx.amount OR v_plan_paid+p_amount>v_plan.total THEN
    RAISE EXCEPTION 'El importe supera el pago disponible o el saldo del resumen.';
  END IF;
  INSERT INTO public.dom_card_cash_payments(persona_padre_id,plan_id,transaction_id,transaction_revision,amount)
    VALUES(p_persona_padre_id,p_plan_id,p_transaction_id,v_tx.revision,p_amount)
    ON CONFLICT(persona_padre_id,plan_id,transaction_id) DO UPDATE SET
      amount=excluded.amount,transaction_revision=excluded.transaction_revision,revision=dom_card_cash_payments.revision+1;
END $$;

CREATE FUNCTION public.dom_schedule_cash_bill(p_persona_padre_id integer,p_transaction_id uuid,p_due_date date,p_expense_id bigint,p_budget_month date,p_expected_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tx public.dom_transactions%ROWTYPE; v_existing public.dom_cash_bill_schedule%ROWTYPE;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(32626,p_persona_padre_id);
  SELECT * INTO v_tx FROM public.dom_transactions WHERE id=p_transaction_id AND persona_padre_id=p_persona_padre_id;
  IF v_tx.id IS NULL OR v_tx.status<>'confirmed' OR v_tx.journal_entry_id IS NULL OR v_tx.payment_condition<>'cta_cte'
    OR v_tx.direction<>'expense' OR v_tx.operation_type NOT IN ('compra','alquiler_perdido') THEN
    RAISE EXCEPTION 'Elegí una factura pendiente confirmada del mismo titular.';
  END IF;
  IF p_due_date IS NULL OR (p_expense_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.dom_expenses WHERE id=p_expense_id AND persona_padre_id=p_persona_padre_id)) THEN
    RAISE EXCEPTION 'Vencimiento o gasto fijo inválidos.';
  END IF;
  SELECT * INTO v_existing FROM public.dom_cash_bill_schedule WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_transaction_id FOR UPDATE;
  IF v_existing.transaction_revision=v_tx.revision AND v_existing.due_date=p_due_date
    AND v_existing.expense_id IS NOT DISTINCT FROM p_expense_id AND v_existing.budget_month IS NOT DISTINCT FROM p_budget_month THEN RETURN; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<>(CASE WHEN v_existing.transaction_revision=v_tx.revision THEN v_existing.revision ELSE 0 END) THEN
    RAISE EXCEPTION 'El vencimiento cambió. Actualizá antes de guardar.';
  END IF;
  INSERT INTO public.dom_cash_bill_schedule(persona_padre_id,transaction_id,transaction_revision,due_date,expense_id,budget_month)
    VALUES(p_persona_padre_id,p_transaction_id,v_tx.revision,p_due_date,p_expense_id,p_budget_month)
    ON CONFLICT(persona_padre_id,transaction_id) DO UPDATE SET transaction_revision=excluded.transaction_revision,
      due_date=excluded.due_date,expense_id=excluded.expense_id,budget_month=excluded.budget_month,revision=dom_cash_bill_schedule.revision+1;
END $$;

CREATE FUNCTION public.dom_monthly_cash_snapshot(p_persona_padre_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  RETURN jsonb_build_object('version','monthly_cashflow_v1',
    'cards',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'closingDay',c.closing_day,'dueDay',c.due_day,'active',c.status='active') ORDER BY c.name)
      FROM public.dom_cards c WHERE c.persona_padre_id=p_persona_padre_id),'[]'::jsonb),
    'plans',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'cardId',p.card_id,'month',to_char(p.month,'YYYY-MM'),
      'dueDate',p.due_date,'closingDate',p.closing_date,'source',p.source,'total',p.total,'minimum',p.minimum,'planned',p.planned,
      'plannedDate',p.planned_date,'revision',p.revision) ORDER BY p.due_date,p.id)
      FROM public.dom_card_cash_plans p WHERE p.persona_padre_id=p_persona_padre_id),'[]'::jsonb),
    'payments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'amount',t.amount,'date',t.occurred_on,'description',t.description,
      'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('planId',a.plan_id,'amount',a.amount,'revision',a.revision))
        FROM public.dom_card_cash_payments a WHERE a.persona_padre_id=p_persona_padre_id AND a.transaction_id=t.id AND a.transaction_revision=t.revision),'[]'::jsonb)) ORDER BY t.occurred_on,t.id)
      FROM public.dom_transactions t WHERE t.persona_padre_id=p_persona_padre_id AND t.operation_type='pago_tarjeta'
        AND t.status='confirmed' AND t.journal_entry_id IS NOT NULL),'[]'::jsonb),
    'bills',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'description',t.description,'amount',t.amount,'date',t.occurred_on,
      'dueDate',s.due_date,'expenseId',s.expense_id::text,'budgetMonth',to_char(s.budget_month,'YYYY-MM'),
      'scheduleRevision',coalesce(s.revision,0),
      'payments',coalesce((SELECT jsonb_agg(jsonb_build_object('amount',pay.amount,'date',pay.occurred_on))
        FROM public.dom_transactions pay WHERE pay.persona_padre_id=p_persona_padre_id AND pay.settles_transaction_id=t.id
          AND pay.status='confirmed' AND pay.journal_entry_id IS NOT NULL AND pay.operation_type='pago'),'[]'::jsonb)) ORDER BY t.occurred_on,t.id)
      FROM public.dom_transactions t LEFT JOIN public.dom_cash_bill_schedule s ON s.transaction_id=t.id
        AND s.persona_padre_id=t.persona_padre_id AND s.transaction_revision=t.revision
      WHERE t.persona_padre_id=p_persona_padre_id AND t.status='confirmed' AND t.journal_entry_id IS NOT NULL
        AND t.direction='expense' AND t.payment_condition='cta_cte' AND t.operation_type IN ('compra','alquiler_perdido')),'[]'::jsonb),
    'expenses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id::text,'personaPadreId',e.persona_padre_id,
      'supplierName',e.supplier_name,'concept',e.concept,'category',e.category,'status',e.status,'expenseType',e.expense_type,
      'baseMonthlyAmount',e.base_monthly_amount,'monthlyProjections',coalesce(e.monthly_projections,'{}'::jsonb),
      'defaultPaymentMethod',e.default_payment_method)) FROM public.dom_expenses e WHERE e.persona_padre_id=p_persona_padre_id),'[]'::jsonb),
    'legacyReceipts',(SELECT count(*) FROM public.dom_expense_receipts WHERE persona_padre_id=p_persona_padre_id AND payment_condition='cuenta_corriente')
  );
END $$;

REVOKE ALL ON FUNCTION public.dom_save_cash_card(integer,jsonb), public.dom_save_card_cash_plan(integer,jsonb),
  public.dom_allocate_card_cash_payment(integer,uuid,uuid,numeric,integer), public.dom_schedule_cash_bill(integer,uuid,date,bigint,date,integer),
  public.dom_monthly_cash_snapshot(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dom_save_cash_card(integer,jsonb), public.dom_save_card_cash_plan(integer,jsonb),
  public.dom_allocate_card_cash_payment(integer,uuid,uuid,numeric,integer), public.dom_schedule_cash_bill(integer,uuid,date,bigint,date,integer),
  public.dom_monthly_cash_snapshot(integer) TO authenticated;
COMMIT;
