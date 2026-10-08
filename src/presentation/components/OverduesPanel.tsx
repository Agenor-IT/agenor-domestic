import React, { useState } from 'react';
import { INITIAL_ACTUAL_STATE } from '../../domain/shared/initialSeedData';
import { Money } from '../../domain/shared/Money';
import { TableSearchFilter } from './TableSearchFilter';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export const OverduesPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending' | 'receivables'>('pending');

  const pendingList = INITIAL_ACTUAL_STATE.pending_required.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const receivablesList = INITIAL_ACTUAL_STATE.receivables.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <TableSearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Buscar compromiso o cobro..."
          extraControls={
            <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pagar Prioritario ({pendingList.length})
              </button>
              <button
                onClick={() => setActiveTab('receivables')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'receivables'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Cobros Pendientes ({receivablesList.length})
              </button>
            </div>
          }
        />

        <div className="p-6">
          {activeTab === 'pending' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3 px-4">Prioridad / Compromiso</th>
                    <th className="py-3 px-4">Estado / Vencimiento</th>
                    <th className="py-3 px-4 text-right">Monto Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {pendingList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-red-50/20 dark:hover:bg-red-950/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        {item.label}
                      </td>
                      <td className="py-3 px-4 font-medium text-red-700 dark:text-red-400">
                        {item.note || 'Pendiente de cancelación'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#b54747] dark:text-red-400 table-cell-num text-sm">
                        {Money.fromAmount(item.amount).toFormattedString()}
                      </td>
                    </tr>
                  ))}
                  {pendingList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-400 font-medium">
                        No se encontraron obligaciones pendientes coincidentes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3 px-4">Cliente / Deudor</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Monto a Cobrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {receivablesList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        {item.label}
                      </td>
                      <td className="py-3 px-4 font-medium text-emerald-700 dark:text-emerald-400">
                        Pendiente de cobro
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num text-sm">
                        {Money.fromAmount(item.amount).toFormattedString()}
                      </td>
                    </tr>
                  ))}
                  {receivablesList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-400 font-medium">
                        No se encontraron cobros pendientes coincidentes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
