import React from 'react';
import { SlidersHorizontal, PlusCircle, Sparkles, Home, TrendingUp } from 'lucide-react';

interface HeaderProps {
  onOpenNewTransaction: () => void;
  onOpenNewAdjustment: () => void;
  onOpenRxTRevaluation?: () => void;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewTransaction,
  onOpenNewAdjustment,
  onOpenRxTRevaluation,
  userName = 'Hernán'
}) => {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200/80 dark:border-gray-800 bg-transparent">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="bg-[#0088FF] text-white p-2.5 sm:p-3 rounded-2xl shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
          <Home className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#172033] dark:text-white flex items-center gap-2 tracking-tight truncate">
            <span>¡Hola, {userName}!</span> <span className="text-lg">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Resumen financiero y flujo de caja en tiempo real</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
        <button
          onClick={onOpenNewTransaction}
          className="flex items-center justify-center gap-2 bg-[#12355b] dark:bg-[#0088FF] hover:bg-[#0d2642] dark:hover:bg-blue-600 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nueva Transacción</span>
        </button>

        <button
          onClick={onOpenNewAdjustment}
          className="flex items-center justify-center gap-2 bg-[#00A86B] hover:bg-[#008f5b] text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>Nuevo Ajuste</span>
        </button>

        {onOpenRxTRevaluation && (
          <button
            onClick={onOpenRxTRevaluation}
            className="flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Revaluar Activos (RxT)</span>
          </button>
        )}
      </div>
    </header>
  );
};
