import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import { createVoiceHandler } from './handler.ts';

// Auth is verified here even when the gateway uses verify_jwt=false for asymmetric JWTs.
Deno.serve(createVoiceHandler({
  env: name => Deno.env.get(name), fetch,
  authorize: async jwt => {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error } = await client.auth.getUser(jwt);
    if (error || !user) return null;
    const { data: personaPadreId, error: accessError } = await client.rpc('dom_current_persona_padre_id');
    if (accessError || !Number.isInteger(personaPadreId) || personaPadreId <= 0) return null;
    return { userId: user.id, personaPadreId };
  }
}));
