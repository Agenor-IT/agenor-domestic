import React, { useState } from 'react';
import { FlowNode } from '../../domain/cashflow/CashFlowProjectionService';
import { PaymentMethodType } from '../../domain/shared/PaymentMethod';
import { Money } from '../../domain/shared/Money';
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(['income-section', 'expense-section', 'expense-bruno', 'expense-business-fixed', 'expense-home-fixed', 'expense-cards', 'expense-loans'])
  );

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

  const renderRow = (node: FlowNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = 16 + depth * 20;

    let rowBg = 'bg-white dark:bg-slate-800';
    let stickyBg = 'bg-white dark:bg-slate-800';
    if (node.flowType === 'group') {
      rowBg = 'bg-gray-50/80 dark:bg-slate-700/80 font-bold';
      stickyBg = 'bg-gray-50 dark:bg-slate-700';
    }
    if (node.flowType === 'initialBalance') {
      rowBg = 'bg-blue-50/60 dark:bg-sky-950/70 font-bold border-l-4 border-blue-600 dark:border-sky-400';
      stickyBg = 'bg-blue-50/60 dark:bg-sky-950/90';
    }
    if (node.flowType === 'finalBalance') {
      rowBg = 'bg-emerald-50/70 dark:bg-emerald-950/70 font-bold border-l-4 border-emerald-600 dark:border-emerald-400';
      stickyBg = 'bg-emerald-50/70 dark:bg-emerald-950/90';
    }
    if (node.flowType === 'net') {
      rowBg = 'bg-purple-50/60 dark:bg-purple-950/70 font-bold border-l-4 border-purple-600 dark:border-purple-400';
      stickyBg = 'bg-purple-50/60 dark:bg-purple-950/90';
    }
    if (node.flowType === 'extraNeeded') {
      rowBg = 'bg-amber-50/70 dark:bg-amber-950/70 font-bold border-l-4 border-amber-600 dark:border-amber-400';
      stickyBg = 'bg-amber-50/70 dark:bg-amber-950/90';
    }
    if (node.flowType === 'income') rowBg += ' hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30';
    if (node.flowType === 'expense') rowBg += ' hover:bg-red-50/30 dark:hover:bg-rose-950/30';

    return (
      <React.Fragment key={node.id}>
        <tr className={`border-b border-gray-200 dark:border-slate-700 text-xs transition-colors ${rowBg}`}>
          {/* Concepto (Sticky) */}
          <td className={`sticky left-0 z-10 py-2.5 px-3 min-w-[320px] max-w-[380px] shadow-[2px_0_5px_rgba(0,0,0,0.03)] ${stickyBg}`}>
            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${paddingLeft}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(node.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors text-gray-500 dark:text-slate-400"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className="truncate font-medium text-gray-900 dark:text-slate-100">{node.label}</span>
              {node.status === 'current' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">SIN MORA</span>}
              {node.status === 'arrears' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-red-100 dark:bg-rose-950 text-red-800 dark:text-rose-300 rounded border border-red-200 dark:border-rose-800">CON MORA</span>}
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
                    ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : (selectedMethods[node.id] || node.defaultMethod) === 'debit'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                    : 'bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-800 dark:text-slate-200'
                }`}
              >
                {node.allowedMethods.map(m => (
                  <option key={m} value={m} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                    {m === 'cash' ? 'Efectivo / Transfer' : m === 'card' ? 'Tarjeta (+1 mes)' : 'Débito Automático'}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-gray-400 dark:text-slate-400 font-medium px-2 py-1 bg-gray-100/50 dark:bg-slate-700/50 rounded inline-block">
                {node.flowType === 'initialBalance' ? 'Saldo anterior' : node.flowType === 'derivedCardImpact' ? 'Impacto +1 mes' : 'Calculado'}
              </span>
            )}
          </td>

          {/* Columnas mensuales */}
          {months.map((_, mIdx) => {
            if (node.flowType === 'initialBalance' && mIdx === 0) {
              return (
                <td key={mIdx} className="py-2 px-2 text-right min-w-[110px]">
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => onOpeningBalanceChange(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right text-xs font-bold border border-blue-300 dark:border-sky-500 rounded px-1.5 py-1 bg-white dark:bg-slate-900 text-blue-900 dark:text-sky-300"
                  />
                </td>
              );
            }

            const val = (node.origin && node.origin[mIdx]) || 0;
            return (
              <td key={mIdx} className="py-2.5 px-3 text-right table-cell-num font-medium text-gray-800 dark:text-slate-200 min-w-[110px]">
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
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6 transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100">Proyección Dinámica de Caja</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">17 períodos proyectados (Ago-26 a Dic-27) con impacto automático de medios de pago</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-lg transition-colors"
          >
            Expandir todo
          </button>
          <button
            onClick={collapseAll}
            className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-lg transition-colors"
          >
            Contraer todo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#12355b] dark:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
              <th className="sticky left-0 bg-[#12355b] dark:bg-slate-900 z-20 py-3 px-3 min-w-[320px]">Concepto</th>
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
