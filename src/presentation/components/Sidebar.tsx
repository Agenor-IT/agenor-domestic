import React, { useState } from 'react';
import { 
  Wallet, 
  Settings, 
  Clock, 
  BarChart3, 
  PlusCircle, 
  ListOrdered, 
  Sun, 
  Moon,
  ChevronLeft
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewTransaction: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onTabChange, 
  onOpenNewTransaction,
  collapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapsed = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalCollapsed(prev => !prev);
    }
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen Proyección', icon: Wallet },
    { id: 'escenario', label: 'Escenario Sin Extra', icon: BarChart3 },
    { id: 'prioridades', label: 'Ranking Prioridades', icon: ListOrdered },
    { id: 'parametros', label: 'Parámetros & IPC', icon: Settings },
    { id: 'atrasos', label: 'Atrasos & Moras', icon: Clock },
  ];

  return (
    <aside 
      className={`h-screen sticky top-0 z-40 flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 ease-in-out shadow-sm select-none ${
        isCollapsed ? 'w-[76px]' : 'w-72'
      }`}
    >
      {/* Top Header / Logo Section */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800/80">
        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? 'Expandir menú lateral (Click en logo)' : 'Colapsar menú lateral (Click en logo)'}
          className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left group hover:bg-gray-100 dark:hover:bg-slate-800 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#12355b] dark:bg-sky-600 text-white p-2.5 rounded-xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="text-base font-bold tracking-tight text-[#172033] dark:text-slate-100 truncate">
                  Agenor Domestic
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium truncate">
                  Clean Architecture
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors p-1">
              <ChevronLeft className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 py-4 px-3 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Navegación
          </p>
        )}
        <nav className="space-y-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                title={isCollapsed ? t.label : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl transition-all ${
                  isCollapsed ? 'justify-center' : 'justify-start'
                } ${
                  active
                    ? 'bg-[#12355b] dark:bg-sky-600 text-white shadow-md shadow-[#12355b]/20 dark:shadow-sky-900/30'
                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{t.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Action Buttons Section */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
          {!isCollapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Acciones
            </p>
          )}
          <button
            onClick={onOpenNewTransaction}
            title={isCollapsed ? 'Nueva Transacción' : undefined}
            className={`w-full flex items-center gap-2.5 bg-[#0f8a5f] hover:bg-[#0b7651] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold p-3 rounded-xl transition-all shadow-sm ${
              isCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="truncate">Nueva Transacción</span>}
          </button>
        </div>
      </div>

      {/* Footer / Theme & Info Section */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors shadow-sm ${
            isCollapsed ? 'justify-center' : 'justify-start'
          }`}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700 shrink-0" />
          )}
          {!isCollapsed && (
            <span className="text-xs font-medium text-gray-600 dark:text-slate-300 truncate">
              {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800/50 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">
              Namespace: <strong className="text-[#12355b] dark:text-sky-400">dom_</strong>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
