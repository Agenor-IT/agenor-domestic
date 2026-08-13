import React, { useState } from 'react';
import { PaymentPriority } from '../../domain/priorities/PaymentPriority';
import { ListOrdered, ArrowUp, ArrowDown, Save } from 'lucide-react';

interface PaymentPrioritiesPanelProps {
  priorities: PaymentPriority[];
  onSave: (updated: PaymentPriority[]) => void;
}

export const PaymentPrioritiesPanel: React.FC<PaymentPrioritiesPanelProps> = ({ priorities, onSave }) => {
  const [list, setList] = useState<PaymentPriority[]>(priorities);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const nextList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= nextList.length) return;

    const temp = nextList[index];
    nextList[index] = nextList[targetIndex];
    nextList[targetIndex] = temp;

    // Recalcular el orden priorityOrder
    nextList.forEach((item, idx) => {
      item.priorityOrder = idx + 1;
    });

    setList(nextList);
    setIsSaved(false);
  };

  const handleSave = () => {
    onSave(list);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 p-6 transition-colors">
      <div className="flex justify-between items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-[#12355b] dark:text-sky-400" />
            Ranking Configurable de Prioridades de Pago (`dom_payment_priorities`)
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Define el orden de preferencia para asignación de liquidez sobrante y caja. Guardado por tenant sin hardcodear lógica.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#12355b] dark:bg-sky-600 hover:bg-[#0d2642] dark:hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isSaved ? '¡Guardado!' : 'Guardar Prioridades'}
        </button>
      </div>

      <div className="space-y-2 max-w-2xl">
        {list.map((item, idx) => (
          <div
            key={item.entityIdentifier}
            className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-xl hover:border-blue-300 dark:hover:border-sky-400 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 flex items-center justify-center bg-[#12355b] dark:bg-sky-600 text-white font-bold text-xs rounded-full">
                #{item.priorityOrder}
              </span>
              <div>
                <strong className="text-xs font-bold text-gray-900 dark:text-slate-100 block">{item.label}</strong>
                <span className="text-[10px] text-gray-400 dark:text-slate-400 font-mono">{item.entityIdentifier} ({item.entityType})</span>
              </div>
            </div>

            <div className="flex gap-1">
              <button
                disabled={idx === 0}
                onClick={() => movePriority(idx, 'up')}
                className="p-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 text-gray-700 dark:text-slate-200"
                title="Subir prioridad"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                disabled={idx === list.length - 1}
                onClick={() => movePriority(idx, 'down')}
                className="p-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 text-gray-700 dark:text-slate-200"
                title="Bajar prioridad"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
