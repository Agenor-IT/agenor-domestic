import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bjzvdgrtcveydpakgdkt.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqenZkZ3J0Y3ZleWRwYWtnZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDkwNTYsImV4cCI6MjA3NTQ4NTA1Nn0.tC_CCzNicwny-ZCYS2i3hemHVf0PjUSVRMePADtsRHo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
