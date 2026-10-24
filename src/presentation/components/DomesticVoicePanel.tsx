import React from 'react';
import { ChevronDown, ChevronUp, Loader2, Mic, MicOff, Plus, Square, X } from 'lucide-react';
import { DomesticVoice } from '../hooks/useDomesticVoice';

const labels = { idle: 'Asistente por voz', connecting: 'Conectando…', listening: 'Te escucho', working: 'Resolviendo…', speaking: 'Respondiendo', error: 'Asistente por voz' };

export const DomesticVoicePanel: React.FC<{ voice: DomesticVoice; onNewTransaction(): void }> = ({ voice, onNewTransaction }) => <>
  <button type="button" data-voice-ignore onClick={voice.open} aria-label="Abrir asistente por voz" aria-pressed={voice.active} aria-expanded={voice.visible} aria-controls="domestic-voice-panel" className="fixed bottom-6 right-6 z-[60] hidden min-h-14 items-center gap-2 rounded-2xl bg-[#0088FF] px-5 font-bold text-white shadow-xl shadow-blue-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 lg:flex">
    <Mic className={`h-6 w-6 ${voice.active ? 'animate-pulse' : ''}`} aria-hidden="true" />Voz
  </button>
  {voice.visible && <aside id="domestic-voice-panel" data-voice-ignore aria-label="Asistente de voz de Domestic" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); voice.close(); } }} className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[90] mx-auto w-auto max-w-md overflow-hidden rounded-2xl border border-blue-300 bg-white text-gray-900 shadow-2xl dark:border-blue-900 dark:bg-[#0F172A] dark:text-white lg:bottom-24 lg:left-auto lg:right-6 lg:w-96">
    <div className="flex min-h-14 items-center gap-2 px-3 py-2">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${voice.active && !voice.muted ? 'bg-blue-500/15 text-blue-500' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
        {voice.state === 'connecting' || voice.state === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : voice.muted ? <MicOff className="h-5 w-5" /> : <Mic className={`h-5 w-5 ${voice.active ? 'animate-pulse' : ''}`} />}
      </span>
      <p role="status" className="min-w-0 flex-1 truncate text-sm font-bold">{voice.muted ? 'Micrófono silenciado' : labels[voice.state]}</p>
      <button type="button" onClick={voice.collapse} aria-label={voice.expanded ? 'Minimizar asistente' : 'Expandir asistente'} aria-expanded={voice.expanded} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">{voice.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</button>
      <button type="button" onClick={voice.close} aria-label="Cerrar y detener micrófono" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
    </div>
    {voice.expanded && <div className="max-h-[50dvh] space-y-3 overflow-y-auto overscroll-contain border-t border-gray-200 p-3 dark:border-gray-800">
      {!voice.active && <>
        <p className="text-sm text-gray-600 dark:text-gray-300">Pedí lo que necesitás. Por ejemplo: «Buscá Sitsa» o «Registrá un gasto de 5.000 pesos».</p>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">Al comenzar, tu voz y el contenido de la pantalla se envían a Google. Domestic no guarda audio. Podés detener el micrófono cuando quieras.</p>
      </>}
      {voice.transcript && <p className="break-words rounded-xl bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800"><span className="sr-only">Tu orden: </span>{voice.transcript}</p>}
      {voice.answer && <p aria-live="polite" className="break-words px-1 text-sm text-gray-600 dark:text-gray-300">{voice.answer}</p>}
      {voice.error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{voice.error}</p>}
      {voice.active ? <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={voice.toggleMute} aria-pressed={voice.muted} className="min-h-11 rounded-xl bg-gray-100 px-3 text-sm font-semibold dark:bg-gray-800">{voice.muted ? 'Activar micrófono' : 'Silenciar'}</button>
        <button type="button" onClick={voice.interrupt} className="min-h-11 rounded-xl px-3 text-sm">Interrumpir</button>
        <button type="button" onClick={voice.stop} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-rose-600 dark:text-rose-400"><Square className="h-3 w-3" />Finalizar</button>
      </div> : <button type="button" onClick={() => void voice.start()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0088FF] px-4 font-bold text-white"><Mic className="h-5 w-5" />{voice.state === 'error' ? 'Volver a intentar' : 'Comenzar a hablar'}</button>}
      <button type="button" onClick={() => { onNewTransaction(); if (voice.expanded) voice.collapse(); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold dark:border-gray-700"><Plus className="h-4 w-4" />Nueva transacción</button>
    </div>}
  </aside>}
</>;
