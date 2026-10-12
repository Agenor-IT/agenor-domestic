-- Retira exclusivamente el módulo de prioridades de pago de Domestic.
-- Respaldo restaurable: agenor-domestic-release-20261011-backup.json (fuera del repositorio).
-- Se detiene si los datos cambiaron desde el respaldo.
DO $$
DECLARE
  current_hash text;
BEGIN
  EXECUTE 'LOCK TABLE public.dom_payment_priorities IN ACCESS EXCLUSIVE MODE';

  SELECT md5((jsonb_agg(to_jsonb(p) ORDER BY p.priority_order))::text)
    INTO current_hash
    FROM public.dom_payment_priorities AS p;

  IF current_hash IS DISTINCT FROM '8de03054eb5d2dfce35931ceb92b837c' THEN
    RAISE EXCEPTION 'dom_payment_priorities changed after backup; aborting removal';
  END IF;

  EXECUTE 'DROP TABLE public.dom_payment_priorities';
END
$$;
