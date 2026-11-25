import { useEffect, useState } from 'react';
import { ArrowLeft, Landmark } from 'lucide-react';
import { PageHeader } from '../../src/presentation/components/PageHeader';
import type { DebtRepository } from '../application/debtRepository';
import type { Debt, InstallmentStatus } from '../domain/debt';
import { DebtProjection } from './DebtProjection';

export function DebtDetailPage({ debt, repository, onBack }: { debt: Debt; repository: DebtRepository; onBack: () => void }) {
  const [statuses, setStatuses] = useState<Record<number, InstallmentStatus>>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!debt.terms) return;
    let active = true;
    setError('');
    setStatuses(undefined);
    void repository.installmentStatuses(debt.id).then(result => {
      if (active) setStatuses(result);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron consultar las cuotas.');
    });
    return () => { active = false; };
  }, [debt.id, debt.terms, repository, revision]);

  return <>
    <PageHeader title={debt.creditor} subtitle={debt.type} icon={Landmark}
      action={<button type="button" className="debt-field flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Volver a deudas
      </button>} />
    {debt.operationNumber && <dl className="grid gap-3 rounded-xl border border-gray-200 p-4 text-sm dark:border-[#28364e] sm:grid-cols-3">
      <div><dt>Número de operación</dt><dd className="font-semibold">{debt.operationNumber}</dd></div>
      <div><dt>Relación de deuda</dt><dd className="font-semibold">{debt.relationship || '—'}</dd></div>
      <div><dt>Tasa nominal anual</dt><dd className="font-semibold">{debt.nominalAnnualRate?.toLocaleString('es-AR', { maximumFractionDigits: 4 })} %</dd></div>
    </dl>}
    {debt.terms && !statuses && !error && <p role="status" className="text-sm">Consultando estado de cuotas…</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error} <button type="button" onClick={() => setRevision(value => value + 1)} className="font-bold underline">Reintentar</button></p>}
    <DebtProjection terms={debt.terms} statuses={statuses} />
  </>;
}
