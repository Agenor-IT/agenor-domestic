import React, { createContext, useContext, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarDays, Clipboard, Eye, EyeOff, Landmark, LockKeyhole, LogIn, Mail, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '../../infrastructure/supabaseClient';

interface DomesticAccess {
  email: string;
  personaPadreId: number;
  signOut: () => Promise<void>;
}

type GateState =
  | { status: 'checking' | 'signed-out' | 'error'; message?: string }
  | { status: 'denied'; email: string }
  | { status: 'authorized'; email: string; personaPadreId: number };

const DomesticAccessContext = createContext<DomesticAccess | null>(null);

const loginInputClass = 'h-14 w-full rounded-md border border-[#334155] bg-[#1E293B] pl-12 text-base text-white shadow-none placeholder:text-[#94A3B8] focus-visible:border-[#0088FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088FF]/20 disabled:opacity-60';

export const useDomesticAccess = (): DomesticAccess => {
  const access = useContext(DomesticAccessContext);
  if (!access) throw new Error('Domestic requiere una sesión autorizada.');
  return access;
};

export const DomesticAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sessionInput, setSessionInput] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleApplySession = async (raw: string) => {
    if (!raw.trim()) return;
    setSessionLoading(true);
    try {
      let token = raw.trim();
      let accessToken = '';
      let refreshToken = '';

      if (token.startsWith('{')) {
        const parsed = JSON.parse(token);
        accessToken = parsed.access_token || parsed.currentSession?.access_token || '';
        refreshToken = parsed.refresh_token || parsed.currentSession?.refresh_token || '';
      } else if (token.includes('access_token=')) {
        const hash = token.includes('#') ? token.split('#')[1] : token;
        const params = new URLSearchParams(hash);
        accessToken = params.get('access_token') || '';
        refreshToken = params.get('refresh_token') || '';
      } else {
        accessToken = token;
      }

      if (!accessToken) {
        throw new Error('No se encontró un access_token válido.');
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || accessToken,
      });

      if (error) throw error;
      setRefreshKey(p => p + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token inválido';
      setState({ status: 'error', message: 'Error al vincular sesión: ' + message });
    } finally {
      setSessionLoading(false);
    }
  };

  const handlePasteAndApply = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSessionInput(text);
        await handleApplySession(text);
      }
    } catch {
      setState({ status: 'error', message: 'Pegá manualmente el token en el recuadro inferior.' });
    }
  };

  useEffect(() => {
    let active = true;

    const verifyAccess = async () => {
      setState({ status: 'checking' });
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          setState({ status: 'signed-out' });
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (userError || !userData.user?.email) throw userError ?? new Error('Sesión no válida.');

        const { data: personaPadreId, error: accessError } = await supabase.rpc('dom_current_persona_padre_id');
        if (!active) return;
        if (accessError) throw accessError;
        if (typeof personaPadreId !== 'number' || !Number.isInteger(personaPadreId) || personaPadreId <= 0) {
          setState({ status: 'denied', email: userData.user.email });
          return;
        }

        setState({ status: 'authorized', email: userData.user.email, personaPadreId });
      } catch {
        if (active) setState({ status: 'error', message: 'No pudimos verificar tu acceso. Intentá de nuevo.' });
      }
    };

    void verifyAccess();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'signed-out' });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setRefreshKey((previous) => previous + 1);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refreshKey]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      setState({ status: 'error', message: 'No pudimos cerrar la sesión. Intentá de nuevo.' });
      return;
    }
    setState({ status: 'signed-out' });
  };

  const signIn = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: new URL('/', window.location.origin).toString(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setState({ status: 'error', message: 'No pudimos abrir el acceso con Google. Intentá de nuevo.' });
      setSubmitting(false);
    }
  };

  const signInDemo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const email = demoEmail.trim().toLowerCase();
    if (email !== 'admin.demo@agenor-domestic.com' && email !== 'admin.demo2@agenor-domestic.com') {
      setDemoPassword('');
      setState({ status: 'error', message: 'Usá una de las cuentas DEMO habilitadas de Domestic.' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: demoPassword,
      });
      if (error) throw error;
    } catch {
      setState({ status: 'error', message: 'No pudimos iniciar sesión en DEMO. Revisá el correo y la contraseña.' });
    } finally {
      setDemoPassword('');
      setSubmitting(false);
    }
  };

  if (state.status === 'authorized') {
    return (
      <DomesticAccessContext.Provider
        value={{ email: state.email, personaPadreId: state.personaPadreId, signOut }}
      >
        {children}
      </DomesticAccessContext.Provider>
    );
  }

  return (
    <div className="flex min-h-dvh bg-[#070D1B] text-white">
      <aside className="relative hidden min-h-dvh w-[58%] shrink-0 overflow-hidden lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/login/domestic-workspace.webp')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(7,13,27,.28), rgba(7,13,27,.50) 50%, rgba(7,13,27,.85))' }}
        />
        <div className="relative flex w-full flex-col justify-between gap-14 p-[clamp(48px,5vw,96px)]">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#0088FF] shadow-lg">
              <Wallet className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="text-2xl font-semibold tracking-tight">Agenor Domestic</span>
          </div>

          <p className="max-w-xl text-5xl font-semibold leading-none tracking-tight xl:text-6xl">
            Tus finanzas personales
          </p>

          <ul className="grid w-full max-w-2xl grid-cols-3 gap-5 border-t border-white/20 pt-7 text-xs font-semibold uppercase text-[#CBD5E1]">
            <li><Wallet className="mb-3 h-9 w-9 text-white" aria-hidden="true" />Billetera</li>
            <li><CalendarDays className="mb-3 h-9 w-9 text-white" aria-hidden="true" />Presupuesto</li>
            <li><Landmark className="mb-3 h-9 w-9 text-white" aria-hidden="true" />Patrimonio</li>
          </ul>
        </div>
      </aside>

      <section className="relative flex min-h-dvh min-w-0 flex-1 flex-col bg-[#070D1B]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1E293B]/60 via-[#0B1329]/20 to-transparent" />
        <div className="relative flex min-h-dvh flex-1 flex-col px-[clamp(24px,4.2vw,80px)] py-[clamp(28px,4.2vw,80px)]">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0088FF]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-xl font-semibold">Agenor Domestic</span>
          </div>

          <main className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[560px]">
              <header className="mb-8 lg:mb-10">
                <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
                  {state.status === 'denied' ? 'Cuenta no autorizada' : 'Bienvenido'}
                </h1>
                <p className="mt-3 text-base leading-6 text-[#CBD5E1]">
                  {state.status === 'denied'
                    ? `La sesión de ${state.email} no tiene acceso. Usá una cuenta habilitada de Domestic.`
                    : 'Ingresá a Agenor Domestic.'}
                </p>
              </header>

              {state.status === 'checking' ? (
                <p role="status" className="flex items-center gap-2 text-sm text-[#CBD5E1]">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Verificando acceso...
                </p>
              ) : (
                <>
                  {state.status === 'error' && (
                    <div role="alert" className="mb-6 flex items-start gap-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <p>{state.message}</p>
                    </div>
                  )}

                  {state.status !== 'denied' && (
                    <form className="space-y-5" onSubmit={event => void signInDemo(event)} aria-labelledby="dom-demo-login">
                      <p id="dom-demo-login" className="text-sm font-semibold text-[#CBD5E1]">Ingresar a DEMO con contraseña</p>
                      <div className="space-y-2">
                        <label htmlFor="dom-demo-email" className="block text-xs font-semibold uppercase text-[#94A3B8]">Correo DEMO</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true" />
                          <input id="dom-demo-email" type="email" autoComplete="username" value={demoEmail} required disabled={submitting}
                            onChange={event => setDemoEmail(event.target.value)} className={`${loginInputClass} pr-4`} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="dom-demo-password" className="block text-xs font-semibold uppercase text-[#94A3B8]">Contraseña DEMO</label>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true" />
                          <input id="dom-demo-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={demoPassword}
                            required disabled={submitting} onChange={event => setDemoPassword(event.target.value)} className={`${loginInputClass} pr-12`} />
                          <button type="button" onClick={() => setShowPassword(visible => !visible)}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[#94A3B8] hover:text-white focus-visible:ring-2 focus-visible:ring-[#0088FF]">
                            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                          </button>
                        </div>
                      </div>

                      <button type="submit" disabled={submitting}
                        className="flex h-14 w-full items-center justify-center gap-3 rounded-md bg-blue-600 px-4 text-base font-semibold text-white shadow-lg shadow-black/30 hover:bg-blue-700 disabled:opacity-50">
                        Entrar a DEMO <ArrowRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </form>
                  )}

                  <div className="mt-6 space-y-3 border-t border-[#334155] pt-6">
                    <button type="button" onClick={() => void signIn()} disabled={submitting}
                      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-[#334155] bg-[#1E293B] px-4 text-sm font-semibold hover:bg-[#334155] disabled:opacity-60">
                      <LogIn className="h-5 w-5 text-[#38BDF8]" aria-hidden="true" /> Continuar con Google
                    </button>

                    <details className="rounded-md border border-[#334155] px-3 py-2">
                      <summary className="cursor-pointer py-1.5 text-sm font-semibold text-[#CBD5E1]">Vincular sesión existente</summary>
                      <div className="mt-2 space-y-2">
                        <button type="button" onClick={() => void handlePasteAndApply()} disabled={sessionLoading}
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1E293B] px-3 text-xs font-semibold hover:bg-[#334155] disabled:opacity-60">
                          <Clipboard className="h-4 w-4 text-[#38BDF8]" aria-hidden="true" />
                          {sessionLoading ? 'Vinculando...' : 'Pegar sesión del portapapeles'}
                        </button>
                        <form onSubmit={event => { event.preventDefault(); void handleApplySession(sessionInput); }} className="flex gap-2">
                          <input type="text" aria-label="Token o URL de sesión" placeholder="O pegar token / URL aquí..." value={sessionInput}
                            onChange={event => setSessionInput(event.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-[#334155] bg-[#070D1B] px-3 py-2 text-xs placeholder:text-[#94A3B8] focus-visible:border-[#0088FF] focus-visible:outline-none" />
                          <button type="submit" disabled={sessionLoading || !sessionInput.trim()}
                            className="min-h-11 rounded-md bg-blue-600 px-4 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                            Usar
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>

                  {(state.status === 'error' || state.status === 'denied') && (
                    <button type="button"
                      onClick={() => state.status === 'denied' ? void signOut() : setRefreshKey(previous => previous + 1)}
                      className="mt-3 min-h-11 w-full rounded-md text-sm font-medium text-[#CBD5E1] hover:text-white">
                      {state.status === 'denied' ? 'Usar otra cuenta' : 'Reintentar'}
                    </button>
                  )}
                </>
              )}
            </div>
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold uppercase text-[#94A3B8]">
            <span>© {new Date().getFullYear()} Agenor Domestic</span>
          </footer>
        </div>
      </section>
    </div>
  );
};
