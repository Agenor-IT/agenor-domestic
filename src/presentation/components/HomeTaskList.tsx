import React, { useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, ListTodo } from 'lucide-react';

export interface HomeTask {
  id: string;
  title: string;
  detail?: string;
  dueDate?: string;
  completed: boolean;
}

interface HomeTaskListProps {
  items: HomeTask[];
  onToggle: (id: string) => void;
  onOpenExpenses: () => void;
  loading?: boolean;
  error?: string;
  notice?: string;
}

export const HomeTaskList: React.FC<HomeTaskListProps> = ({ items, onToggle, onOpenExpenses, loading = false, error, notice }) => {
  const [dayOffset, setDayOffset] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  selectedDate.setDate(selectedDate.getDate() + dayOffset);
  const selectedKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const dayLabel = dayOffset === 0 ? 'Hoy' : dayOffset === 1 ? 'Mañana' : dayOffset === 2 ? 'Pasado mañana' : dayOffset === -1 ? 'Ayer' : dayOffset === -2 ? 'Antes de ayer' : new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate);
  const visibleItems = items.filter(item => item.dueDate === selectedKey || (dayOffset === 0 && !!item.dueDate && item.dueDate < todayKey && !item.completed));
  const pending = visibleItems.filter(item => !item.completed);
  const completed = visibleItems.filter(item => item.completed);
  const orderedItems = [...pending, ...completed];

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (!touchStart.current || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.current.x;
    const dy = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      setDayOffset(previous => previous + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0088FF] text-white">
            <ListTodo className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#172033] dark:text-white">Home</h1>
            <time dateTime={selectedKey} className="mt-0.5 block text-sm capitalize text-gray-500 dark:text-gray-400">
              {new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
            </time>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-[#0F172A]" aria-label="Navegar por días">
          <button type="button" onClick={() => setDayOffset(previous => previous - 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Día anterior">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-24 px-1 text-center text-sm font-bold text-gray-900 dark:text-white" aria-live="polite">{dayLabel}</span>
          <button type="button" onClick={() => setDayOffset(previous => previous + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Día siguiente">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          {dayOffset !== 0 && <button type="button" onClick={() => setDayOffset(0)} className="flex h-10 items-center rounded-lg px-2 text-xs font-semibold text-[#0088FF]" aria-label="Volver a hoy">Hoy</button>}
        </div>
      </header>

      <section
        aria-label="Lista de tareas"
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0F172A]"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={event => {
          touchStart.current = null;
          if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:px-5">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">Vencimientos registrados</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {pending.length} pendiente{pending.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <p role="status" className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Cargando vencimientos…</p>
        ) : error ? (
          <p role="alert" className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : orderedItems.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {items.length === 0 ? 'No hay vencimientos cargados. Los egresos y comprobantes con fecha aparecerán acá.' : 'No hay vencimientos para este día.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {orderedItems.map(item => (
              <li key={item.id} className="flex min-w-0 items-start gap-3 px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  aria-label={`${item.completed ? 'Marcar pendiente' : 'Marcar gestionado'}: ${item.title}`}
                  aria-pressed={item.completed}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${item.completed ? 'border-[#0f8a5f] bg-[#0f8a5f] text-white' : 'border-gray-400 text-transparent dark:border-gray-500'}`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`break-words text-sm font-semibold ${item.completed ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{item.title}</p>
                  {(item.detail || item.dueDate) && (
                    <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">
                      {item.detail}{item.detail && item.dueDate ? ' · ' : ''}
                      {item.dueDate && `${item.dueDate < todayKey ? 'Venció' : 'Vence'} ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${item.dueDate}T00:00:00`))}`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Marcar una tarea no registra el pago.</p>
          <button type="button" onClick={onOpenExpenses} className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-[#0088FF] hover:underline">
            Ver egresos <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
      {notice && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{notice}</p>}
    </div>
  );
};
