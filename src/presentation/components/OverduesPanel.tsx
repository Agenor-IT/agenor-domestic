import React, { useState } from 'react';
import { INITIAL_MONTHS } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { ShieldAlert } from 'lucide-react';

export const OverduesPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payments' | 'balances'>('payments');

  const overduesData = {
    payments: [
      { label: "Monotributo ARCA", values: [0,0,0,0,0,0,0,0,0,0,1265993.26,0,0,0,0,0,0] },
      { label: "Nación solo firma", values: [0,0,0,0,0,0,0,0,0,0,439807.57,2160192.43,0,0,0,0,0] },
      { label: "Préstamo Supervielle", values: [0,0,0,0,0,0,0,0,0,0,0,365267.47,0,0,0,0,0] },
      { label: "Hipotecario 2", values: [0,0,0,0,0,0,0,0,0,0,0,74318.11,103647.09,0,0,0,0] },
      { label: "Hipotecario 1", values: [0,0,0,0,0,0,0,0,0,0,0,0,1236859.57,0,0,0,0] },
      { label: "Nación SGR", values: [0,0,0,0,0,0,0,0,0,0,0,0,500000.00,0,0,0,0] }
    ],
    balances: [
      { label: "Saldo ARCA", values: [1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,1265993.26,0,0,0,0,0,0,0] },
      { label: "Saldo firma", values: [2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2600000.00,2160192.43,0,0,0,0,0,0] },
      { label: "Saldo Supervielle", values: [365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,365267.47,0,0,0,0,0,0] },
      { label: "Saldo Hipotecario 2", values: [177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,177965.20,103647.09,0,0,0,0,0] },
      { label: "Saldo Hipotecario 1", values: [1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,1236859.57,0,0,0,0,0] },
      { label: "Saldo SGR", values: [500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,500000.00,0,0,0,0,0] }
    ]
  };

  const currentRows = activeTab === 'payments' ? overduesData.payments : overduesData.balances;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 p-6 transition-colors">
      <div className="flex justify-between items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#b54747] dark:text-rose-400" />
            Control de Atrasos y Moras Proyectadas
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Plan de regularización de compromisos vencidos por mes</p>
        </div>

        <div className="flex gap-1.5 bg-gray-100 dark:bg-slate-700 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'payments'
                ? 'bg-[#12355b] dark:bg-sky-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            Pagos Proyectados
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'balances'
                ? 'bg-[#12355b] dark:bg-sky-600 text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            Saldos Restantes
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#12355b] dark:bg-slate-900 text-white uppercase font-bold">
            <tr>
              <th className="py-2.5 px-3 min-w-[220px]">Deuda / Compromiso</th>
              {INITIAL_MONTHS.map((m, idx) => (
                <th key={idx} className="py-2.5 px-2 text-right min-w-[100px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {currentRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-slate-100">{row.label}</td>
                {row.values.map((v, vIdx) => (
                  <td key={vIdx} className="py-2.5 px-2 text-right table-cell-num font-medium text-gray-800 dark:text-slate-200">
                    {v === 0 ? '—' : Money.fromAmount(v).toFormattedString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
