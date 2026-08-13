import React from 'react';
import { Money } from '../../domain/shared/Money';
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';

interface MetricsHeaderProps {
  totalIncome: Money;
  totalExpense: Money;
  finalBalance: Money;
  extraNeeded: Money;
  periodLabel: string;
}

export const MetricsHeader: React.FC<MetricsHeaderProps> = ({
  totalIncome,
  totalExpense,
  finalBalance,
  extraNeeded,
  periodLabel
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-start justify-between transition-colors">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ingresos · {periodLabel}</span>
          <strong className="block text-2xl font-bold text-[#0f8a5f] dark:text-emerald-400 mt-1 table-cell-num">{totalIncome.toFormattedString()}</strong>
        </div>
        <div className="p-2.5 bg-[#e9f7f1] dark:bg-emerald-950/60 text-[#0f8a5f] dark:text-emerald-400 rounded-xl">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-start justify-between transition-colors">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Egresos · {periodLabel}</span>
          <strong className="block text-2xl font-bold text-[#b54747] dark:text-rose-400 mt-1 table-cell-num">{totalExpense.toFormattedString()}</strong>
        </div>
        <div className="p-2.5 bg-[#fff0f0] dark:bg-rose-950/60 text-[#b54747] dark:text-rose-400 rounded-xl">
          <TrendingDown className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-start justify-between transition-colors">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Saldo Final · {periodLabel}</span>
          <strong className={`block text-2xl font-bold mt-1 table-cell-num ${
            finalBalance.isNegative() ? 'text-[#b54747] dark:text-rose-400' : 'text-[#12355b] dark:text-sky-400'
          }`}>
            {finalBalance.toFormattedString()}
          </strong>
        </div>
        <div className="p-2.5 bg-blue-50 dark:bg-sky-950/60 text-[#12355b] dark:text-sky-400 rounded-xl">
          <Wallet className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-start justify-between transition-colors">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Extra Necesario · {periodLabel}</span>
          <strong className={`block text-2xl font-bold mt-1 table-cell-num ${
            extraNeeded.isPositive() ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-500'
          }`}>
            {extraNeeded.toFormattedString()}
          </strong>
        </div>
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
