-- DOM-000006: one atomic write for a pending purchase, products and its reviewed due date.
CREATE FUNCTION public.dom_post_purchase_with_due_date(
  p_persona_padre_id integer,p_id uuid,p_expected_revision integer,
  p_transaction jsonb,p_lines jsonb,p_purchase_items jsonb,
  p_due_date date,p_expected_schedule_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_tx public.dom_transactions%ROWTYPE;
  v_schedule public.dom_cash_bill_schedule%ROWTYPE;
  v_expected integer:=0; v_result jsonb; v_revision integer; v_schedule_revision integer:=0;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452,p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(32626,p_persona_padre_id);
  IF coalesce(p_transaction->>'operation_type','')<>'compra' OR
     coalesce(p_transaction->>'direction','')<>'expense' OR
     coalesce(p_transaction->>'payment_condition','')<>'cta_cte' OR
     p_expected_schedule_revision IS NULL OR p_expected_schedule_revision<0 OR
     (p_due_date IS NOT NULL AND (NOT pg_catalog.isfinite(p_due_date) OR
       p_due_date<'0001-01-01'::date OR p_due_date>'9999-12-31'::date)) THEN
    RAISE EXCEPTION 'Revisá el vencimiento de la factura pendiente.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_tx FROM public.dom_transactions
    WHERE persona_padre_id=p_persona_padre_id AND id=p_id FOR UPDATE;
  SELECT * INTO v_schedule FROM public.dom_cash_bill_schedule
    WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_id FOR UPDATE;
  IF v_schedule.transaction_revision=v_tx.revision THEN v_expected:=v_schedule.revision; END IF;
  -- Permit an identical retry after a lost response, without overwriting later planning edits.
  IF p_expected_schedule_revision<>v_expected AND NOT coalesce((
    v_tx.revision=p_expected_revision+1 AND v_schedule.transaction_revision=v_tx.revision AND
    v_schedule.due_date IS NOT DISTINCT FROM p_due_date
  ),false) THEN
    RAISE EXCEPTION 'El vencimiento cambió. Actualizá antes de guardar.' USING ERRCODE='40001';
  END IF;
  -- Include the reviewed date in the existing idempotency fingerprint.
  v_result:=public.dom_post_purchase_transaction(p_persona_padre_id,p_id,p_expected_revision,
    p_transaction||jsonb_build_object('bill_due_date',p_due_date),p_lines,p_purchase_items);
  v_revision:=(v_result->>'revision')::integer;
  IF (v_result->>'success')::boolean IS DISTINCT FROM true OR v_revision IS NULL THEN
    RAISE EXCEPTION 'No se registró la factura.';
  END IF;
  IF coalesce((v_result->>'replayed')::boolean,false) AND
     v_schedule.transaction_revision=v_revision AND v_schedule.due_date IS NOT DISTINCT FROM p_due_date THEN
    v_schedule_revision:=v_schedule.revision;
  ELSIF p_due_date IS NULL THEN
    -- Only planning metadata is removed on an explicit clear; accounting history is preserved.
    DELETE FROM public.dom_cash_bill_schedule
      WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_id;
  ELSE
    PERFORM public.dom_schedule_cash_bill(p_persona_padre_id,p_id,p_due_date,NULL::bigint,NULL::date,
      CASE WHEN v_schedule.transaction_revision=v_revision THEN v_schedule.revision ELSE 0 END);
    SELECT revision INTO STRICT v_schedule_revision FROM public.dom_cash_bill_schedule
      WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_id;
  END IF;
  RETURN v_result||jsonb_build_object('contract_version','purchase_due_date_v1',
    'bill_due_date',p_due_date,'bill_schedule_revision',v_schedule_revision);
END $$;
REVOKE ALL ON FUNCTION public.dom_post_purchase_with_due_date(integer,uuid,integer,jsonb,jsonb,jsonb,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dom_post_purchase_with_due_date(integer,uuid,integer,jsonb,jsonb,jsonb,date,integer) TO authenticated;
