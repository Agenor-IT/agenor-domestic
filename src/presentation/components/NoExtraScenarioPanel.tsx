import React from 'react';
import { INITIAL_ACTUAL_STATE } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { ShieldAlert, TrendingDown, DollarSign } from 'lucide-react';

export const NoExtraScenarioPanel: React.FC = () => {
  const S = INITIAL_ACTUAL_STATE.scenario_no_extra;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
          <div className="bg-amber-600 text-white p-2.5 rounded-xl shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">Proyección Base Sin Ingreso Extra</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Escenario de estrés financiero conservador</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-5 bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wider mb-2">
              <TrendingDown className="w-4 h-4" />
              Remanente Negativo Agosto
            </div>
            <strong className="block text-2xl font-bold text-[#b54747] dark:text-red-400 table-cell-num">
              {Money.fromAmount(S.august.carryover_total).toFormattedString()}
            </strong>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 font-medium">Faltante de caja proyectado a fin de mes</p>
          </div>

          <div className="p-5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider mb-2">
              <DollarSign className="w-4 h-4" />
              Brecha Acumulada Septiembre
            </div>
            <strong className="block text-2xl font-bold text-amber-900 dark:text-amber-400 table-cell-num">
              {Money.fromAmount(S.monthly[0]?.accumulated_gap || 0.00).toFormattedString()}
            </strong>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 font-medium">Acumulado proyectado para el próximo mes</p>
          </div>

          <div className="p-5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl">
            <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-xs uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4" />
              Deuda Total con Problema
            </div>
            <strong className="block text-2xl font-bold text-[#6d4db3] dark:text-purple-400 table-cell-num">
              {Money.fromAmount(S.debt_stock_total).toFormattedString()}
            </strong>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 font-medium">Pasivos totales bajo revisión</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl">
          <h4 className="text-xs font-bold text-[#172033] dark:text-white mb-2">Estrategia Recomendada:</h4>
          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc pl-4 font-medium">
            <li>Privilegiar pagos prioritarios definidos en la tabla de orden de prioridad (`dom_payment_priorities`).</li>
            <li>Diferir vencimientos no urgentes a través de medios de pago en cuotas.</li>
            <li>Asignar inmediatamente cobros confirmados a la cancelación del remanente negativo de agosto.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
