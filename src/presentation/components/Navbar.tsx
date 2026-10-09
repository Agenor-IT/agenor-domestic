import React from 'react';
import { Menu, Plus, Sun, Moon, Wallet } from 'lucide-react';
import { NAVIGATION_ITEMS } from './Sidebar';

interface MobileTopBarProps {
  currentTab: string;
  onOpenSidebar: () => void;
  onOpenNewTransaction: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<MobileTopBarProps> = ({
  currentTab,
  onOpenSidebar,
  onOpenNewTransaction,
  darkMode,
  onToggleDarkMode
}) => {
  const currentItem = NAVIGATION_ITEMS.find(item => item.id === currentTab);
  const CurrentIcon = currentItem?.icon || Wallet;

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0B1329] text-white border-b border-[#1E293B] shadow-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenSidebar}
          aria-label="Abrir menú de navegación"
          className="p-2 -ml-1 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0088FF] flex items-center justify-center shrink-0">
            <CurrentIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {currentItem?.label || 'Agenor Domestic'}
            </h1>
            <p className="text-[10px] text-[#64748B] truncate leading-tight">
              Agenor Domestic
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onToggleDarkMode}
          aria-label="Cambiar tema claro/oscuro"
          className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-400" />}
        </button>

        <button
          onClick={onOpenNewTransaction}
          aria-label="Nueva transacción"
          className="flex items-center gap-1 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl shadow transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">Nuevo</span>
        </button>
      </div>
    </header>
  );
};
