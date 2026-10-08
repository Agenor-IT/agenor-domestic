import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  BarChart3,
  ListOrdered,
  Settings,
  Clock,
  Sun,
  Moon,
  Wallet,
  ArrowLeftRight,
  BookOpen,
  Building2,
  Package
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  darkMode,
  onToggleDarkMode
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'transacciones', label: 'Transacciones', icon: ArrowLeftRight },
    { id: 'fuentes_ingresos', label: 'Fuentes de Ingresos', icon: Briefcase },
    { id: 'egresos', label: 'Estructura de Egresos', icon: Receipt },
    { id: 'seguimiento', label: 'Reportes Contables', icon: BookOpen },
    { id: 'bienes_uso', label: 'Bienes de Uso', icon: Building2 },
    { id: 'bienes_cambio', label: 'Bienes de Cambio', icon: Package },
    { id: 'escenario', label: 'Escenario Sin Extra', icon: BarChart3 },
    { id: 'prioridades', label: 'Ranking Prioridades', icon: ListOrdered },
    { id: 'parametros', label: 'Parámetros & IPC', icon: Settings },
    { id: 'atrasos', label: 'Atrasos & Moras', icon: Clock },
  ];

  return (
    <aside
      className={`bg-[#0B1329] dark:bg-[#070D1B] text-white flex flex-col justify-between transition-all duration-300 h-screen sticky top-0 z-50 border-r border-[#1E293B] dark:border-[#1E293B]/60 shadow-2xl select-none ${
        collapsed ? 'w-20 p-3' : 'w-64 p-4'
      }`}
    >
      {/* HEADER: EL LOGO ES EL BOTÓN DE COLAPSAR/EXPANDIR */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="pb-5 border-b border-[#1E293B]/80 mb-4 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 p-1.5 hover:bg-[#141F36] rounded-2xl transition-all cursor-pointer group text-left outline-none"
            title={collapsed ? "Click para expandir menú" : "Click para contraer menú"}
          >
            <div className="bg-[#0088FF] group-hover:bg-[#0077EE] text-white p-2.5 rounded-xl shadow-md shrink-0 flex items-center justify-center transition-transform group-hover:scale-105">
              <Wallet className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <h1 className="text-base font-bold text-white tracking-tight leading-tight truncate group-hover:text-[#38BDF8] transition-colors">
                  Agenor Domestic
                </h1>
                <p className="text-[11px] text-[#64748B] font-medium truncate">Clean Architecture</p>
              </div>
            )}
          </button>
        </div>

        {/* LISTA DE MENÚ CON SCROLL ESTILIZADO */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent">
          {/* NAVEGACIÓN */}
          <div>
            {!collapsed && (
              <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider px-3 block mb-2">
                NAVEGACIÓN
              </span>
            )}
            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#0088FF] text-white shadow-lg shadow-blue-500/20 font-bold'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/70'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* FOOTER LATERAL (TOGGLE MODO CLARO/OSCURO Y NAMESPACE) */}
      <div className="pt-4 border-t border-[#1E293B]/80 shrink-0 space-y-3">
        {!collapsed && (
          <button
            onClick={onToggleDarkMode}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#141F36] hover:bg-[#1A2844] text-[#94A3B8] hover:text-white rounded-xl text-xs font-medium transition-all border border-[#1E293B] cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-400" />}
              <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </div>
          </button>
        )}

        <div className={`text-[10px] text-[#475569] font-medium text-center ${collapsed ? 'px-0' : 'px-2'}`}>
          {!collapsed ? (
            <span>Namespace: <code className="text-[#38BDF8] font-bold">dom_</code></span>
          ) : (
            <code className="text-[#38BDF8] font-bold text-[9px]">dom_</code>
          )}
        </div>
      </div>
    </aside>
  );
};
