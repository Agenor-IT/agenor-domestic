import React from 'react';
import {
  LayoutDashboard,
  TableProperties,
  CheckCircle2,
  BarChart3,
  ListOrdered,
  Settings,
  Clock,
  PlusCircle
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewTransaction: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onOpenNewTransaction }) => {
  const tabs = [
    { id: 'dashboard', label: 'Pantalla Principal', icon: LayoutDashboard },
    { id: 'proyeccion', label: 'Proyección & Flujo', icon: TableProperties },
    { id: 'seguimiento', label: 'Seguimiento Real & Caja', icon: CheckCircle2 },
    { id: 'escenario', label: 'Escenario Sin Extra', icon: BarChart3 },
    { id: 'prioridades', label: 'Ranking Prioridades', icon: ListOrdered },
    { id: 'parametros', label: 'Parámetros & IPC', icon: Settings },
    { id: 'atrasos', label: 'Atrasos & Moras', icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 flex flex-col md:flex-row justify-between items-center gap-4 px-6 py-4 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-[#12355b] text-white p-2.5 rounded-xl shadow-inner">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#172033]">Agenor Domestic</h1>
          <p className="text-xs text-gray-500 font-medium">Clean Architecture + DDD | Supabase Namespace <code className="bg-gray-100 px-1 py-0.5 rounded text-[#12355b]">dom_</code></p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#12355b] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onOpenNewTransaction}
          className="flex items-center gap-2 bg-[#0f8a5f] hover:bg-[#0b7651] text-white text-xs md:text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Nueva Transacción
        </button>
      </div>
    </header>
  );
};
