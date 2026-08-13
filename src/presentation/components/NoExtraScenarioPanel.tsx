import React from 'react';
import { INITIAL_ACTUAL_STATE } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { AlertCircle } from 'lucide-react';

export const NoExtraScenarioPanel: React.FC = () => {
  const S = INITIAL_ACTUAL_STATE.scenario_no_extra;

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3 bg-red-50/40 dark:bg-rose-950/40">
        <div>
          <h2 className="text-lg font-bold text-[#b54747] dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {S.title}
          </h2>
          <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{S.note}</p>
        </div>
        <span className="text-xs font-bold text-red-800 dark:text-rose-300 bg-red-100 dark:bg-rose-950 px-3 py-1 rounded-full border border-red-200 dark:border-rose-800">
          Simulación Persistente Base
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-gray-200 dark:border-slate-700 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-slate-700">
        <div className="p-4">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Caja Ago tras Mayra + Clever</span>
          <strong className="text-lg font-bold text-[#12355b] dark:text-sky-400 mt-1 block table-cell-num">
            {Money.fromAmount(S.august.available_after_receivables).toFormattedString()}
          </strong>
        </div>
        <div className="p-4 bg-red-50/30 dark:bg-rose-950/30">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Arrastre Impago a Sep</span>
          <strong className="text-lg font-bold text-[#b54747] dark:text-rose-400 mt-1 block table-cell-num">
            -{Money.fromAmount(S.august.carryover_total).toFormattedString()}
          </strong>
        </div>
        <div className="p-4 bg-red-50/30 dark:bg-rose-950/30">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Déficit Acumulado Sep</span>
          <strong className="text-lg font-bold text-[#b54747] dark:text-rose-400 mt-1 block table-cell-num">
            -{Money.fromAmount(S.monthly[0].accumulated_gap).toFormattedString()}
          </strong>
        </div>
        <div className="p-4 bg-red-100/40 dark:bg-rose-950/60">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Stock Deuda Problemática Fin Ago</span>
          <strong className="text-lg font-bold text-[#b54747] dark:text-rose-400 mt-1 block table-cell-num">
            {Money.fromAmount(S.debt_stock_total).toFormattedString()}
          </strong>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-3">Proyección de Brecha de Caja (Sep-Dic 26)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-600 dark:text-slate-300">
            <thead className="bg-gray-50 dark:bg-slate-700/60 text-gray-700 dark:text-slate-200 uppercase font-bold border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Mes</th>
                <th className="py-2.5 px-3 text-right">Ingresos Base</th>
                <th className="py-2.5 px-3 text-right">Egresos Base</th>
                <th className="py-2.5 px-3 text-right">Déficit del Mes</th>
                <th className="py-2.5 px-3 text-right">Déficit Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {S.monthly.map((m, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50">
                  <td className="py-2.5 px-3 font-bold text-[#172033] dark:text-slate-100">{m.month}</td>
                  <td className="py-2.5 px-3 text-right table-cell-num text-[#0f8a5f] dark:text-emerald-400 font-semibold">{Money.fromAmount(m.income).toFormattedString()}</td>
                  <td className="py-2.5 px-3 text-right table-cell-num text-gray-700 dark:text-slate-300">{Money.fromAmount(m.base_expense).toFormattedString()}</td>
                  <td className="py-2.5 px-3 text-right table-cell-num text-[#b54747] dark:text-rose-400 font-semibold">-{Money.fromAmount(m.monthly_gap).toFormattedString()}</td>
                  <td className="py-2.5 px-3 text-right table-cell-num text-[#b54747] dark:text-rose-400 font-bold">-{Money.fromAmount(m.accumulated_gap).toFormattedString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
