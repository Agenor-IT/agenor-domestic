import React, { useEffect, useRef, useSyncExternalStore } from 'react';

interface PendingConfirmation { message: string; resolve: (value: boolean) => void; }
let pending: PendingConfirmation | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const settle = (value: boolean) => {
  const previous = pending;
  pending = null;
  emit();
  previous?.resolve(value);
};

/** Shared by mouse, keyboard and voice. Opening the dialog never authorizes deletion. */
export function confirmDomesticAction(message: string): Promise<boolean> {
  if (pending) return Promise.resolve(false);
  return new Promise(resolve => { pending = { message, resolve }; emit(); });
}

export const DomesticConfirmation: React.FC = () => {
  const state = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => pending);
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state) return;
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); settle(false); }
      if (event.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.isConnected && previous.focus(); };
  }, [state]);
  useEffect(() => () => settle(false), []);
  if (!state) return null;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" data-voice-confirmation>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="domestic-confirm-title" className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-5 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-[#0F172A] dark:text-white">
      <h2 id="domestic-confirm-title" className="text-lg font-bold">Confirmar acción</h2>
      <p className="my-4 text-sm leading-relaxed">{state.message}</p>
      <div className="grid grid-cols-2 gap-3">
        <button ref={cancel} type="button" onClick={() => settle(false)} className="min-h-11 rounded-xl bg-gray-100 px-3 font-semibold dark:bg-gray-800">Cancelar</button>
        <button type="button" data-voice-effect="destructive" onClick={() => settle(true)} className="min-h-11 rounded-xl bg-rose-600 px-3 font-semibold text-white">Confirmar</button>
      </div>
    </div>
  </div>;
};
