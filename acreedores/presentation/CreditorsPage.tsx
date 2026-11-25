import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '../../src/presentation/components/PageHeader';
import { creditorKinds, filterCreditors, type CreditorKind } from '../domain/creditor';
import { creditorButton, creditorField, CreditorForm } from './CreditorForm';
import { useCreditors } from './useCreditors';
import './creditors.css';

export function CreditorsPage({ tenant }: { tenant: number }) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<CreditorKind | 'all'>('all');
  const catalog = useCreditors(tenant);
  const rows = filterCreditors(catalog.rows, query, kind);

  if (creating) return <>
    <PageHeader title="Nuevo acreedor" icon={Users} />
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0B1329]">
      <CreditorForm save={catalog.create} onBack={() => setCreating(false)} onSaved={() => {
        setQuery(''); setKind('all'); setCreating(false); catalog.reload();
      }} />
    </div>
  </>;

  return <div className="space-y-4">
    <PageHeader title="Acreedores" icon={Users} iconBgColor="bg-[#0088FF]" actionContainerClassName="flex justify-end"
      action={<button type="button" className={creditorButton + ' inline-flex items-center gap-2'} onClick={() => setCreating(true)}>
        <Plus size={18} aria-hidden="true" /> Nuevo acreedor
      </button>} />
    <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium dark:border-[#1E293B] dark:bg-[#0B1329] sm:grid-cols-[1fr_13rem]">
      <label>Buscar acreedor<input type="search" className={creditorField} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, documento o contacto" /></label>
      <label>Tipo<select className={creditorField} value={kind} onChange={e => setKind(e.target.value as CreditorKind | 'all')}>
        <option value="all">Todos los tipos</option>
        {Object.entries(creditorKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
    </div>
    {catalog.loading && <p role="status">Cargando acreedores…</p>}
    {catalog.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{catalog.error} <button type="button" onClick={catalog.reload} className="font-bold underline">Reintentar</button></p>}
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-[#1E293B] dark:bg-[#0B1329]">
      <table className="w-full min-w-[34rem] text-left text-sm" aria-label="Listado de acreedores">
        <thead className="creditor-heading"><tr>{['Nombre o razón social', 'Tipo', 'Documento o CUIT', 'Contacto'].map(label =>
          <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-[#1E293B]">
          {rows.map(row => <tr key={row.id}><th scope="row" className="px-4 py-3">{row.name}</th><td className="px-4 py-3">{creditorKinds[row.kind]}</td>
            <td className="px-4 py-3">{row.document || '—'}</td><td className="px-4 py-3">{row.contact || '—'}</td></tr>)}
          {!rows.length && !catalog.loading && !catalog.error && <tr><td className="p-6 text-center" colSpan={4}>{catalog.rows.length ? 'No hay resultados para estos filtros.' : 'Todavía no hay acreedores.'}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
