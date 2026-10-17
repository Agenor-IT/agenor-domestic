import React, { useState } from 'react';
import { Money } from '../../domain/shared/Money';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import {
  Pencil,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  Building2,
  Wallet,
  Search,
  X
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
  settlesTransactionId?: string | null;
  classificationAccountId?: number | null;
  revision?: number;
  journalEntryId?: number | null;
}

interface TransactionsPanelProps {
  transactions: TransactionItem[];
  onEditTransaction: (tx: TransactionItem) => void;
  onDeleteTransaction: (id: string) => void;
  paymentMethods: CustomPaymentMethod[];
}

export const TransactionsPanel: React.FC<TransactionsPanelProps> = ({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
  paymentMethods
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = transactions.filter((tx) => {
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch = tx.description.toLowerCase().includes(searchLower) ||
      (tx.counterparty || '').toLowerCase().includes(searchLower) ||
      (tx.opNumber || '').toLowerCase().includes(searchLower) ||
      tx.occurredOn.includes(searchLower) ||
      tx.amount.toString().includes(searchLower);
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

  return (
    <div>
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-3 dark:border-gray-800 sm:p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              aria-label="Buscar transacciones"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar transacciones"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-base text-gray-900 outline-none focus:border-[#0088FF] focus:ring-2 focus:ring-[#0088FF]/20 dark:border-gray-700 dark:bg-[#0B1329] dark:text-white"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <div role="group" aria-label="Filtrar transacciones" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-[#1E293B] md:w-auto md:min-w-64">
            {([['all', 'Todas'], ['income', 'Ingresos'], ['expense', 'Egresos']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterType(value)}
                aria-pressed={filterType === value}
                className={`min-w-0 rounded-lg px-2 py-2 text-xs font-bold transition-colors ${filterType === value ? 'bg-[#0088FF] text-white shadow-sm' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista compacta para celulares y tabletas */}
        <div className="lg:hidden">
          {filteredTransactions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{transactions.length ? 'Sin resultados' : 'Todavía no hay transacciones'}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{transactions.length ? 'Probá otra búsqueda o filtro.' : 'Cuando registres una, aparecerá acá.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredTransactions.map((tx) => (
                <li key={tx.id} className="min-w-0 space-y-3 p-4">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold text-gray-900 dark:text-white">{tx.description}</p>
                      <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">
                        {tx.counterparty || 'Cliente / Proveedor General'}
                      </p>
                    </div>
                    <strong className={`max-w-full break-all text-left text-base font-bold table-cell-num sm:shrink-0 sm:text-right ${tx.direction === 'income' ? 'text-[#0f8a5f] dark:text-emerald-400' : 'text-[#b54747] dark:text-red-400'}`}>
                      {tx.direction === 'income' ? '+' : '-'}{Money.fromAmount(tx.amount).toFormattedString()}
                    </strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{tx.occurredOn}</span>
                    <span className="inline-flex items-center gap-1">{getMethodIcon(tx.paymentMethod, tx.paymentCondition)}{getMethodName(tx.paymentMethod, tx.paymentCondition)}</span>
                    <span>{tx.paymentCondition === 'cta_cte' ? 'Cta Cte' : 'Contado'}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <button type="button" onClick={() => onEditTransaction(tx)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400" aria-label={`Editar ${tx.description}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />Editar
                    </button>
                    <button type="button" onClick={() => onDeleteTransaction(tx.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400" aria-label={`Anular ${tx.description}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />Anular
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tabla de operaciones para pantallas grandes */}
        <div className="hidden overflow-x-auto lg:block">
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
                    {transactions.length ? 'Sin resultados para esta búsqueda.' : 'Todavía no hay transacciones registradas.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="record-row hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/50 transition-colors">
                    <td data-label="N° OP" data-mobile-hidden="true" className="py-3.5 px-4 font-mono font-bold text-[#0088FF] dark:text-blue-400 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-[#0F172A] lg:static lg:bg-transparent lg:dark:bg-transparent">
                      {tx.opNumber || `OP-${tx.id.slice(-4)}`}
                    </td>
                    <td data-label="Fecha" className="py-3.5 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{tx.occurredOn}</span>
                      </div>
                    </td>
                    <td data-label="Contraparte" data-primary="true" className="py-3.5 px-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {tx.counterparty || 'Cliente / Proveedor General'}
                    </td>
                    <td data-label="Concepto" data-primary="true" className="py-3.5 px-4 font-medium text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{tx.description}</span>
                      </div>
                    </td>
                    <td data-label="Condición / Medio" className="py-3.5 px-4 whitespace-nowrap">
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
                    <td data-label="Monto" className={`py-3.5 px-4 text-right font-bold text-sm table-cell-num whitespace-nowrap ${
                      tx.direction === 'income' ? 'text-[#0f8a5f] dark:text-emerald-400' : 'text-[#b54747] dark:text-red-400'
                    }`}>
                      {tx.direction === 'income' ? '+' : '-'}{Money.fromAmount(tx.amount).toFormattedString()}
                    </td>
                    <td data-label="Acciones" className="py-3.5 px-4 text-center whitespace-nowrap">
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
                          title="Anular operación con asiento de reversión"
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

        {transactions.length > 0 && <p className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {filteredTransactions.length} de {transactions.length} transacciones
        </p>}
      </div>
    </div>
  );
};
