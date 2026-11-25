import { useRef, useState, type FormEvent } from 'react';
import { creditorKinds, type Creditor, type CreditorInput, type CreditorKind } from '../domain/creditor';

export const creditorField = 'creditor-field mt-1 min-h-11 w-full rounded-xl border px-3';
export const creditorButton = 'min-h-11 rounded-xl bg-[#0088FF] px-4 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50';

export function CreditorForm({ save, onSaved, onBack, onSavingChange }: {
  save: (creditor: Creditor) => Promise<void>;
  onSaved: (creditor: Creditor) => void;
  onBack: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [fields, setFields] = useState<CreditorInput>({ name: '', kind: 'person', document: '', contact: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef<{ fingerprint: string; id: string }>();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const values = { ...fields, name: fields.name.trim(), document: fields.document.trim(), contact: fields.contact.trim() };
    if (!values.name) { setError('Ingresá el nombre del acreedor.'); return; }
    if (typeof crypto.randomUUID !== 'function') { setError('Abrí Domestic desde HTTPS o localhost para guardar.'); return; }
    setError('');
    setSaving(true);
    onSavingChange?.(true);
    try {
      const fingerprint = JSON.stringify(values);
      if (!pending.current || pending.current.fingerprint !== fingerprint) {
        pending.current = { fingerprint, id: crypto.randomUUID() };
      }
      const creditor = { ...values, id: pending.current.id };
      await save(creditor);
      onSaved(creditor);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el acreedor.');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };
  return <form onSubmit={submit}>
    <fieldset disabled={saving} className="grid gap-4 text-sm font-medium sm:grid-cols-2">
      <label>Nombre o razón social<input required maxLength={120} className={creditorField} value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} /></label>
      <label>Tipo de acreedor<select className={creditorField} value={fields.kind} onChange={e => setFields({ ...fields, kind: e.target.value as CreditorKind })}>
        {Object.entries(creditorKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Documento o CUIT <span className="font-normal opacity-75">(opcional)</span><input maxLength={40} className={creditorField} value={fields.document} onChange={e => setFields({ ...fields, document: e.target.value })} /></label>
      <label>Contacto <span className="font-normal opacity-75">(opcional)</span><input maxLength={120} className={creditorField} value={fields.contact} onChange={e => setFields({ ...fields, contact: e.target.value })} /></label>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="mt-4 flex justify-end gap-3">
      <button type="button" onClick={onBack} disabled={saving} className="creditor-field min-h-11 rounded-xl border px-4 text-sm">Volver</button>
      <button className={creditorButton} disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar acreedor'}</button>
    </div>
  </form>;
}
