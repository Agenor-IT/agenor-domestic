import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { argentinaDate } from '../../domain/shared/argentinaDate';
import { Money } from '../../domain/shared/Money';
import { CardCashPlan, cardPlanAmounts, MonthlyCashSnapshot, projectMonthlyCash } from '../../domain/cashflow/MonthlyCashPlan';
import { IMonthlyCashRepository } from '../../domain/repositories/IMonthlyCashRepository';
import { MonthlyCashNotEnabledError } from '../../infrastructure/SupabaseDomMonthlyCashRepository';
import { FormattedNumberInput } from './FormattedNumberInput';
import { SearchableSelect } from './SearchableSelect';

const box = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0F172A]';
const input = 'min-h-11 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-[#1E293B] dark:text-white';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold dark:border-gray-700 disabled:opacity-50';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0088FF] px-4 text-sm font-bold text-white disabled:opacity-50';
const label = 'block space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300';
const money = (value: number) => Money.fromAmount(value).toFormattedString();
const monthLabel = (month: string) => new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'));
const dateLabel = (date: string) => date.split('-').reverse().join('/');
type Form = 'card' | 'plan' | 'payment' | 'bill' | null;

export function MonthlyCashPanel({ personaPadreId, repository, cardDebt, onTransactions }: {
  personaPadreId: number; repository: IMonthlyCashRepository; cardDebt: Money | null; onTransactions(): void;
}) {
  const [snapshot, setSnapshot] = useState<MonthlyCashSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [pendingBackend, setPendingBackend] = useState(false);
  const [start, setStart] = useState(argentinaDate().slice(0, 7)), [periods, setPeriods] = useState(6);
  const [form, setForm] = useState<Form>(null), [formError, setFormError] = useState('');
  const [cardName, setCardName] = useState(''), [closingDay, setClosingDay] = useState(''), [dueDay, setDueDay] = useState('');
  const [cardDraftId, setCardDraftId] = useState('');
  const [cardActive, setCardActive] = useState(true);
  const request = useRef(0);
  const [plan, setPlan] = useState<CardCashPlan | null>(null);
  const [payMode, setPayMode] = useState('unplanned'), [customPayment, setCustomPayment] = useState(0);
  const [planId, setPlanId] = useState(''), [paymentId, setPaymentId] = useState(''), [allocation, setAllocation] = useState(0);
  const [billId, setBillId] = useState(''), [billDate, setBillDate] = useState(''), [expenseId, setExpenseId] = useState(''), [budgetMonth, setBudgetMonth] = useState('');

  const refresh = useCallback(async () => {
    const currentRequest = ++request.current;
    setLoading(true); setError(''); setPendingBackend(false); setSnapshot(null);
    try { const data = await repository.getSnapshot(personaPadreId); if (currentRequest === request.current) setSnapshot(data); }
    catch (cause) {
      if (currentRequest !== request.current) return;
      if (cause instanceof MonthlyCashNotEnabledError) setPendingBackend(true);
      else setError(cause instanceof Error ? cause.message : 'No se pudo leer el flujo mensual.');
    } finally { if (currentRequest === request.current) setLoading(false); }
  }, [repository, personaPadreId]);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
  useEffect(() => {
    if (!form) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [form]);
  const months = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(start)) return [];
    const [year, month] = start.split('-').map(Number);
    return Array.from({ length: periods }, (_, i) => new Date(Date.UTC(year, month - 1 + i, 1, 12)).toISOString().slice(0, 7));
  }, [start, periods]);
  const projection = useMemo(() => {
    try { return { rows: snapshot ? projectMonthlyCash(snapshot, months) : [], error: '' }; }
    catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : 'Datos del flujo inválidos.' }; }
  }, [snapshot, months]);
  const cardNameOf = (id: string) => snapshot?.cards.find(c => c.id === id)?.name || 'Tarjeta';
  const selectedBill = snapshot?.bills.find(b => b.id === billId);
  const selectedPayment = snapshot?.payments.find(p => p.id === paymentId);
  const planLocked = !!plan && !!snapshot && cardPlanAmounts(plan, snapshot.payments).paid.isPositive();
  const paymentAvailable = selectedPayment ? Money.fromAmount(selectedPayment.amount)
    .subtract(selectedPayment.allocations.reduce((sum, a) => sum.add(a.amount), Money.zero())) : Money.zero();

  const open = (next: Form) => { setFormError(''); setForm(next); };
  const openPlan = (existing?: CardCashPlan) => {
    setPlan(existing || { id: crypto.randomUUID(), cardId: snapshot?.cards[0]?.id || '', month: start,
      dueDate: '', closingDate: null, source: 'statement', total: 0, minimum: null, planned: null, plannedDate: null, revision: 0 });
    setPayMode(existing?.planned == null ? 'unplanned' : 'custom'); setCustomPayment(existing?.planned || 0); open('plan');
  };
  const openBill = (id: string) => {
    const bill = snapshot?.bills.find(b => b.id === id);
    setBillId(id); setBillDate(bill?.dueDate || ''); setExpenseId(bill?.expenseId || '');
    setBudgetMonth(bill?.budgetMonth || bill?.date.slice(0, 7) || start); open('bill');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!snapshot || busy) return;
    setFormError(''); setBusy(true);
    try {
      if (form === 'card') {
        await repository.saveCard(personaPadreId, { id: cardDraftId, name: cardName.trim(), closingDay: Number(closingDay), dueDay: Number(dueDay), active: cardActive }, snapshot.cards.find(c => c.id === cardDraftId));
      } else if (form === 'plan' && plan) {
        const planned = payMode === 'unplanned' ? null : payMode === 'full' ? plan.total : payMode === 'minimum' ? plan.minimum : customPayment;
        if (payMode === 'minimum' && plan.minimum === null) throw new Error('Completá el mínimo informado por el banco.');
        await repository.savePlan(personaPadreId, { ...plan, planned, plannedDate: planned === null ? null : plan.plannedDate });
      } else if (form === 'payment') {
        if (!planId || !paymentId || allocation <= 0 || Money.fromAmount(allocation).subtract(paymentAvailable).isPositive()) throw new Error('Revisá el pago y el importe disponible.');
        await repository.allocatePayment(personaPadreId, planId, paymentId, allocation, 0);
      } else if (form === 'bill' && selectedBill) {
        await repository.scheduleBill(personaPadreId, billId, billDate, expenseId || null, expenseId ? budgetMonth : null, selectedBill.scheduleRevision);
      }
      setForm(null); await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const removeAllocation = async (transactionId: string, id: string, revision: number) => {
    setBusy(true); setError('');
    try { await repository.allocatePayment(personaPadreId, id, transactionId, 0, revision); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo quitar el vínculo.'); }
    finally { setBusy(false); }
  };
  const setPlanField = (change: Partial<CardCashPlan>) => setPlan(p => p ? { ...p, ...change } : null);
  return <section className="space-y-4" aria-label="Flujo mensual de egresos">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">Flujo mensual de egresos</h2>
        <p className="mt-1 text-sm text-gray-500">Deuda de tarjeta registrada: {cardDebt?.toFormattedString() || 'Saldo no disponible'}. El saldo contable y el pago previsto se muestran por separado.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => { setCardDraftId(crypto.randomUUID()); setCardActive(true); setCardName(''); setClosingDay(''); setDueDay(''); open('card'); }}><Plus className="h-4 w-4" />Tarjeta</button>
        <button type="button" className={primary} onClick={() => openPlan()}><Plus className="h-4 w-4" />Resumen o estimación</button>
        <button type="button" aria-label="Actualizar flujo mensual" className={button} disabled={loading || busy} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></button>
      </div>
    </div>
    <p className="text-xs text-gray-500">Importes en pesos (ARS). El pago que planeás es el total que querés abonar a ese resumen, incluidos los pagos ya vinculados. El saldo restante puede generar cargos: se incorporan desde el próximo resumen, sin estimar intereses.</p>
    {loading && <p role="status">Cargando compromisos…</p>}
    {pendingBackend && <p role="status" className="rounded-xl border border-amber-400 p-3 text-sm">Preparación local pendiente de publicar el backend. Podés revisar los formularios; todavía no se pueden guardar planes.</p>}
    {(error || projection.error) && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600">{error || projection.error}</p>}
    <div className="flex flex-wrap gap-3">
      <label className={label}>Desde<input aria-label="Primer mes del flujo" className={input} type="month" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label className={label}>Períodos<SearchableSelect aria-label="Cantidad de meses del flujo" className={input} value={periods} onChange={e => setPeriods(Number(e.target.value))}>{[1, 3, 6, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses'}</option>)}</SearchableSelect></label>
    </div>
    <div className={box + ' divide-y divide-gray-200 dark:divide-gray-800'}>
      {projection.rows.map(row => <article key={row.month} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold capitalize">{monthLabel(row.month)}</h3>
          <span className={row.incomplete ? 'text-xs font-semibold text-amber-600 dark:text-amber-400' : 'text-xs text-gray-500'}>{row.incomplete ? 'Proyección incompleta: faltan datos' : 'Pagos planificados'}</span></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {([['Gastos fijos estimados', row.fixed], ['Otros presupuestos', row.otherBudgets], ['Facturas pendientes', row.bills], ['Pagos ya registrados', row.paid], ['Tarjetas por pagar según plan', row.cards]] as const).map(([text, value]) => <div key={text}><dt className="text-xs text-gray-500">{text}</dt><dd className="mt-1 font-semibold">{value.toFormattedString()}</dd></div>)}
          <div><dt className="text-xs font-bold">Egresos estimados con datos cargados</dt><dd className="mt-1 font-bold text-rose-600 dark:text-rose-400">{row.total.toFormattedString()}</dd></div>
        </dl>
        {row.cardBudgets.isPositive() && <p className="text-xs text-gray-500">Consumos previstos con tarjeta: {row.cardBudgets.toFormattedString()}. Se pagan mediante el plan de tarjeta; no se suman otra vez como salida de efectivo.</p>}
      </article>)}
    </div>
    {snapshot && <>
      <div className="flex flex-wrap gap-2">{snapshot.cards.map(c => <button key={c.id} type="button" className={button} onClick={() => {
        setCardDraftId(c.id); setCardName(c.name); setClosingDay(String(c.closingDay)); setDueDay(String(c.dueDay)); setCardActive(c.active !== false); open('card');
      }}>{c.name}{c.active === false ? ' · Inactiva' : ''} · Editar</button>)}</div>
      {(snapshot.legacyReceipts > 0 || snapshot.payments.some(p => Money.fromAmount(p.amount).subtract(p.allocations.reduce((sum, a) => sum.add(a.amount), Money.zero())).isPositive())) && <p className="rounded-xl border border-amber-400 p-3 text-sm">Revisá los pagos de tarjeta sin vincular y los comprobantes pendientes cargados sólo en Egresos. No se infiere su conciliación contable.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Resúmenes y pagos previstos</h3><button type="button" className={button} onClick={onTransactions}>Registrar pago en Transacciones</button></div>
      {!snapshot.plans.length && <p className={box + ' p-4 text-sm text-gray-500'}>Cargá el resumen real o una estimación de cada tarjeta y elegí cuánto vas a pagar.</p>}
      {snapshot.plans.filter(p => months.includes(p.month)).map(p => {
        const values = cardPlanAmounts(p, snapshot.payments);
        return <article key={p.id} className={box + ' space-y-3 p-4'}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-bold">{cardNameOf(p.cardId)} · {monthLabel(p.month)}</h4><p className="text-xs text-gray-500">{p.source === 'statement' ? 'Resumen real' : 'Estimación'} · Vence {dateLabel(p.dueDate)}</p></div><button type="button" className={button} onClick={() => openPlan(p)}>Editar plan</button></div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {([['Total del resumen o estimación', money(p.total)], ['Mínimo informado', p.minimum === null ? 'Sin informar' : money(p.minimum)], ['Pagado y vinculado', values.paid.toFormattedString()], ['Pago previsto total', p.planned === null ? 'Sin decidir' : money(p.planned)], ['Falta pagar según plan', values.plannedRemaining?.toFormattedString() || 'Sin decidir'], ['Saldo después del plan', values.financedAfterPlan?.toFormattedString() || 'Sin decidir']] as const).map(([text, value]) => <div key={text}><dt className="text-xs text-gray-500">{text}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
          </dl>
          {values.belowMinimum && <p role="status" className="text-sm text-amber-600 dark:text-amber-400">El pago previsto no alcanza el mínimo informado en este resumen.</p>}
          {values.afterDueDate && <p role="status" className="text-sm text-amber-600 dark:text-amber-400">La fecha del pago previsto es posterior al vencimiento del resumen.</p>}
        <button type="button" className={button} onClick={() => { setPlanId(p.id); setPaymentId(''); setAllocation(0); open('payment'); }}>Vincular un pago registrado</button>
          {snapshot.payments.flatMap(payment => payment.allocations.filter(a => a.planId === p.id).map(a => <p className="flex flex-wrap items-center justify-between gap-2 text-xs" key={payment.id}>{dateLabel(payment.date)} · {money(a.amount)}<button type="button" className={button} disabled={busy} onClick={() => void removeAllocation(payment.id, p.id, a.revision)}>Quitar vínculo</button></p>))}
        </article>;
      })}
      <h3 className="font-bold">Facturas pendientes de pago</h3>
      <div className={box + ' divide-y divide-gray-200 dark:divide-gray-800'}>{snapshot.bills.filter(b => Money.fromAmount(b.amount).subtract(b.payments.reduce((sum, p) => sum.add(p.amount), Money.zero())).isPositive()).map(b => <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={b.id}><div><p className="text-sm font-semibold">{b.description}</p><p className="text-xs text-gray-500">{b.dueDate ? 'Vence ' + dateLabel(b.dueDate) : 'Falta fecha de vencimiento'} · {money(b.amount)}</p></div><button type="button" className={button} onClick={() => openBill(b.id)}>Vencimiento y gasto fijo</button></div>)}</div>
    </>}
    {form && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="monthly-cash-title" onKeyDown={e => { if (e.key === 'Escape' && !busy) setForm(null); }}>
      <div className={box + ' flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden'}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800"><h3 id="monthly-cash-title" className="font-bold">{form === 'card' ? 'Agregar tarjeta' : form === 'plan' ? 'Resumen o estimación de pago' : form === 'payment' ? 'Vincular pago registrado' : 'Vencimiento de la factura'}</h3><button aria-label="Cerrar formulario de flujo mensual" type="button" className={button} disabled={busy} onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={e => void save(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            {form === 'card' && <>
              <label className={label}>Nombre de la tarjeta<input required maxLength={80} className={input} value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Tarjeta y banco" /></label>
              <label className={label}>Día habitual de cierre<input required type="number" min="1" max="31" className={input} value={closingDay} onChange={e => setClosingDay(e.target.value)} /></label>
              <label className={label}>Día habitual de vencimiento<input required type="number" min="1" max="31" className={input} value={dueDay} onChange={e => setDueDay(e.target.value)} /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={cardActive} onChange={e => setCardActive(e.target.checked)} />Tarjeta activa para planificar meses futuros</label>
              <p className="text-xs text-gray-500">Desactivarla conserva sus resúmenes, pagos y deuda.</p>
              <p className="text-xs text-gray-500">Cada resumen usa su fecha real de vencimiento. No aplicamos un traslado automático de un mes.</p>
            </>}
            {form === 'plan' && plan && <>
              <label className={label}>Tarjeta<SearchableSelect aria-label="Tarjeta del resumen" required disabled={planLocked} className={input} value={plan.cardId} onChange={e => setPlanField({ cardId: e.target.value })}><option value="">Seleccioná una tarjeta</option>{snapshot?.cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</SearchableSelect></label>
              <label className={label}>Mes del vencimiento<input required type="month" disabled={planLocked} className={input} value={plan.month} onChange={e => setPlanField({ month: e.target.value })} /></label>
              <label className={label}>Origen<SearchableSelect aria-label="Origen del importe de tarjeta" className={input} value={plan.source} onChange={e => setPlanField({ source: e.target.value as CardCashPlan['source'] })}><option value="statement">Resumen real del banco</option><option value="estimate">Estimación para un mes futuro</option></SearchableSelect></label>
              <label className={label}>Fecha de cierre del resumen<input required={plan.source === 'statement'} type="date" className={input} value={plan.closingDate || ''} onChange={e => setPlanField({ closingDate: e.target.value || null })} /></label>
              <label className={label}>Vencimiento real o previsto<input required type="date" className={input} value={plan.dueDate} onChange={e => setPlanField({ dueDate: e.target.value })} /></label>
              <label className={label}>Total del resumen o estimación<FormattedNumberInput className={input} value={plan.total} onChange={total => setPlanField({ total })} /></label>
              <label className={label}>Mínimo informado por el banco<FormattedNumberInput className={input} value={plan.minimum ?? 0} onChange={minimum => setPlanField({ minimum })} /><small className="font-normal">{plan.minimum === null ? 'Sin informar. Para un resumen real, ingresá el valor del banco, incluso si es cero.' : 'Valor informado; no se calcula un porcentaje.'}</small></label>
              <label className={label}>Cuánto voy a pagar<SearchableSelect aria-label="Cuánto voy a pagar" className={input} value={payMode} onChange={e => { setPayMode(e.target.value); if (e.target.value !== 'unplanned' && !plan.plannedDate) setPlanField({ plannedDate: plan.dueDate || null }); }}><option value="unplanned">Todavía no lo decidí</option><option value="full">El total</option><option value="minimum" disabled={plan.minimum === null}>El mínimo informado</option><option value="custom">Otro importe, incluido cero</option></SearchableSelect></label>
              {payMode === 'custom' && <label className={label}>Pago previsto total<FormattedNumberInput className={input} value={customPayment} onChange={setCustomPayment} /></label>}
              {payMode !== 'unplanned' && <label className={label}>Fecha en que planeo pagar<input required type="date" className={input} value={plan.plannedDate || ''} onChange={e => setPlanField({ plannedDate: e.target.value })} /></label>}
              <p className="text-xs text-gray-500">Guardar este plan no registra un pago. El total del resumen ya incluye sus consumos y cuotas: no los cargues otra vez como salida de dinero.</p>
            </>}
            {form === 'payment' && <>
              <p className="text-sm">Elegí un pago posterior al cierre que no esté ya descontado en el total del resumen. Vincularlo no vuelve a debitar efectivo ni banco.</p>
              <label className={label}>Pago registrado<SearchableSelect aria-label="Pago de tarjeta registrado" required className={input} value={paymentId} onChange={e => setPaymentId(e.target.value)}><option value="">Seleccioná un pago</option>{snapshot?.payments.filter(p => Money.fromAmount(p.amount).subtract(p.allocations.reduce((sum, a) => sum.add(a.amount), Money.zero())).isPositive()).map(p => <option key={p.id} value={p.id}>{dateLabel(p.date)} · {p.description} · {money(p.amount)}</option>)}</SearchableSelect></label>
              {selectedPayment && <p className="text-xs">Disponible para vincular: {paymentAvailable.toFormattedString()}</p>}
              <label className={label}>Importe de ese pago que corresponde al resumen<FormattedNumberInput className={input} value={allocation} onChange={setAllocation} /></label>
            </>}
            {form === 'bill' && selectedBill && <>
              <p className="text-sm font-semibold">{selectedBill.description} · {money(selectedBill.amount)}</p>
              <label className={label}>Fecha de vencimiento<input required type="date" className={input} value={billDate} onChange={e => setBillDate(e.target.value)} /></label>
              <label className={label}>Reemplaza un gasto fijo estimado<SearchableSelect aria-label="Gasto fijo que reemplaza la factura" className={input} value={expenseId} onChange={e => setExpenseId(e.target.value)}><option value="">Es un gasto adicional</option>{snapshot?.expenses.map(e => <option key={e.id} value={e.id}>{e.supplierName} · {e.concept}</option>)}</SearchableSelect></label>
              {expenseId && <label className={label}>Mes del presupuesto que reemplaza<input required type="month" className={input} value={budgetMonth} onChange={e => setBudgetMonth(e.target.value)} /></label>}
              <p className="text-xs text-gray-500">Si vinculás un gasto fijo y su mes, se usa la factura en lugar de esa estimación. Los pagos registrados se descuentan del pendiente.</p>
            </>}
            {formError && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600">{formError}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-800"><button type="button" className={button} disabled={busy} onClick={() => setForm(null)}>Cancelar</button><button type="submit" className={primary} disabled={busy || !snapshot}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
        </form>
      </div>
    </div>}
  </section>;
}
