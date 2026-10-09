import React, { useState } from 'react';
import { TableSearchFilter } from './TableSearchFilter';
import { Money } from '../../domain/shared/Money';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  PlusCircle,
  Pencil,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  Building2,
  Wallet
} from 'lucide-react';

export interface TransactionItem {
  id: string;
  description: string;
  amount: number;
  direction: 'income' | 'expense';
  paymentMethod: string;
  occurredOn: string;
  opNumber?: string;
  counterparty?: string;
  operationType?: string;
  paymentCondition?: 'contado' | 'cta_cte';
}

interface TransactionsPanelProps {
  transactions: TransactionItem[];
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: TransactionItem) => void;
  onDeleteTransaction: (id: string) => void;
  paymentMethods: CustomPaymentMethod[];
}

export const TransactionsPanel: React.FC<TransactionsPanelProps> = ({
  transactions,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  paymentMethods
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = transactions.filter((tx) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = tx.description.toLowerCase().includes(searchLower) ||
      (tx.counterparty || '').toLowerCase().includes(searchLower) ||
      (tx.opNumber || '').toLowerCase().includes(searchLower) ||
      tx.occurredOn.includes(searchTerm) ||
      tx.amount.toString().includes(searchTerm);
    const matchesType = filterType === 'all' || tx.direction === filterType;
    return matchesSearch && matchesType;
  });

  const getMethodName = (methodId: string, condition?: string) => {
    if (condition === 'cta_cte' || methodId === 'cta_cte') return 'Cuenta Corriente';
    const found = paymentMethods.find((p) => p.id === methodId);
    if (found) return found.name;
    if (methodId === 'cash' || methodId === 'efectivo') return 'Efectivo';
    if (methodId === 'card') return 'Tarjeta';
    if (methodId === 'debit' || methodId === 'bank' || methodId === 'banco') return 'Banco';
    return methodId;
  };

  const getMethodIcon = (methodId: string, condition?: string) => {
    if (condition === 'cta_cte' || methodId === 'cta_cte') return <CreditCard className="w-3.5 h-3.5 text-blue-400" />;
    const found = paymentMethods.find((p) => p.id === methodId);
    const type = found ? found.type : (methodId === 'cash' ? 'cash' : methodId === 'card' ? 'card' : 'bank');
    switch (type) {
      case 'cash': return <Wallet className="w-3.5 h-3.5 text-emerald-500" />;
      case 'bank': return <Building2 className="w-3.5 h-3.5 text-blue-500" />;
      case 'card': return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Wallet className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const totalIncome = transactions.filter(t => t.direction === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.direction === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netFlow = totalIncome - totalExpense;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* TARJETAS RESUMEN DE TRANSACCIONES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block truncate">
              Total Ingresos
            </span>
            <strong className="text-xl sm:text-2xl font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num mt-1 block truncate" title={Money.fromAmount(totalIncome).toFormattedString()}>
              {Money.fromAmount(totalIncome).toFormattedString()}
            </strong>
          </div>
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] sm:text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block truncate">
              Total Egresos
            </span>
            <strong className="text-xl sm:text-2xl font-bold text-[#b54747] dark:text-red-400 table-cell-num mt-1 block truncate" title={Money.fromAmount(totalExpense).toFormattedString()}>
              {Money.fromAmount(totalExpense).toFormattedString()}
            </strong>
          </div>
          <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl shrink-0">
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] sm:text-xs font-bold text-[#12355b] dark:text-blue-400 uppercase tracking-wider block truncate">
              Flujo Neto
            </span>
            <strong className={`text-xl sm:text-2xl font-bold table-cell-num mt-1 block truncate ${netFlow >= 0 ? 'text-[#0f8a5f] dark:text-emerald-400' : 'text-[#b54747] dark:text-red-400'}`} title={Money.fromAmount(netFlow).toFormattedString()}>
              {Money.fromAmount(netFlow).toFormattedString()}
            </strong>
          </div>
          <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl shrink-0">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL TABLA */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* ENCABEZADO CON BUSCADOR Y FILTROS */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1E293B]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <TableSearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Buscar por N° OP, contraparte, concepto, fecha o monto..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                  : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Todas ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('income')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Ingresos (+)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'expense'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Egresos (-)
            </button>

            <button
              onClick={onOpenNewTransaction}
              className="flex items-center justify-center gap-1.5 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 sm:py-2 rounded-xl shadow-md transition-all cursor-pointer w-full sm:w-auto sm:ml-2"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Nueva Operación</span>
            </button>
          </div>
        </div>

        {/* TABLA DE OPERACIONES */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-[#1E293B] text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 z-10 bg-gray-100 dark:bg-[#1E293B] lg:static lg:bg-transparent lg:dark:bg-transparent">N° OP</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Fecha</th>
                <th className="py-3.5 px-4">Contraparte</th>
                <th className="py-3.5 px-4">Concepto / Leyenda</th>
                <th className="py-3.5 px-4">Condición / Medio</th>
                <th className="py-3.5 px-4 text-right">Monto ($ ARS)</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                    No se encontraron operaciones registradas con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0088FF] dark:text-blue-400 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-[#0F172A] lg:static lg:bg-transparent lg:dark:bg-transparent">
                      {tx.opNumber || `OP-${tx.id.slice(-4)}`}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{tx.occurredOn}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {tx.counterparty || 'Cliente / Proveedor General'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{tx.description}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                          tx.paymentCondition === 'cta_cte'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {tx.paymentCondition === 'cta_cte' ? '📄 Cta Cte' : '⚡ Contado'}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          {getMethodIcon(tx.paymentMethod, tx.paymentCondition)}
                          <span>{getMethodName(tx.paymentMethod, tx.paymentCondition)}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold text-sm table-cell-num whitespace-nowrap ${
                      tx.direction === 'income' ? 'text-[#0f8a5f] dark:text-emerald-400' : 'text-[#b54747] dark:text-red-400'
                    }`}>
                      {tx.direction === 'income' ? '+' : '-'}{Money.fromAmount(tx.amount).toFormattedString()}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Editar operación"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar operación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE TABLA / RESUMEN */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1E293B]/40 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>Mostrando {filteredTransactions.length} de {transactions.length} movimientos</span>
          <span>Paginación automática activa</span>
        </div>
      </div>
    </div>
  );
};
