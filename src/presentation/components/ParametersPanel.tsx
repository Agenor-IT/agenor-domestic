import React from 'react';
import { INITIAL_MONTHS } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { Sliders } from 'lucide-react';

interface ParametersPanelProps {
  ipcRates: number[];
  onIpcChange: (index: number, val: number) => void;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({ ipcRates, onIpcChange }) => {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 p-6 transition-colors">
      <div className="flex justify-between items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#12355b] dark:text-sky-400" />
            Parámetros Mensuales y Reajustes por IPC
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Configuración de IPC proyectado por mes. Modificar un mes recalcula automáticamente Alquiler (cuatrimestral) y Monotributo (semestral).</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 uppercase font-bold border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="py-2.5 px-3 min-w-[200px]">Parámetro</th>
              {INITIAL_MONTHS.map((m, idx) => (
                <th key={idx} className="py-2.5 px-2 text-center min-w-[85px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
            <tr>
              <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-750">IPC Mensual (%)</td>
              {ipcRates.map((rate, idx) => (
                <td key={idx} className="py-2 px-1 text-center">
                  <input
                    type="number"
                    step="0.01"
                    value={(rate * 100).toFixed(2)}
                    onChange={(e) => onIpcChange(idx, (parseFloat(e.target.value) || 0) / 100)}
                    className="w-16 text-center text-xs font-bold border border-gray-300 dark:border-slate-600 rounded py-1 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 outline-none"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-900/40">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">Base Contrato Alquiler</span>
          <strong className="text-xl font-bold text-[#12355b] dark:text-sky-400 block mt-1">{Money.fromAmount(550000).toFormattedString()}</strong>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2">Reajuste cada 4 meses acumulando los 4 IPCs previos. Desde Sep-26.</p>
        </div>

        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-900/40">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">Base Cuota Monotributo</span>
          <strong className="text-xl font-bold text-[#12355b] dark:text-sky-400 block mt-1">{Money.fromAmount(91714.67).toFormattedString()}</strong>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2">Fijo por semestre. Ajustes en Enero y Julio por IPC semestral acumulado.</p>
        </div>

        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-900/40">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">Crecimiento Mensual Emprendimiento</span>
          <strong className="text-xl font-bold text-[#0f8a5f] dark:text-emerald-400 block mt-1">{Money.fromAmount(200000).toFormattedString()} / mes</strong>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2">Sumado al IPC acumulado sobre la base de $2.165.000 (Ago-26).</p>
        </div>
      </div>
    </div>
  );
};
