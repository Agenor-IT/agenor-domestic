import React, { useState } from 'react';
import { PaymentPriority } from '../../domain/priorities/PaymentPriority';
import { TableSearchFilter } from './TableSearchFilter';
import { MoveUp, MoveDown, Save } from 'lucide-react';

interface PaymentPrioritiesPanelProps {
  priorities: PaymentPriority[];
  onSave: (updatedPriorities: PaymentPriority[]) => void;
}

export const PaymentPrioritiesPanel: React.FC<PaymentPrioritiesPanelProps> = ({ priorities, onSave }) => {
  const [list, setList] = useState<PaymentPriority[]>(priorities);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const next = [...list];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    next.forEach((item, idx) => item.updatePriority(idx + 1));
    setList(next);
  };

  const handleSave = () => {
    onSave(list);
  };

  const filteredList = list.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.entityIdentifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
      <TableSearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Buscar acreedor o compromiso de pago..."
        extraControls={
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#12355b] dark:bg-[#0088FF] hover:bg-[#0d2745] dark:hover:bg-[#0077EE] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Prioridades</span>
          </button>
        }
      />

      <div className="p-6">
        <div className="space-y-3">
          {filteredList.map((item) => {
            const originalIdx = list.findIndex(l => l.entityIdentifier === item.entityIdentifier);
            return (
              <div
                key={item.entityIdentifier}
                className="flex flex-wrap items-center justify-between p-4 bg-gray-50 dark:bg-[#1E293B]/70 hover:bg-blue-50/40 dark:hover:bg-blue-950/40 border border-gray-200 dark:border-gray-800 rounded-xl transition-all gap-3"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-[#12355b] dark:bg-[#0088FF] text-white text-xs font-bold flex items-center justify-center shadow-sm shrink-0">
                    #{item.priorityOrder}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {item.label}
                      <span className="text-[10px] font-semibold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full uppercase">
                        {item.entityType}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.entityIdentifier}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={originalIdx === 0}
                    onClick={() => movePriority(originalIdx, 'up')}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-white text-gray-700 dark:text-gray-200 transition-all cursor-pointer"
                    title="Subir prioridad"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    disabled={originalIdx === list.length - 1}
                    onClick={() => movePriority(originalIdx, 'down')}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-white text-gray-700 dark:text-gray-200 transition-all cursor-pointer"
                    title="Bajar prioridad"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
