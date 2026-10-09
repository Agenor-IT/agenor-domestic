import React, { useEffect, useState } from 'react';
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
  Package,
  X,
  LucideIcon
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  /** Drawer abierto en pantallas < lg */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
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

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  darkMode,
  onToggleDarkMode,
  mobileOpen = false,
  onCloseMobile
}) => {
  const [collapsedDesktop, setCollapsedDesktop] = useState(false);
  // En mobile el drawer siempre se muestra expandido
  const collapsed = collapsedDesktop && !mobileOpen;

  const navigationItems = NAVIGATION_ITEMS;

  // Cerrar con Escape y bloquear scroll del body mientras el drawer está abierto
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen, onCloseMobile]);

  const handleNavigate = (tabId: string) => {
    onTabChange(tabId);
    onCloseMobile?.();
  };

  return (
    <>
    {/* BACKDROP MOBILE */}
    <div
      onClick={onCloseMobile}
      aria-hidden="true"
      className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
        mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    />
    <aside
      aria-label="Menú principal"
      className={`bg-[#0B1329] dark:bg-[#070D1B] text-white flex flex-col justify-between transition-all duration-300 h-[100dvh] z-50 border-r border-[#1E293B] dark:border-[#1E293B]/60 shadow-2xl select-none
        fixed inset-y-0 left-0 w-[17rem] max-w-[85vw] p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:translate-x-0 lg:max-w-none lg:pt-4 lg:pb-4 ${
        collapsed ? 'lg:w-20 lg:p-3' : 'lg:w-64 lg:p-4'
      }`}
    >
      {/* HEADER: EL LOGO ES EL BOTÓN DE COLAPSAR/EXPANDIR (solo desktop) */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="pb-5 border-b border-[#1E293B]/80 mb-4 shrink-0 flex items-center gap-2">
          <button
            onClick={() => {
              if (mobileOpen) return;
              setCollapsedDesktop(!collapsedDesktop);
            }}
            className="flex-1 min-w-0 flex items-center gap-3 p-1.5 hover:bg-[#141F36] rounded-2xl transition-all cursor-pointer group text-left outline-none"
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
          <button
            onClick={onCloseMobile}
            className="lg:hidden shrink-0 p-2.5 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/70 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
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
                    onClick={() => handleNavigate(item.id)}
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
    </>
  );
};
