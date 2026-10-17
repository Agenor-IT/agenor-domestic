import React from 'react';
import { Money } from '../../domain/shared/Money';

interface NoExtraScenarioPanelProps {
  months: string[];
  income: Money[];
  expense: Money[];
  openingBalance: number;
  loadError?: string | null;
}

export const NoExtraScenarioPanel: React.FC<NoExtraScenarioPanelProps> = ({
  months, income, expense, openingBalance, loadError
}) => {
  let balance = openingBalance;
  const rows = months.map((month, index) => {
    const cashIn = income[index]?.toAmount() || 0;
    const cashOut = expense[index]?.toAmount() || 0;
    balance = Math.round((balance + cashIn - cashOut) * 100) / 100;
    return { month, cashIn, cashOut, balance };
  });

  if (loadError) return <div role="alert" className="rounded-xl border border-amber-500 p-4 text-sm">{loadError}</div>;

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Saldo inicial del escenario: {Money.fromAmount(openingBalance).toFormattedString()}.
        Incluye sólo fuentes y egresos presupuestados activos; no supone aportes de rescate.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">No hay períodos proyectados.</p>
      ) : rows.map(row => (
        <div key={row.month} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#0F172A]">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">{row.month}</strong>
            <strong className={row.balance < 0 ? 'text-red-600' : 'text-emerald-600'}>
              {Money.fromAmount(row.balance).toFormattedString()}
            </strong>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Ingresos {Money.fromAmount(row.cashIn).toFormattedString()} · Egresos {Money.fromAmount(row.cashOut).toFormattedString()}
          </p>
        </div>
      ))}
    </section>
  );
};
