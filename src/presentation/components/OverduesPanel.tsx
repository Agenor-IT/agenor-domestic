import React, { useState } from 'react';
import { TransactionItem } from './TransactionsPanel';
import { Money } from '../../domain/shared/Money';
import { TableSearchFilter } from './TableSearchFilter';
import { Clock3, CheckCircle } from 'lucide-react';

export const OverduesPanel: React.FC<{ transactions: TransactionItem[] }> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending' | 'receivables'>('pending');

  const openOperations = transactions
    .filter(item => item.paymentCondition === 'cta_cte' && item.journalEntryId != null)
    .map(item => {
      const settled = transactions.filter(payment => payment.settlesTransactionId === item.id)
        .reduce((sum, payment) => sum + payment.amount, 0);
      return {
        direction: item.direction,
        label: `${item.counterparty || item.description} · ${item.opNumber || item.occurredOn}`,
        amount: Math.round((item.amount - settled) * 100) / 100,
        note: 'Sin vencimiento registrado'
      };
    }).filter(item => item.amount > 0 && item.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const pendingList = openOperations.filter(item => item.direction === 'expense');
  const receivablesList = openOperations.filter(item => item.direction === 'income');

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 dark:text-gray-400">Saldos de operaciones a cuenta corriente, descontando cobros y pagos registrados. Sin fecha de vencimiento no se califican como atrasos.</p>
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <TableSearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Buscar compromiso o cobro..."
          extraControls={
            <div className="flex w-full sm:w-auto bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeTab === 'pending'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Por pagar ({pendingList.length})
              </button>
              <button
                onClick={() => setActiveTab('receivables')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeTab === 'receivables'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Por cobrar ({receivablesList.length})
              </button>
            </div>
          }
        />

        <div className="p-3 sm:p-4 lg:p-6">
          {activeTab === 'pending' ? (
            <div className="mobile-card-container overflow-x-auto scrollbar-thin border border-gray-200 dark:border-gray-800 rounded-xl">
              <table className="mobile-record-table w-full min-w-[540px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3 px-4 sticky left-0 bg-gray-100 dark:bg-gray-800/80 z-10">Compromiso</th>
                    <th className="py-3 px-4 whitespace-nowrap">Estado / Vencimiento</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Monto Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {pendingList.map((item, idx) => (
                    <tr key={idx} className="record-row hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-colors">
                      <td data-label="Compromiso" data-primary="true" className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-[#0F172A] z-10">
                        <span className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-blue-500 shrink-0" />{item.label}</span>
                      </td>
                      <td data-label="Estado / Vencimiento" className="py-3 px-4 font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {item.note || 'Pendiente de cancelación'}
                      </td>
                      <td data-label="Monto pendiente" className="py-3 px-4 text-right font-bold text-[#b54747] dark:text-red-400 table-cell-num text-sm whitespace-nowrap">
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
            <div className="mobile-card-container overflow-x-auto scrollbar-thin border border-gray-200 dark:border-gray-800 rounded-xl">
              <table className="mobile-record-table w-full min-w-[540px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3 px-4 sticky left-0 bg-gray-100 dark:bg-gray-800/80 z-10">Cliente / Deudor</th>
                    <th className="py-3 px-4 whitespace-nowrap">Estado</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Monto a Cobrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {receivablesList.map((item, idx) => (
                    <tr key={idx} className="record-row hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-colors">
                      <td data-label="Cliente / Deudor" data-primary="true" className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-[#0F172A] z-10">
                        <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />{item.label}</span>
                      </td>
                      <td data-label="Estado" className="py-3 px-4 font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        Pendiente de cobro
                      </td>
                      <td data-label="Monto a cobrar" className="py-3 px-4 text-right font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num text-sm whitespace-nowrap">
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
