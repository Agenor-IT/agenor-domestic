import { useEffect, useRef, useState } from 'react';
import { VoiceCommandController } from '../../application/voice/VoiceCommandController';
import { VoiceState, VoiceStep } from '../../domain/voice/VoiceControl';
import { argentinaDate } from '../../domain/shared/argentinaDate';
import { DOMESTIC_VOICE_PROTOCOL_VERSION } from '../../domain/voice/voiceProtocol';
import { supabase } from '../../infrastructure/supabaseClient';
import { activeDomesticVoiceRoot, compactVoiceScreen, DomesticVoiceSurface } from '../../infrastructure/voice/DomesticVoiceSurface';
import type { DomesticLiveSession, VoiceCredentials, VoiceToolCall } from '../../infrastructure/voice/DomesticLiveSession';

const messages: Record<string, string> = {
  DOM_VOICE_NOT_CONFIGURED: 'La voz todavía no está habilitada en el servidor de Domestic.',
  DOM_VOICE_AUTH_REQUIRED: 'Tu sesión venció. Volvé a ingresar para usar la voz.',
  DOM_VOICE_ACCESS_DENIED: 'Esta cuenta no tiene acceso a la voz de Domestic.',
  DOM_VOICE_WAIT: 'Esperá unos segundos antes de iniciar otra sesión.',
  DOM_VOICE_QUOTA: 'El servicio de voz alcanzó su límite. Intentá más tarde.',
  DOM_VOICE_PROVIDER_UNAVAILABLE: 'El servicio de voz no está disponible. Intentá más tarde.'
};

interface VoiceOptions {
  section: string;
  personaPadreId: number;
  sections: readonly { id: string; label: string }[];
  onNavigate(section: string): void;
}

export function useDomesticVoice(options: VoiceOptions) {
  const current = useRef(options); current.current = options;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const previousDialog = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<VoiceState>('idle');
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const session = useRef<DomesticLiveSession | null>(null);
  const controller = useRef<VoiceCommandController | null>(null);
  const generation = useRef(0);
  const active = state !== 'idle' && state !== 'error';
  const preferenceKey = `dom_voice_consent_v1:${options.personaPadreId}`;

  const stop = () => {
    generation.current++;
    controller.current?.stop();
    session.current?.stop(); session.current = null;
    setState('idle'); setMuted(false);
  };

  const start = async () => {
    if (session.current) return;
    const attempt = ++generation.current;
    setVisible(true); setExpanded(true); setError(''); setTranscript(''); setAnswer(''); setState('connecting');
    try { localStorage.setItem(preferenceKey, 'accepted'); } catch { /* optional device preference */ }
    const surface = new DomesticVoiceSurface(() => current.current.section, options.sections, section => current.current.onNavigate(section));
    const controls = new VoiceCommandController(surface);
    controller.current = controls;
    let instance: DomesticLiveSession | undefined;
    try {
      const { DomesticLiveSession: Session } = await import('../../infrastructure/voice/DomesticLiveSession');
      if (attempt !== generation.current) return;
      instance = new Session(); session.current = instance;
      await instance.prepare();
      if (attempt !== generation.current) { instance.stop(); return; }
      const { data, error: tokenError } = await supabase.functions.invoke<VoiceCredentials>('dom-voice', { body: {} });
      if (tokenError) {
        let code = '';
        if (tokenError.context instanceof Response) {
          const body = await tokenError.context.json().catch(() => ({})) as { code?: string };
          code = body.code || '';
        }
        throw new Error(messages[code] || 'No se pudo iniciar la voz. Verificá que el servicio de Domestic esté habilitado.');
      }
      if (!data?.token || !data.model || !Number.isFinite(data.maxSeconds) || data.maxSeconds <= 0 || data.maxSeconds > 600) throw new Error('La voz todavía no está habilitada en el servidor de Domestic.');
      if (data.protocolVersion !== DOMESTIC_VOICE_PROTOCOL_VERSION) throw new Error('La versión de voz cambió. Actualizá Domestic antes de iniciar.');
      if (attempt !== generation.current) { instance.stop(); return; }
      const sessionKey = crypto.randomUUID();
      let count = 0;
      const tools = async (calls: VoiceToolCall[]) => {
        const responses = [];
        for (const call of calls) {
          if (attempt !== generation.current) break;
          count++;
          let response: unknown;
          try {
            if (count > 200) throw new Error('La sesión alcanzó su límite de acciones. Finalizala y revisá la pantalla.');
            if (!call.id) throw new Error('La herramienta no tiene un identificador válido.');
            const args = call.args || {};
            if (call.name === 'read_domestic_screen') {
              const screen = controls.read(typeof args.controlId === 'string' ? args.controlId : undefined, typeof args.optionQuery === 'string' ? args.optionQuery : undefined);
              response = { screen: compactVoiceScreen(screen, typeof args.query === 'string' ? args.query : ''), sections: current.current.sections, today: argentinaDate() };
            } else if (call.name === 'open_domestic_section' && typeof args.section === 'string') {
              const result = await controls.navigate(args.section);
              response = { ...result, screen: result.screen && compactVoiceScreen(result.screen) };
            } else if (call.name === 'use_domestic_controls' && typeof args.snapshotKey === 'string' && Array.isArray(args.steps)) {
              const valid = args.steps.every((step: unknown) => {
                if (!step || typeof step !== 'object') return false;
                const item = step as Record<string, unknown>;
                return typeof item.controlId === 'string' && (item.value === undefined || ['string', 'number', 'boolean'].includes(typeof item.value));
              });
              if (!valid) throw new Error('Los controles recibidos no son válidos.');
              const result = await controls.execute(`${sessionKey}:${call.id}`, args.snapshotKey, args.steps as VoiceStep[]);
              response = { ...result, screen: result.screen && compactVoiceScreen(result.screen) };
            } else throw new Error('Esa herramienta no existe en Domestic.');
          } catch (cause) { response = { status: 'failed', message: cause instanceof Error ? cause.message : 'No se completó el pedido.' }; }
          responses.push({ id: call.id, name: call.name, response });
        }
        return responses;
      };
      await instance.start(data, {
        state: next => { if (attempt === generation.current) setState(next); },
        turn: turn => { if (attempt !== generation.current) return; if (!turn.finished) controls.resume(); controls.receiveTurn(turn); setTranscript(turn.text); },
        answer: text => { if (attempt === generation.current) setAnswer(text); },
        tools,
        error: message => { if (attempt !== generation.current) return; controls.stop(); session.current = null; setState('error'); setError(message); setMuted(false); },
        ended: () => { if (attempt !== generation.current) return; controls.stop(); session.current = null; setState('idle'); setMuted(false); }
      });
    } catch (cause) {
      instance?.stop();
      if (attempt !== generation.current) return;
      controls.stop(); session.current = null; setState('error');
      const micErrors: Record<string, string> = {
        NotAllowedError: 'Habilitá el micrófono en tu navegador para hablar con Domestic.',
        NotFoundError: 'No encontré un micrófono conectado.',
        NotReadableError: 'No pude acceder al micrófono. Revisá si otra aplicación lo está usando.'
      };
      setError(cause instanceof DOMException && micErrors[cause.name] || (cause instanceof Error ? cause.message : 'No se pudo iniciar el micrófono.'));
    }
  };

  const open = () => {
    setVisible(true); setExpanded(true);
    let consented = false;
    try { consented = localStorage.getItem(preferenceKey) === 'accepted'; } catch { /* show the disclosure */ }
    if (consented && !session.current) void start();
  };
  const close = () => { stop(); setVisible(false); };
  useEffect(() => {
    let marked: HTMLElement | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      let root: HTMLElement | null = null;
      if (visible) { try { root = activeDomesticVoiceRoot(); } catch { /* loading */ } }
      const dialog = root && root !== document.getElementById('main-content') ? root : null;
      if (dialog && dialog !== previousDialog.current) setExpanded(false);
      previousDialog.current = dialog;
      setDialogOpen(Boolean(dialog));
      if (marked && (marked !== dialog || expanded)) marked.removeAttribute('data-domestic-voice-modal');
      marked = dialog && !expanded ? dialog : null;
      marked?.setAttribute('data-domestic-voice-modal', '');
    };
    update();
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(update); });
    if (visible) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); marked?.removeAttribute('data-domestic-voice-modal'); };
  }, [visible, expanded]);
  useEffect(() => {
    const leave = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', leave);
    return () => { document.removeEventListener('visibilitychange', leave); generation.current++; controller.current?.stop(); session.current?.stop(); };
  }, []);
  return {
    visible, expanded, dialogOpen, state, active, muted, transcript, answer, error, open, close, start, stop,
    collapse: () => setExpanded(value => !value),
    toggleMute: () => { const value = !muted; session.current?.mute(value); setMuted(value); },
    interrupt: () => { controller.current?.stop(); session.current?.interrupt(); setState('listening'); }
  };
}

export type DomesticVoice = ReturnType<typeof useDomesticVoice>;
