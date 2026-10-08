import React from 'react';
import { Money } from '../../domain/shared/Money';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CreditCard
} from 'lucide-react';

interface MainDashboardKPIsProps {
  accountsReceivable: Money;
  accountsPayable: Money;
  cashAvailable: Money;
  bankAvailable: Money;
  cardsAvailable: Money;
}

export const MainDashboardKPIs: React.FC<MainDashboardKPIsProps> = ({
  accountsReceivable,
  accountsPayable,
  cashAvailable,
  bankAvailable,
  cardsAvailable
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Cuentas a Cobrar */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Cuentas a Cobrar</span>
          <strong className="block text-2xl font-bold text-[#0f8a5f] dark:text-emerald-400 mt-1.5 table-cell-num">
            {accountsReceivable.toFormattedString()}
          </strong>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block mt-1">Pendientes de cobro confirmados</span>
        </div>
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#0f8a5f] dark:text-emerald-400 rounded-xl shrink-0">
          <ArrowDownLeft className="w-5 h-5" />
        </div>
      </div>

      {/* Cuentas a Pagar */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Cuentas a Pagar</span>
          <strong className="block text-2xl font-bold text-[#b54747] dark:text-red-400 mt-1.5 table-cell-num">
            {accountsPayable.toFormattedString()}
          </strong>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block mt-1">Obligaciones prioritarias</span>
        </div>
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-[#b54747] dark:text-red-400 rounded-xl shrink-0">
          <ArrowUpRight className="w-5 h-5" />
        </div>
      </div>

      {/* Disponible Efectivo */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Disponible Efectivo</span>
          <strong className="block text-2xl font-bold text-[#12355b] dark:text-blue-400 mt-1.5 table-cell-num">
            {cashAvailable.toFormattedString()}
          </strong>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block mt-1">Caja física en pesos</span>
        </div>
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-[#12355b] dark:text-blue-400 rounded-xl shrink-0">
          <Banknote className="w-5 h-5" />
        </div>
      </div>

      {/* Disponible Cuentas Bancarias */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Disponible Bancario</span>
          <strong className="block text-2xl font-bold text-[#12355b] dark:text-blue-400 mt-1.5 table-cell-num">
            {bankAvailable.toFormattedString()}
          </strong>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block mt-1">Naranja X + Bancos</span>
        </div>
        <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-[#6d4db3] dark:text-purple-400 rounded-xl shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
      </div>

      {/* Disponible en Tarjetas */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Disponible Tarjetas</span>
          <strong className="block text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1.5 table-cell-num">
            {cardsAvailable.toFormattedString()}
          </strong>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block mt-1">Margen libre en tarjetas</span>
        </div>
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
