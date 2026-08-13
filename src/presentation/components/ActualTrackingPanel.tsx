import React from 'react';
import { INITIAL_ACTUAL_STATE } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { CheckCircle2, CreditCard } from 'lucide-react';

export const ActualTrackingPanel: React.FC = () => {
  const A = INITIAL_ACTUAL_STATE;
  
  const totalAvailable = A.availability.reduce((sum, item) => sum + item.amount, 0);
  const totalReceivable = A.receivables.reduce((sum, item) => sum + item.amount, 0);
  const totalPending = A.pending_required.reduce((sum, item) => sum + item.amount, 0);
  const afterCollections = totalAvailable + totalReceivable;
  const shortage = Math.max(0, totalPending - afterCollections);

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3 bg-gray-50/50 dark:bg-slate-800/80">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#0f8a5f] dark:text-emerald-400" />
            Seguimiento Real · Agosto
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Estado de disponibilidad y obligaciones al {A.cutoff}</p>
        </div>
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          Real + Pendiente Confirmado
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-gray-200 dark:border-slate-700 divide-x divide-gray-200 dark:divide-slate-700">
        <div className="p-4">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Liquidez Actual</span>
          <strong className="text-lg font-bold text-[#12355b] dark:text-sky-400 mt-1 block table-cell-num">{Money.fromAmount(totalAvailable).toFormattedString()}</strong>
        </div>
        <div className="p-4">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Pendiente de Cobro</span>
          <strong className="text-lg font-bold text-[#0f8a5f] dark:text-emerald-400 mt-1 block table-cell-num">{Money.fromAmount(totalReceivable).toFormattedString()}</strong>
        </div>
        <div className="p-4">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Liquidez tras Cobros</span>
          <strong className="text-lg font-bold text-[#12355b] dark:text-sky-400 mt-1 block table-cell-num">{Money.fromAmount(afterCollections).toFormattedString()}</strong>
        </div>
        <div className="p-4">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Obligaciones Pendientes</span>
          <strong className="text-lg font-bold text-[#b54747] dark:text-rose-400 mt-1 block table-cell-num">{Money.fromAmount(totalPending).toFormattedString()}</strong>
        </div>
        <div className="p-4 bg-red-50/50 dark:bg-rose-950/40">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Faltante Base Ago</span>
          <strong className="text-lg font-bold text-[#b54747] dark:text-rose-400 mt-1 block table-cell-num">{Money.fromAmount(shortage).toFormattedString()}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/30 dark:bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">Cobrado / Disponible</h3>
          <div className="space-y-2">
            {A.availability.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                <span className="text-gray-700 dark:text-slate-300 font-medium">{item.label}</span>
                <span className="font-bold text-[#172033] dark:text-slate-100 table-cell-num">{Money.fromAmount(item.amount).toFormattedString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/30 dark:bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">Falta Cobrar</h3>
          <div className="space-y-2">
            {A.receivables.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                <span className="text-gray-700 dark:text-slate-300 font-medium">{item.label}</span>
                <span className="font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num">{Money.fromAmount(item.amount).toFormattedString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50/30 dark:bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">Falta Pagar Prioritario</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {A.pending_required.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                <div>
                  <span className="text-gray-700 dark:text-slate-300 font-medium block">{item.label}</span>
                  {item.note && <span className="text-[10px] text-gray-400 dark:text-slate-500 block">{item.note}</span>}
                </div>
                <span className="font-bold text-[#b54747] dark:text-rose-400 table-cell-num">{Money.fromAmount(item.amount).toFormattedString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-6 py-3 border-t border-amber-200 dark:border-amber-900/60 text-xs flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
        <span><strong>Compras Naranja X (Ago-26):</strong> $244.352,30 registradas. Las compras en Z quedan asignadas al calendario de cuotas.</span>
      </div>
    </section>
  );
};
