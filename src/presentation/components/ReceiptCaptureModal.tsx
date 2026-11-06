import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, ScanLine, X } from 'lucide-react';
import { ReceiptDraft } from '../../domain/receipts/ReceiptDraft';
import { prepareReceiptImage, readReceipt } from '../../infrastructure/receipts/readReceipt';

interface Props {
  file: File;
  onClose(): void;
  onRetake(): void;
  onDraft(draft: ReceiptDraft): void;
}

export const ReceiptCaptureModal: React.FC<Props> = ({ file, onClose, onRetake, onDraft }) => {
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const current = ++generation.current;
    setImage(''); setBusy(true); setError('');
    void prepareReceiptImage(file).then(result => {
      if (generation.current === current) setImage(result);
    }).catch(reason => {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : 'No se pudo abrir la foto.');
    }).finally(() => { if (generation.current === current) setBusy(false); });
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      generation.current++; pending.current?.abort(); pending.current = null;
      document.body.style.overflow = previousOverflow; previousFocus?.focus();
    };
  }, [file]);

  const analyze = async () => {
    if (pending.current || !image) return;
    const controller = new AbortController();
    pending.current = controller;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const draft = await readReceipt(image, controller.signal);
      if (generation.current === current) onDraft(draft);
    } catch (reason) {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : 'No se pudo leer el comprobante.');
    } finally { if (generation.current === current) { pending.current = null; setBusy(false); } }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" aria-describedby="receipt-help" aria-busy={busy}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-xl dark:bg-[#0B1329] dark:text-white">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 id="receipt-title" className="flex items-center gap-2 font-bold"><Camera className="h-5 w-5" /> Foto del comprobante</h2>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Cancelar lectura de comprobante" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p id="receipt-help" className="text-sm text-gray-600 dark:text-gray-300">Un solo ticket o factura por foto, con todo el texto visible. Revisá que se lean el total y la fecha.</p>
          {image && <img src={image} alt="Comprobante a leer" className="max-h-[45dvh] w-full rounded-lg object-contain" />}
          {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{image ? 'Leyendo comprobante…' : 'Preparando foto…'}</p>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400">Al leer, la foto se envía a Gemini para extraer los datos. Después podrás revisarlos en Transacciones y guardar. La foto no se adjunta a la transacción.</p>
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button type="button" onClick={onRetake} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-600">Otra foto</button>
          <button type="button" onClick={() => void analyze()} disabled={busy || !image} className="flex items-center gap-2 rounded-xl bg-[#0088FF] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ScanLine className="h-4 w-4" />Leer comprobante</button>
        </footer>
      </section>
    </div>
  );
};
