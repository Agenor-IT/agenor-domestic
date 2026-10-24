import React from 'react';
import { LayoutDashboard, Menu, Mic, SlidersHorizontal, TrendingUp } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onNewAdjustment: () => void;
  onOpenVoice: () => void;
  voiceActive: boolean;
  voiceVisible: boolean;
  onOpenRevaluation: () => void;
  onOpenMore: () => void;
  moreOpen: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, onNewAdjustment, onOpenVoice, voiceActive, voiceVisible, onOpenRevaluation, onOpenMore, moreOpen }) => {
  const isMoreActive = moreOpen || currentTab !== 'dashboard';

  return (
    <nav
      aria-label="Navegación móvil principal"
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-[#1E293B] bg-[#0B1329]/95 px-1 text-white shadow-[0_-2px_16px_rgba(0,0,0,0.18)] backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => onTabChange('dashboard')}
        aria-current={currentTab === 'dashboard' ? 'page' : undefined}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold leading-tight transition-colors ${
          currentTab === 'dashboard' ? 'bg-[#0088FF]/20 text-[#38BDF8]' : 'text-[#94A3B8] hover:text-white'
        }`}
      >
        <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Inicio</span>
      </button>

      <button
        type="button"
        onClick={onNewAdjustment}
        aria-label="Nuevo ajuste"
        className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold leading-tight text-[#94A3B8] transition-colors hover:text-white"
      >
        <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Ajuste</span>
      </button>

      <button
        type="button"
        onClick={onOpenVoice}
        aria-label="Abrir asistente por voz"
        aria-pressed={voiceActive}
        aria-expanded={voiceVisible}
        aria-controls="domestic-voice-panel"
        className="relative -top-3 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38BDF8]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-[#0B1329] bg-[#0088FF] shadow-lg shadow-blue-500/30">
          <Mic className={`h-6 w-6 ${voiceActive ? 'animate-pulse' : ''}`} aria-hidden="true" />
        </span>
        <span className="max-w-full truncate">Voz</span>
      </button>

      <button
        type="button"
        onClick={onOpenRevaluation}
        aria-label="Revaluar activos"
        className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold leading-tight text-[#94A3B8] transition-colors hover:text-white"
      >
        <TrendingUp className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="max-w-full truncate">Revaluación</span>
      </button>

      <button
        type="button"
        onClick={onOpenMore}
        aria-label="Abrir todas las secciones"
        aria-expanded={moreOpen}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold leading-tight transition-colors ${
          isMoreActive ? 'bg-[#0088FF]/20 text-[#38BDF8]' : 'text-[#94A3B8] hover:text-white'
        }`}
      >
        <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Más</span>
      </button>
    </nav>
  );
};
