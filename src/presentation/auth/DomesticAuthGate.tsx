import React, { createContext, useContext, useEffect, useState } from 'react';
import { LockKeyhole, LogIn, RefreshCw, Wallet } from 'lucide-react';
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

export const useDomesticAccess = (): DomesticAccess => {
  const access = useContext(DomesticAccessContext);
  if (!access) throw new Error('Domestic requiere una sesión autorizada.');
  return access;
};

export const DomesticAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="flex min-h-dvh items-center justify-center bg-[#070D1B] px-4 py-8 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-[#1E293B] bg-[#0B1329] p-6 shadow-2xl sm:p-8" aria-live="polite">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0088FF]">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Agenor Domestic</h1>
            <p className="text-sm text-[#94A3B8]">Tus finanzas personales</p>
          </div>
        </div>

        {state.status === 'checking' ? (
          <p className="flex items-center gap-2 text-sm text-[#CBD5E1]">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Verificando acceso...
          </p>
        ) : (
          <>
            <div className="mb-5 flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#38BDF8]" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">
                  {state.status === 'denied' ? 'Cuenta no autorizada' : 'Ingresá con Google'}
                </h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {state.status === 'denied'
                    ? `La sesión de ${state.email} no tiene acceso. Ingresá con la cuenta de Google habilitada.`
                    : 'Sólo las cuentas habilitadas pueden ver tus datos.'}
                </p>
              </div>
            </div>

            {state.status === 'error' && (
              <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {state.message}
              </p>
            )}

            <button
              type="button"
              onClick={() => void signIn()}
              disabled={submitting}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#0088FF] px-4 font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              {submitting ? 'Abriendo Google...' : 'Continuar con Google'}
            </button>
            {(state.status === 'error' || state.status === 'denied') && (
              <button
                type="button"
                onClick={() => state.status === 'denied' ? void signOut() : setRefreshKey((previous) => previous + 1)}
                className="mt-3 min-h-11 w-full rounded-xl text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                {state.status === 'denied' ? 'Usar otra cuenta' : 'Reintentar'}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
};
