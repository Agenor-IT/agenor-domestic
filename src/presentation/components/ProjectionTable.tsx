import React, { useState } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import { FlowNode } from '../../domain/cashflow/CashFlowProjectionService';
import { PaymentMethodType } from '../../domain/shared/PaymentMethod';
import { Money } from '../../domain/shared/Money';
import { TableSearchFilter } from './TableSearchFilter';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface ProjectionTableProps {
  nodes: FlowNode[];
  months: string[];
  selectedMethods: Record<string, PaymentMethodType>;
  onMethodChange: (nodeId: string, method: PaymentMethodType) => void;
  openingBalance: number;
  onOpeningBalanceChange: (val: number) => void;
}

export const ProjectionTable: React.FC<ProjectionTableProps> = ({
  nodes,
  months,
  selectedMethods,
  onMethodChange,
  openingBalance,
  onOpeningBalanceChange,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (list: FlowNode[]) => {
      list.forEach(n => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.id);
          collect(n.children);
        }
      });
    };
    collect(nodes);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  const filterNode = (node: FlowNode): boolean => {
    const matchesSearch = searchTerm === '' || node.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === 'all' ||
      (filterType === 'income' && (node.flowType === 'income' || node.id === 'income-section')) ||
      (filterType === 'expense' && (node.flowType === 'expense' || node.id.startsWith('expense-')));

    if (matchesSearch && matchesType) return true;
    if (node.children && node.children.some(filterNode)) return true;
    return false;
  };

  const renderRow = (node: FlowNode, depth: number = 0): React.ReactNode => {
    if (!filterNode(node)) return null;

    const isExpanded = expandedNodes.has(node.id) || searchTerm !== '';
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = 16 + depth * 20;

    let rowBg = 'bg-white dark:bg-[#0F172A] text-gray-900 dark:text-gray-100';
    if (node.flowType === 'group') rowBg = 'bg-gray-50/80 dark:bg-[#1E293B]/80 font-semibold text-gray-900 dark:text-gray-100';
    if (node.flowType === 'initialBalance') rowBg = 'bg-blue-50/70 dark:bg-blue-950/40 font-bold border-l-4 border-blue-600 text-blue-950 dark:text-blue-200';
    if (node.flowType === 'finalBalance') rowBg = 'bg-emerald-50/70 dark:bg-emerald-950/40 font-bold border-l-4 border-emerald-600 text-emerald-950 dark:text-emerald-200';
    if (node.flowType === 'net') rowBg = 'bg-purple-50/70 dark:bg-purple-950/40 font-bold border-l-4 border-purple-600 text-purple-950 dark:text-purple-200';
    if (node.flowType === 'extraNeeded') rowBg = 'bg-amber-50/70 dark:bg-amber-950/40 font-bold border-l-4 border-amber-600 text-amber-950 dark:text-amber-200';
    if (node.flowType === 'income') rowBg = 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 text-gray-900 dark:text-gray-100';
    if (node.flowType === 'expense') rowBg = 'hover:bg-red-50/40 dark:hover:bg-red-950/30 text-gray-900 dark:text-gray-100';

    return (
      <React.Fragment key={node.id}>
        <tr className={`border-b border-gray-200 dark:border-gray-800 text-xs transition-colors ${rowBg}`}>
          {/* Concepto (Sticky) */}
          <td className="sticky left-0 bg-white dark:bg-[#0F172A] z-10 py-2.5 px-3 min-w-[320px] max-w-[380px] shadow-[2px_0_5px_rgba(0,0,0,0.03)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${paddingLeft}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(node.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors text-gray-500 dark:text-gray-400"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">{node.label}</span>
              {node.status === 'current' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded">SIN MORA</span>}
              {node.status === 'arrears' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 rounded">CON MORA</span>}
            </div>
          </td>

          {/* Medio de pago/cobro */}
          <td className="py-2 px-3 min-w-[160px]">
            {(node.flowType === 'income' || node.flowType === 'expense') && node.allowedMethods ? (
              <select
                value={selectedMethods[node.id] || node.defaultMethod || 'cash'}
                onChange={(e) => onMethodChange(node.id, e.target.value as PaymentMethodType)}
                className={`w-full text-[11px] font-semibold border rounded-lg px-2 py-1 outline-none transition-colors ${
                  (selectedMethods[node.id] || node.defaultMethod) === 'card'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : (selectedMethods[node.id] || node.defaultMethod) === 'debit'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                {node.allowedMethods.map(m => (
                  <option key={m} value={m} className="bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white">
                    {m === 'cash' ? 'Efectivo / Transfer' : m === 'card' ? 'Tarjeta (+1 mes)' : 'Débito Automático'}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium px-2 py-1 bg-gray-100/50 dark:bg-gray-800/50 rounded inline-block">
                {node.flowType === 'initialBalance' ? 'Saldo anterior' : node.flowType === 'derivedCardImpact' ? 'Impacto +1 mes' : 'Calculado'}
              </span>
            )}
          </td>

          {/* Columnas mensuales */}
          {months.map((_, mIdx) => {
            if (node.flowType === 'initialBalance' && mIdx === 0) {
              return (
                <td key={mIdx} className="py-2 px-2 text-right min-w-[110px]">
                  <FormattedNumberInput
                    value={openingBalance}
                    onChange={(val) => onOpeningBalanceChange(val)}
                    className="w-24 text-right text-xs font-bold border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 bg-white dark:bg-gray-900 text-blue-900 dark:text-blue-300"
                  />
                </td>
              );
            }

            const val = (node.origin && node.origin[mIdx]) || 0;
            return (
              <td key={mIdx} className="py-2.5 px-3 text-right table-cell-num font-medium text-gray-800 dark:text-gray-200 min-w-[110px]">
                {val === 0 ? '—' : Money.fromAmount(val).toFormattedString()}
              </td>
            );
          })}
        </tr>

        {hasChildren && isExpanded && node.children!.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
      <TableSearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterValue={filterType}
        onFilterChange={setFilterType}
        filterOptions={[
          { label: 'Todos los flujos', value: 'all' },
          { label: 'Solo Ingresos', value: 'income' },
          { label: 'Solo Egresos', value: 'expense' }
        ]}
        placeholder="Buscar concepto o partida..."
        extraControls={
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Expandir todo
            </button>
            <button
              onClick={collapseAll}
              className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Contraer todo
            </button>
          </div>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#12355b] dark:bg-[#091E36] text-white text-xs font-bold uppercase tracking-wider border-b border-gray-800">
              <th className="sticky left-0 bg-[#12355b] dark:bg-[#091E36] z-20 py-3 px-3 min-w-[320px]">Concepto</th>
              <th className="py-3 px-3 min-w-[160px]">Medio Pago / Cobro</th>
              {months.map((m, idx) => (
                <th key={idx} className="py-3 px-3 text-right min-w-[110px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => renderRow(node, 0))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
