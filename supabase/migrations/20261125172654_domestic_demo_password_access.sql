BEGIN;

ALTER TABLE public.dom_access_grants
  ADD COLUMN login_method text NOT NULL DEFAULT 'google',
  ADD CONSTRAINT dom_access_grants_login_method_check CHECK (
    login_method = 'google'
    OR (
      login_method = 'demo_password'
      AND (email, persona_padre_id) IN (
        ('admin.demo@agenor-domestic.com', 910014001),
        ('admin.demo2@agenor-domestic.com', 910014002)
      )
    )
  );

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
      WHERE i.user_id = u.id
        AND i.provider = CASE g.login_method WHEN 'demo_password' THEN 'email' ELSE 'google' END
    )
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS s
      JOIN auth.mfa_amr_claims AS amr ON amr.session_id = s.id
      WHERE s.id = nullif(auth.jwt()->>'session_id', '')::uuid
        AND s.user_id = u.id
        AND amr.authentication_method = CASE g.login_method WHEN 'demo_password' THEN 'password' ELSE 'oauth' END
    )
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.dom_current_persona_padre_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dom_current_persona_padre_id() TO authenticated;
COMMIT;
