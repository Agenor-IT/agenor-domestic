-- DOM-000006. Caller supplies BEGIN and SET LOCAL domestic.qa_owner_email.
-- Synthetic owner-scoped QA only. Always ROLLBACK; no Auth or permission changes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $claims$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object('sub',u.id,'role','authenticated','session_id',s.id,'email',u.email)
    INTO STRICT v FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
    JOIN auth.mfa_amr_claims a ON a.session_id=s.id AND a.authentication_method='oauth'
    WHERE lower(u.email)=lower(current_setting('domestic.qa_owner_email')) ORDER BY s.id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v->>'sub',true);
  PERFORM set_config('request.jwt.claims',v::text,true);
END $claims$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
  v_owner integer:=public.dom_current_persona_padre_id(); v_id uuid:=gen_random_uuid(); v_bad uuid:=gen_random_uuid();
  v_expense bigint; v_payables bigint; v_expense_before numeric; v_payables_before numeric;
  v_tx jsonb; v_lines jsonb; v_result jsonb; v_rejected boolean; v_message text; v_entries bigint;
BEGIN
  IF current_user<>'authenticated' OR v_owner IS NULL THEN RAISE EXCEPTION 'QA owner unavailable'; END IF;
  SELECT id,current_balance INTO STRICT v_expense,v_expense_before FROM public.dom_accounts
    WHERE persona_padre_id=v_owner AND code='5.1.01.02' AND NOT is_archived;
  SELECT id,current_balance INTO STRICT v_payables,v_payables_before FROM public.dom_accounts
    WHERE persona_padre_id=v_owner AND code='2.1.01.01' AND NOT is_archived;
  v_tx:=jsonb_build_object('direction','expense','amount',100,'description','QA DOM-000006 - rollback',
    'occurred_on','2026-10-26','payment_method','cta_cte','payment_method_kind','cash','payment_account_id',NULL,
    'op_number','QA-DOM-000006-'||v_id::text,'counterparty','QA ficticio','operation_type','compra',
    'payment_condition','cta_cte','settles_transaction_id',NULL,'classification_account_id',v_expense);
  v_lines:=jsonb_build_array(jsonb_build_object('account_id',v_expense,'debit',100,'credit',0,'memo','QA'),
    jsonb_build_object('account_id',v_payables,'debit',0,'credit',100,'memo','QA'));
  v_result:=public.dom_post_purchase_with_due_date(v_owner,v_id,0,v_tx,v_lines,'[]'::jsonb,'2026-10-27',0);
  IF v_result->>'contract_version'<>'purchase_due_date_v1' OR v_result->>'bill_due_date'<>'2026-10-27' OR
    NOT EXISTS(SELECT 1 FROM public.dom_cash_bill_schedule WHERE persona_padre_id=v_owner AND transaction_id=v_id
      AND transaction_revision=(v_result->>'revision')::integer AND due_date='2026-10-27') THEN
    RAISE EXCEPTION 'QA atomic invoice/schedule failed';
  END IF;
  SELECT count(*) INTO v_entries FROM public.dom_journal_entries WHERE persona_padre_id=v_owner AND source_transaction_id=v_id;
  v_result:=public.dom_post_purchase_with_due_date(v_owner,v_id,0,v_tx,v_lines,'[]'::jsonb,'2026-10-27',0);
  IF v_result->>'replayed'<>'true' OR (SELECT count(*) FROM public.dom_journal_entries
    WHERE persona_padre_id=v_owner AND source_transaction_id=v_id)<>v_entries THEN RAISE EXCEPTION 'QA replay duplicated accounting'; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.dom_post_purchase_with_due_date(v_owner,v_bad,0,v_tx||jsonb_build_object('op_number','QA-DOM-000006-BAD-'||v_bad::text),v_lines,
      '[{"rawName":"","name":"QA invalid","presentation":"unidad","unit":"unidad","kind":"consumable","quantity":1,"lineTotal":100}]'::jsonb,'2026-10-27',0);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message<>'Renglón de compra inválido' THEN RAISE; END IF;
    v_rejected:=true;
  END;
  IF NOT v_rejected OR EXISTS(SELECT 1 FROM public.dom_transactions WHERE persona_padre_id=v_owner AND id=v_bad)
    OR EXISTS(SELECT 1 FROM public.dom_journal_entries WHERE persona_padre_id=v_owner AND source_transaction_id=v_bad)
    OR EXISTS(SELECT 1 FROM public.dom_cash_bill_schedule WHERE persona_padre_id=v_owner AND transaction_id=v_bad) THEN
    RAISE EXCEPTION 'QA failed invoice left partial effects';
  END IF;

  PERFORM public.dom_schedule_cash_bill(v_owner,v_id,'2026-11-10',NULL::bigint,NULL::date,0);
  v_rejected:=false;
  BEGIN
    PERFORM public.dom_post_purchase_with_due_date(v_owner,v_id,1,v_tx,v_lines,'[]'::jsonb,'2026-10-27',0);
  EXCEPTION WHEN serialization_failure THEN v_rejected:=true;
  END;
  IF NOT v_rejected OR (SELECT revision FROM public.dom_transactions WHERE persona_padre_id=v_owner AND id=v_id)<>1 THEN
    RAISE EXCEPTION 'QA stale schedule overwrote newer planning';
  END IF;
  v_result:=public.dom_post_purchase_with_due_date(v_owner,v_id,1,v_tx,v_lines,'[]'::jsonb,'2026-11-11',1);
  IF NOT EXISTS(SELECT 1 FROM public.dom_cash_bill_schedule WHERE persona_padre_id=v_owner AND transaction_id=v_id
    AND transaction_revision=(v_result->>'revision')::integer AND due_date='2026-11-11') THEN RAISE EXCEPTION 'QA reviewed edit failed'; END IF;
  v_result:=public.dom_post_purchase_with_due_date(v_owner,v_id,(v_result->>'revision')::integer,v_tx,v_lines,'[]'::jsonb,NULL,
    (v_result->>'bill_schedule_revision')::integer);
  IF EXISTS(SELECT 1 FROM public.dom_cash_bill_schedule WHERE persona_padre_id=v_owner AND transaction_id=v_id) THEN
    RAISE EXCEPTION 'QA explicit date clear failed';
  END IF;
  PERFORM public.dom_void_transaction(v_owner,v_id,(v_result->>'revision')::integer);
  IF (SELECT current_balance FROM public.dom_accounts WHERE id=v_expense AND persona_padre_id=v_owner) IS DISTINCT FROM v_expense_before
    OR (SELECT current_balance FROM public.dom_accounts WHERE id=v_payables AND persona_padre_id=v_owner) IS DISTINCT FROM v_payables_before THEN
    RAISE EXCEPTION 'QA reversal did not restore balances';
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.dom_post_purchase_with_due_date(v_owner,gen_random_uuid(),0,v_tx,v_lines,'[]'::jsonb,'2026-10-27',1);
  EXCEPTION WHEN serialization_failure THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'QA invalid initial schedule revision accepted'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.dom_post_purchase_with_due_date(v_owner+1,gen_random_uuid(),0,v_tx,v_lines,'[]'::jsonb,'2026-10-27',0);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'QA foreign tenant write accepted'; END IF;
  PERFORM set_config('domestic.qa_due_date','passed',true);
END $qa$;
SELECT current_setting('domestic.qa_due_date') AS atomic_due_date_replay_revision_clear_isolation;
ROLLBACK;
