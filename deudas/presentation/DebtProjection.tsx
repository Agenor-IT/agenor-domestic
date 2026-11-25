import { amortizationLabels, projectInstallments, type DebtTerms, type InstallmentStatus } from '../domain/debt';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export const money = (value: number) => ars.format(value);
export const dateLabel = (value: string) => value.split('-').reverse().join('/');

const statusLabel: Record<InstallmentStatus, string> = { paid: 'Pagada', pending: 'Pendiente', unknown: 'Sin dato' };

export function DebtProjection({ terms, statuses, projected = false }: {
  terms: DebtTerms | null; statuses?: Record<number, InstallmentStatus>; projected?: boolean;
}) {
  const rows = terms ? projectInstallments(terms) : [];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0B1329]" aria-label="Cuotas proyectadas">
      <h2 className="text-lg font-bold">Cuotas proyectadas</h2>
      {terms && rows.length > 0 ? <>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{amortizationLabels[terms.method]}. Los importes pueden ajustarse por redondeo.</p>
        <div className="my-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="block text-gray-500 dark:text-gray-400">Interés total</span><strong>{money(rows.reduce((sum, row) => sum + row.interestCents, 0) / 100)}</strong></div>
          <div><span className="block text-gray-500 dark:text-gray-400">Total proyectado</span><strong>{money(rows.reduce((sum, row) => sum + row.paymentCents, 0) / 100)}</strong></div>
        </div>
        <div className="overflow-x-auto">
          <table aria-label="Tabla de amortización mensual" className="w-full min-w-[38rem] text-right text-sm tabular-nums">
            <thead className="debt-table-heading">
              <tr>{['Cuota', 'Vencimiento', 'Capital', 'Interés', 'Total cuota', 'Saldo', 'Estado'].map(label => (
                <th scope="col" key={label} className="px-3 py-2">{label}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#1E293B]">
              {rows.map(row => <tr key={row.number}>
                <th scope="row" className="px-3 py-2">{row.number}</th>
                <td className="px-3 py-2">{dateLabel(row.dueOn)}</td>
                <td className="px-3 py-2">{money(row.principalCents / 100)}</td>
                <td className="px-3 py-2">{money(row.interestCents / 100)}</td>
                <td className="px-3 py-2 font-semibold">{money(row.paymentCents / 100)}</td>
                <td className="px-3 py-2">{money(row.balanceCents / 100)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{statusLabel[projected ? 'pending' : statuses?.[row.number] ?? 'unknown']}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </> : <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin datos suficientes para proyectar las cuotas.</p>}
    </section>
  );
}
