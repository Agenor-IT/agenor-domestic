import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Landmark, Search } from 'lucide-react';
import { CreditorPicker, type Creditor } from '../../acreedores';
import { argentinaDate } from '../../src/domain/shared/argentinaDate';
import { PageHeader } from '../../src/presentation/components/PageHeader';
import { amortizationLabels, nominalAnnualToMonthly, validDebt, validTerms, type AmortizationMethod, type DebtTerms, type NewDebt } from '../domain/debt';
import { DebtProjection } from './DebtProjection';

const inputClass = 'debt-field mt-1 min-h-11 w-full rounded-xl border px-3';
const sectionClass = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0B1329]';
const legendClass = 'px-2 text-base font-bold';

export function DebtFormPage({ tenant, onBack, onSave }: { tenant: number; onBack: () => void; onSave: (debt: NewDebt) => Promise<void> }) {
  const [fields, setFields] = useState({
    operationNumber: '', relationship: '', type: 'Préstamo', openedOn: argentinaDate(), principal: '', months: '', annualRate: '',
    firstDueOn: '', method: 'french' as AmortizationMethod,
  });
  const [creditor, setCreditor] = useState<Creditor | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plan, setPlan] = useState<DebtTerms | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ payload: string; id: string }>();
  const set = (key: keyof typeof fields, value: string) => {
    setFields(previous => ({ ...previous, [key]: value }));
    if (['openedOn', 'principal', 'months', 'annualRate', 'firstDueOn', 'method'].includes(key)) setPlan(null);
  };
  const annualRate = fields.annualRate === '' ? NaN : Number(fields.annualRate);
  const terms = {
    principal: Number(fields.principal), months: Number(fields.months),
    monthlyRate: nominalAnnualToMonthly(annualRate),
    firstDueOn: fields.firstDueOn, method: fields.method,
  };

  const generatePlan = () => {
    if (!validTerms(terms) || !fields.openedOn || fields.openedOn > terms.firstDueOn) {
      setError('Revisá el capital, el plazo, la tasa y el primer vencimiento para generar el plan.');
      return;
    }
    setError('');
    setPlan(terms);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!creditor) { setError('Seleccioná un acreedor.'); return; }
    if (!fields.operationNumber.trim()) { setError('Ingresá el número de operación.'); return; }
    if (!plan) { setError('Generá el plan de cuotas antes de guardar.'); return; }
    const input = {
      ...plan, creditor: creditor.name, creditorId: creditor.id, type: fields.type, openedOn: fields.openedOn,
      operationNumber: fields.operationNumber.trim(), relationship: fields.relationship.trim(), nominalAnnualRate: annualRate,
    };
    if (!validDebt(input)) {
      setError('Revisá los datos. El capital debe poder amortizarse en cada cuota del plazo elegido.');
      return;
    }
    if (typeof crypto.randomUUID !== 'function') {
      setError('Para guardar, abrí Domestic desde HTTPS o desde localhost.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = JSON.stringify(input);
      if (!pending.current || pending.current.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
      await onSave({ ...input, id: pending.current.id });
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar la deuda.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Nueva deuda" icon={Landmark} subtitle="Cargá las condiciones para proyectar las cuotas."
        action={<button type="button" disabled={saving} onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm dark:border-gray-700">
          <ArrowLeft size={16} aria-hidden="true" /> Volver a deudas
        </button>} />
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={saving} className={sectionClass}>
          <legend className={legendClass}>Datos de operación</legend>
          <div className="grid gap-4 text-sm font-medium sm:grid-cols-3">
            <label>Fecha<input className={inputClass} type="date" required min="1000-01-01" max="9969-12-31" value={fields.openedOn} onChange={e => set('openedOn', e.target.value)} /></label>
            <label>Número de operación<input required maxLength={80} className={inputClass} value={fields.operationNumber} onChange={e => set('operationNumber', e.target.value)} /></label>
            <label>Relación de deuda<input maxLength={160} className={inputClass} value={fields.relationship} onChange={e => set('relationship', e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset disabled={saving} className={sectionClass}>
          <legend className={legendClass}>Acreedor</legend>
          <button type="button" aria-haspopup="dialog" onClick={() => setPickerOpen(true)}
            className={inputClass + ' flex max-w-xl items-center gap-2 text-left text-sm font-medium'}>
            <Search size={16} aria-hidden="true" /> {creditor ? creditor.name : 'Buscar o crear acreedor'}
          </button>
        </fieldset>
        <fieldset disabled={saving} className={sectionClass}>
          <legend className={legendClass}>Condiciones de la deuda</legend>
          <div className="grid gap-4 text-sm font-medium sm:grid-cols-2 xl:grid-cols-3">
            <label>Tipo de deuda<select className={inputClass} value={fields.type} onChange={e => set('type', e.target.value)}>
              <option>Préstamo</option><option>Tarjeta</option><option>Compra financiada</option><option>Otra</option>
            </select></label>
            <label>Primer vencimiento<input className={inputClass} type="date" required min={fields.openedOn || '1000-01-01'} max="9969-12-31" value={fields.firstDueOn} onChange={e => set('firstDueOn', e.target.value)} /></label>
            <label>Capital (ARS)<input className={inputClass} type="number" inputMode="decimal" required min="0.01" max="999999999.99" step="0.01" value={fields.principal} onChange={e => set('principal', e.target.value)} /></label>
            <label>Plazo (meses)<input className={inputClass} type="number" inputMode="numeric" required min="1" max="360" step="1" value={fields.months} onChange={e => set('months', e.target.value)} /></label>
            <label>Tasa nominal anual (%)<input className={inputClass} type="number" inputMode="decimal" required min="0" max="1200" step="0.0001" value={fields.annualRate} onChange={e => set('annualRate', e.target.value)} /></label>
            <label>Sistema de amortización<select className={inputClass} value={fields.method} onChange={e => set('method', e.target.value)}>
              {Object.entries(amortizationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={generatePlan} className="min-h-11 rounded-xl bg-[#0088FF] px-4 text-sm font-bold text-white">Generar plan de cuotas</button>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {plan && <>
          <p className="text-sm">Tasa mensual aplicada: {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(plan.monthlyRate)} %</p>
          <DebtProjection terms={plan} projected />
        </>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[#0088FF] px-4 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar deuda'}
          </button>
        </div>
      </form>
      {pickerOpen && <CreditorPicker tenant={tenant} onClose={() => setPickerOpen(false)}
        onSelect={selected => { setCreditor(selected); setPickerOpen(false); }} />}
    </div>
  );
}
