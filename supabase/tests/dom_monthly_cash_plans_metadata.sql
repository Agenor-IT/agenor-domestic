-- Authorized metadata-only QA. Caller supplies BEGIN and SET LOCAL domestic.qa_owner_email.
-- Uses an existing OAuth owner session as simulated claims. Does not create Auth records.
-- No inserts, updates or deletes of accounting transactions, journal entries, lines or balances.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT set_config('request.jwt.claim.sub',(
  SELECT id::text FROM auth.users WHERE lower(email)=lower(current_setting('domestic.qa_owner_email'))
),true);
SELECT set_config('request.jwt.claims',(
  SELECT jsonb_build_object('sub',u.id,'role','authenticated','session_id',s.id,'email',u.email)::text
  FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
  JOIN auth.mfa_amr_claims amr ON amr.session_id=s.id AND amr.authentication_method='oauth'
  WHERE lower(u.email)=lower(current_setting('domestic.qa_owner_email'))
  ORDER BY s.id LIMIT 1
),true);
SET LOCAL ROLE authenticated;

DO $qa$
DECLARE
  v_owner integer:=public.dom_current_persona_padre_id();
  v_card_id uuid:=gen_random_uuid(); v_plan_id uuid:=gen_random_uuid();
  v_card jsonb; v_changed_card jsonb; v_plan jsonb; v_snapshot jsonb;
  v_oid oid; v_table text;
BEGIN
  IF current_user<>'authenticated' OR v_owner IS NULL THEN
    RAISE EXCEPTION 'QA requires the existing authenticated OAuth owner context.';
  END IF;
  PERFORM set_config('domestic.qa_owner_persona',v_owner::text,true);
  v_card:=jsonb_build_object('id',v_card_id,'name','QA transaccional flujo mensual - rollback',
    'closingDay',25,'dueDay',10,'active',true);
  PERFORM public.dom_save_cash_card(v_owner,v_card);
  PERFORM public.dom_save_cash_card(v_owner,v_card);
  IF (SELECT count(*) FROM public.dom_cards WHERE id=v_card_id)<>1 THEN
    RAISE EXCEPTION 'QA card replay created duplicates.';
  END IF;

  v_changed_card:=v_card||jsonb_build_object('name','QA transaccional flujo mensual editada - rollback','closingDay',24,'active',false);
  PERFORM public.dom_save_cash_card(v_owner,v_changed_card||jsonb_build_object('expected',v_card));
  BEGIN
    PERFORM public.dom_save_cash_card(v_owner,v_changed_card||jsonb_build_object('name','QA stale','expected',v_card));
    RAISE EXCEPTION 'QA stale card update was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  PERFORM public.dom_save_cash_card(v_owner,v_changed_card||jsonb_build_object('active',true,'expected',v_changed_card));
  IF NOT EXISTS(SELECT 1 FROM public.dom_cards WHERE id=v_card_id AND closing_day=24 AND status='active') THEN
    RAISE EXCEPTION 'QA card correction/reactivation failed.';
  END IF;
  BEGIN
    PERFORM public.dom_save_cash_card(v_owner,v_card||jsonb_build_object('id',gen_random_uuid(),'closingDay',0));
    RAISE EXCEPTION 'QA invalid closing day was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  v_plan:=jsonb_build_object('id',v_plan_id,'cardId',v_card_id,'month','2026-11',
    'dueDate','2026-11-10','closingDate','2026-10-25','source','statement',
    'total',1000,'minimum',100,'planned',200,'plannedDate','2026-11-09','revision',0);
  PERFORM public.dom_save_card_cash_plan(v_owner,v_plan);
  PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('planned',70));
  BEGIN
    PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('planned',300));
    RAISE EXCEPTION 'QA stale plan update was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.dom_card_cash_plans WHERE id=v_plan_id AND planned=70 AND minimum=100 AND revision=1) THEN
    RAISE EXCEPTION 'QA partial payment was changed or stale edit overwrote it.';
  END IF;
  BEGIN
    PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('id',gen_random_uuid(),'month','2026-12','dueDate','2026-12-10','minimum',NULL));
    RAISE EXCEPTION 'QA real statement without minimum was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('id',gen_random_uuid(),'planned',1001));
    RAISE EXCEPTION 'QA overplanned amount was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('id',gen_random_uuid(),
    'source','estimate','month','2026-12','dueDate','2026-12-10','closingDate',NULL,'minimum',NULL,'planned',NULL,'plannedDate',NULL));
  PERFORM public.dom_save_card_cash_plan(v_owner,v_plan||jsonb_build_object('id',gen_random_uuid(),
    'source','estimate','month','2027-01','dueDate','2027-01-10','closingDate',NULL,'minimum',NULL,'planned',0,'plannedDate','2027-01-09'));
  v_snapshot:=public.dom_monthly_cash_snapshot(v_owner);
  IF v_snapshot->>'version'<>'monthly_cashflow_v1' OR NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_snapshot->'plans') p WHERE p->>'id'=v_plan_id::text AND (p->>'planned')::numeric=70
  ) OR NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_snapshot->'plans') p WHERE p->>'cardId'=v_card_id::text AND p->>'month'='2026-12'
      AND p->'minimum'='null'::jsonb AND p->'planned'='null'::jsonb
  ) OR NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_snapshot->'plans') p WHERE p->>'cardId'=v_card_id::text AND p->>'month'='2027-01'
      AND (p->>'planned')::numeric=0
  ) THEN RAISE EXCEPTION 'QA snapshot changed partial, unknown or explicit-zero plans.'; END IF;

  BEGIN
    UPDATE public.dom_card_cash_plans SET planned=777 WHERE id=v_plan_id;
    RAISE EXCEPTION 'QA direct client DML was allowed.' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.dom_monthly_cash_snapshot(v_owner+1);
    RAISE EXCEPTION 'QA foreign tenant read was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.dom_save_cash_card(v_owner+1,v_card||jsonb_build_object('id',gen_random_uuid()));
    RAISE EXCEPTION 'QA foreign tenant mutation was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.dom_allocate_card_cash_payment(v_owner,v_plan_id,gen_random_uuid(),1,0);
    RAISE EXCEPTION 'QA nonexistent financial payment was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  BEGIN
    PERFORM public.dom_schedule_cash_bill(v_owner,gen_random_uuid(),'2026-11-05'::date,NULL::bigint,NULL::date,0);
    RAISE EXCEPTION 'QA nonexistent financial invoice was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  FOR v_oid IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('dom_save_cash_card','dom_save_card_cash_plan','dom_allocate_card_cash_payment','dom_schedule_cash_bill','dom_monthly_cash_snapshot')
  LOOP
    IF has_function_privilege('anon',v_oid,'EXECUTE') OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'QA function ACL is incorrect.';
    END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['dom_card_cash_plans','dom_card_cash_payments','dom_cash_bill_schedule'] LOOP
    IF has_table_privilege('anon','public.'||v_table,'SELECT,INSERT,UPDATE,DELETE') OR
      has_table_privilege('authenticated','public.'||v_table,'INSERT,UPDATE,DELETE') OR
      NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||v_table)::regclass) THEN
      RAISE EXCEPTION 'QA table ACL/RLS is incorrect.';
    END IF;
  END LOOP;
END $qa$;

-- A nonexistent caller must neither see the owner's synthetic rows nor invoke its RPCs.
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','session_id',gen_random_uuid())::text,true);
DO $qa$
BEGIN
  IF EXISTS(SELECT 1 FROM public.dom_card_cash_plans) OR EXISTS(SELECT 1 FROM public.dom_card_cash_payments)
    OR EXISTS(SELECT 1 FROM public.dom_cash_bill_schedule) THEN RAISE EXCEPTION 'QA RLS leaked owner metadata.'; END IF;
  BEGIN
    PERFORM public.dom_monthly_cash_snapshot(current_setting('domestic.qa_owner_persona')::integer);
    RAISE EXCEPTION 'QA unknown caller RPC was accepted.' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $qa$;
ROLLBACK;
SELECT jsonb_build_object('metadata_validation','passed','transaction','rolled_back','financial_fixtures',false) as validation;
