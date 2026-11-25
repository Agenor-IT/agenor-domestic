import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { creditorKinds, filterCreditors, type Creditor } from '../domain/creditor';
import { creditorButton, creditorField, CreditorForm } from './CreditorForm';
import { useCreditors } from './useCreditors';
import './creditors.css';

export function CreditorPicker({ tenant, onSelect, onClose }: {
  tenant: number;
  onSelect: (creditor: Creditor) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const catalog = useCreditors(tenant);
  const visible = filterCreditors(catalog.rows, query, 'all');
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="creditor-dialog fixed m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 text-[#172033] shadow-xl dark:border-[#28364e] dark:bg-[#0B1329] dark:text-gray-100 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={title} className="text-lg font-bold">{creating ? 'Nuevo acreedor' : 'Seleccionar acreedor'}</h2>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Cerrar selector de acreedor" className="flex h-11 w-11 items-center justify-center rounded-xl disabled:opacity-50"><X size={18} aria-hidden="true" /></button>
      </div>
      {creating ? <CreditorForm save={catalog.create} onBack={() => setCreating(false)} onSaved={onSelect} onSavingChange={setSaving} /> : <>
        <label className="block text-sm font-medium">Buscar acreedor<input type="search" autoFocus className={creditorField}
          value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, documento o contacto" /></label>
        {catalog.loading && <p role="status" className="mt-3 text-sm">Cargando…</p>}
        {catalog.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{catalog.error} <button type="button" onClick={catalog.reload} className="font-bold underline">Reintentar</button></p>}
        {visible.length > 0 && <ul className="mt-3 max-h-56 divide-y divide-gray-200 overflow-y-auto dark:divide-[#28364e]">
          {visible.map(row => <li key={row.id}><button type="button" onClick={() => onSelect(row)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm">
            <span><span className="block font-semibold">{row.name}</span>{row.document && <span className="block text-xs opacity-75">{row.document}</span>}</span>
            <span className="opacity-75">{creditorKinds[row.kind]}</span>
          </button></li>)}
        </ul>}
        {!catalog.loading && !catalog.error && !visible.length && <p className="mt-3 flex gap-2 text-sm"><Search size={16} aria-hidden="true" /> No se encontraron acreedores.</p>}
        <div className="mt-4 flex justify-end"><button type="button" className={creditorButton} onClick={() => setCreating(true)}>Nuevo acreedor</button></div>
      </>}
    </dialog>, document.body,
  );
}
