BEGIN;

DO $setup$
DECLARE
  demo record;
  demo_user_id uuid;
BEGIN
  FOR demo IN SELECT * FROM (VALUES
    ('admin.demo@agenor-domestic.com', 910014001),
    ('admin.demo2@agenor-domestic.com', 910014002)
  ) AS approved(email, home_id) LOOP
    SELECT u.id INTO STRICT demo_user_id
    FROM auth.users AS u
    WHERE lower(u.email) = demo.email
      AND u.email_confirmed_at IS NOT NULL
      AND nullif(u.encrypted_password, '') IS NOT NULL
      AND u.raw_app_meta_data->>'domestic_demo_ticket' = 'DOM-000015'
      AND EXISTS (SELECT 1 FROM auth.identities AS i WHERE i.user_id = u.id AND i.provider = 'email');

    INSERT INTO public.dom_access_grants (auth_user_id, email, persona_padre_id, login_method)
    VALUES (demo_user_id, demo.email, demo.home_id, 'demo_password')
    ON CONFLICT DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.dom_access_grants AS g
      WHERE g.auth_user_id = demo_user_id AND g.email = demo.email
        AND g.persona_padre_id = demo.home_id AND g.login_method = 'demo_password') THEN
      RAISE EXCEPTION 'Conflicting DEMO grant; no changes applied';
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.dom_ventures WHERE persona_padre_id = 910014002)
    OR EXISTS (SELECT 1 FROM public.dom_ventures WHERE persona_padre_id = 910014001
      AND (client_name, project_name) <> ('Cliente DEMO DOM-000014', 'Emprendimiento DEMO DOM-000014')) THEN
    RAISE EXCEPTION 'Unexpected venture in DEMO households; no changes applied';
  END IF;

  INSERT INTO public.dom_ventures (persona_padre_id, client_name, project_name)
  SELECT 910014001, 'Cliente DEMO DOM-000014', 'Emprendimiento DEMO DOM-000014'
  WHERE NOT EXISTS (SELECT 1 FROM public.dom_ventures WHERE persona_padre_id = 910014001);
END;
$setup$;

COMMIT;
