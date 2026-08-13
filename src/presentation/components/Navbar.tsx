import React from 'react';
import { Wallet, Settings, Clock, BarChart3, PlusCircle, ListOrdered, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewTransaction: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onOpenNewTransaction }) => {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'resumen', label: 'Resumen Proyección', icon: Wallet },
    { id: 'escenario', label: 'Escenario Sin Extra', icon: BarChart3 },
    { id: 'prioridades', label: 'Ranking Prioridades', icon: ListOrdered },
    { id: 'parametros', label: 'Parámetros & IPC', icon: Settings },
    { id: 'atrasos', label: 'Atrasos & Moras', icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 flex flex-col md:flex-row justify-between items-center gap-4 px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-[#12355b] dark:bg-sky-600 text-white p-2.5 rounded-xl shadow-inner">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#172033] dark:text-slate-100">Agenor Domestic</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            Clean Architecture + DDD | Supabase Namespace{' '}
            <code className="bg-gray-100 dark:bg-slate-800 text-[#12355b] dark:text-sky-400 px-1 py-0.5 rounded">dom_</code>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <nav className="flex gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl transition-colors">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                  active
                    ? 'bg-[#12355b] dark:bg-sky-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          className="flex items-center justify-center p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700" />
          )}
        </button>

        <button
          onClick={onOpenNewTransaction}
          className="flex items-center gap-2 bg-[#0f8a5f] hover:bg-[#0b7651] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Nueva Transacción
        </button>
      </div>
    </header>
  );
};
