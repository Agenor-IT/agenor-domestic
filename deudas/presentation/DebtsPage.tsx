import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Landmark, Plus, Search } from 'lucide-react';
import { PageHeader } from '../../src/presentation/components/PageHeader';
import { filterDebts, sortDebts, type DebtPeriod, type DebtSort, type DebtSortKey } from '../application/debtRepository';
import { amortizationLabels, type Debt, type NewDebt } from '../domain/debt';
import { supabaseDebtRepository } from '../infrastructure/supabaseDebtRepository';
import { DebtFormPage } from './DebtFormPage';
import { DebtDetailPage } from './DebtDetailPage';
import { dateLabel, money } from './DebtProjection';
import './debts.css';

const periods: Record<DebtPeriod, string> = { all: 'Todas las fechas', day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' };
const periodFields = {
  day: { label: 'Elegí un día', type: 'date' },
  week: { label: 'Elegí un día de la semana', type: 'date' },
  month: { label: 'Elegí un mes', type: 'month' },
  year: { label: 'Elegí un año', type: 'number' },
};
const fieldClass = 'debt-field min-h-11 w-full rounded-xl border px-3 text-sm';
const primaryClass = 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0088FF] px-4 text-sm font-bold text-white hover:bg-blue-600';
const columns: { key: DebtSortKey; label: string }[] = [
  { key: 'creditor', label: 'Acreedor' }, { key: 'type', label: 'Tipo' },
  { key: 'openedOn', label: 'Fecha de deuda' }, { key: 'balance', label: 'Capital pendiente' },
  { key: 'months', label: 'Plazo' }, { key: 'method', label: 'Amortización' },
];

export function DebtsPage({ personaPadreId }: { personaPadreId: number }) {
  const [view, setView] = useState<'list' | 'new' | Debt>('list');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState('');
  const [period, setPeriod] = useState<DebtPeriod>('all');
  const [value, setValue] = useState('');
  const [sort, setSort] = useState<DebtSort>({ key: 'openedOn', ascending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const repository = useMemo(() => supabaseDebtRepository(personaPadreId), [personaPadreId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDebts([]);
    setError('');
    void repository.list().then(rows => {
      if (active) setDebts(rows);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el listado.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [repository, revision]);

  const save = async (debt: NewDebt) => {
    await repository.create(debt);
    setRevision(previous => previous + 1);
    setPage(1);
    setView('list');
  };
  const filtered = sortDebts(filterDebts(debts, text, period, value), sort);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const visibleDebts = filtered.slice(offset, offset + pageSize);
  const periodField = period === 'all' ? null : periodFields[period];

  return (
    <div className="debt-module space-y-4">
      {view === 'new' && <DebtFormPage tenant={personaPadreId} onBack={() => setView('list')} onSave={save} />}
      {typeof view === 'object' && <DebtDetailPage key={view.id} debt={view} repository={repository} onBack={() => setView('list')} />}
      {view === 'list' && <>
        <PageHeader title="Gestión de deudas" icon={Landmark} iconBgColor="bg-[#0088FF]" actionContainerClassName="flex justify-end"
          action={<button type="button" className={primaryClass} onClick={() => setView('new')}>
            <Plus size={18} aria-hidden="true" /> Nueva deuda
          </button>} />
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0B1329]">
          <label className="min-w-[min(100%,14rem)] flex-1 text-sm font-medium">
            Buscar deudas
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" aria-hidden="true" />
              <input type="search" className={fieldClass + ' pl-9'} placeholder="Acreedor o tipo de deuda" value={text} onChange={event => { setText(event.target.value); setPage(1); }} />
            </span>
          </label>
          <label className="min-w-[10rem] text-sm font-medium">
            Fecha de deuda
            <select className={fieldClass + ' mt-1'} value={period} onChange={event => { setPeriod(event.target.value as DebtPeriod); setValue(''); setPage(1); }}>
              {Object.entries(periods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {periodField && <label className="min-w-[10rem] text-sm font-medium">
            {periodField.label}
            <input className={fieldClass + ' mt-1'} type={periodField.type} key={period} min={period === 'year' ? 1000 : undefined}
              max={period === 'year' ? 9999 : undefined} value={value} onChange={event => { setValue(event.target.value); setPage(1); }} />
          </label>}
        </div>
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}<button type="button" className="min-h-11 font-bold underline" onClick={() => setRevision(previous => previous + 1)}>Reintentar</button>
        </div>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-[#1E293B] dark:bg-[#0B1329]">
          <table aria-label="Listado de deudas" className="w-full min-w-[44rem] text-left text-sm">
            <thead className="debt-table-heading"><tr>
              {columns.map(({ key, label }) => {
                const active = sort.key === key;
                const Icon = active ? sort.ascending ? ArrowUp : ArrowDown : ArrowUpDown;
                return <th key={key} scope="col" aria-sort={active ? sort.ascending ? 'ascending' : 'descending' : undefined}>
                  <button type="button" className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-4 py-3 text-left"
                    onClick={() => { setSort({ key, ascending: active ? !sort.ascending : true }); setPage(1); }}>
                    {label}<Icon size={14} aria-hidden="true" />
                  </button>
                </th>;
              })}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#1E293B]">
              {visibleDebts.map(debt => <tr key={debt.id}>
                <th scope="row" className="px-4 py-2"><button type="button" className="min-h-11 text-left font-semibold text-blue-700 hover:underline dark:text-sky-300"
                  onClick={() => setView(debt)}>{debt.creditor}</button></th>
                <td className="px-4 py-2">{debt.type}</td>
                <td className="whitespace-nowrap px-4 py-2">{dateLabel(debt.openedOn)}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">{money(debt.balance)}</td>
                <td className="px-4 py-2">{debt.terms ? debt.terms.months + ' meses' : '—'}</td>
                <td className="px-4 py-2">{debt.terms ? amortizationLabels[debt.terms.method] : '—'}</td>
              </tr>)}
              {(loading || (!error && visibleDebts.length === 0)) && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                {loading ? 'Cargando deudas…' : debts.length ? 'No hay deudas para estos filtros.' : 'Todavía no hay deudas cargadas.'}
              </td></tr>}
            </tbody>
          </table>
          <nav aria-label="Paginación de deudas" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-[#28364e]">
            <label className="flex items-center gap-2">
              Filas por página
              <select className="debt-field min-h-11 rounded-xl border px-2" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
                <option>10</option><option>25</option><option>50</option>
              </select>
            </label>
            <span aria-live="polite">{filtered.length ? `${offset + 1}–${offset + visibleDebts.length} de ${filtered.length}` : '0 deudas'}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                className="debt-field flex h-11 w-11 items-center justify-center rounded-xl border disabled:opacity-40"><ChevronLeft size={18} aria-hidden="true" /></button>
              <span>{currentPage} / {totalPages}</span>
              <button type="button" aria-label="Página siguiente" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}
                className="debt-field flex h-11 w-11 items-center justify-center rounded-xl border disabled:opacity-40"><ChevronRight size={18} aria-hidden="true" /></button>
            </div>
          </nav>
        </div>
      </>}
    </div>
  );
}
