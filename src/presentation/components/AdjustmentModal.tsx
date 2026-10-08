import React, { useState } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

export interface AdjustmentData {
  componentKey: string;
  componentLabel: string;
  targetSection: 'balance' | 'results';
  adjustmentType: 'set_balance' | 'increase' | 'decrease';
  amount: number;
  reason: string;
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAdjustment: (data: AdjustmentData) => void;
  adjustments?: Record<string, number>;
  liveValues?: Record<string, number>;
}

const ADJUSTABLE_COMPONENTS = [
  // SITUACIÓN PATRIMONIAL
  { key: 'bank_available', label: 'Disponible Bancos / Naranja X', section: 'balance', currentVal: 0.00 },
  { key: 'cash_available', label: 'Disponible en Efectivo', section: 'balance', currentVal: 0.00 },
  { key: 'cards_available', label: 'Disponible Libre en Tarjetas de Crédito', section: 'balance', currentVal: 0.00 },
  { key: 'receivables', label: 'Cuentas por Cobrar', section: 'balance', currentVal: 0.00 },
  { key: 'payables', label: 'Obligaciones Pendientes Prioritarias', section: 'balance', currentVal: 0.00 },
  { key: 'card_installments', label: 'Consumos de Tarjeta en Cuotas / Deuda Tarjetas', section: 'balance', currentVal: 0.00 },
  // ESTADO DE RESULTADOS
  { key: 'income_executed', label: 'Ingresos Reales Cobrados', section: 'results', currentVal: 0.00 },
  { key: 'expense_executed', label: 'Egresos Reales Pagados', section: 'results', currentVal: 0.00 },
];

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  onApplyAdjustment,
  adjustments = {},
  liveValues = {}
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(ADJUSTABLE_COMPONENTS[0].key);
  const [adjustmentType, setAdjustmentType] = useState<'set_balance' | 'increase' | 'decrease'>('set_balance');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentComp = ADJUSTABLE_COMPONENTS.find(c => c.key === selectedKey) || ADJUSTABLE_COMPONENTS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amount) || amount < 0) return;

    onApplyAdjustment({
      componentKey: currentComp.key,
      componentLabel: currentComp.label,
      targetSection: currentComp.section as 'balance' | 'results',
      adjustmentType,
      amount,
      reason: reason || 'Ajuste de arqueo y reconciliación contable'
    });

    setSuccessMsg(`Ajuste registrado exitosamente sobre ${currentComp.label}`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1E293B]/50">
          <div className="flex items-center gap-3">
            <div className="bg-[#00A86B] text-white p-2.5 rounded-xl shadow-md">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Nuevo Ajuste Contable</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reconciliación de saldos en Resultados y Patrimonio</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO Y FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {successMsg ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              {successMsg}
            </div>
          ) : (
            <>
              {/* SELECTOR DE COMPONENTE A AJUSTAR */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Componente a Ajustar
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00A86B] outline-none"
                >
                  <optgroup label="Situación Patrimonial (Balance)">
                    {ADJUSTABLE_COMPONENTS.filter(c => c.section === 'balance').map(c => {
                      const liveVal = liveValues && liveValues[c.key] !== undefined ? liveValues[c.key] : (adjustments[c.key] !== undefined ? adjustments[c.key] : c.currentVal);
                      return (
                        <option key={c.key} value={c.key}>
                          {c.label} (Saldo actual: ${liveVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                        </option>
                      );
                    })}
                  </optgroup>
                  <optgroup label="Estado de Resultados (P&L)">
                    {ADJUSTABLE_COMPONENTS.filter(c => c.section === 'results').map(c => {
                      const liveVal = liveValues && liveValues[c.key] !== undefined ? liveValues[c.key] : (adjustments[c.key] !== undefined ? adjustments[c.key] : c.currentVal);
                      return (
                        <option key={c.key} value={c.key}>
                          {c.label} (Saldo actual: ${liveVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
              </div>

              {/* TIPO DE AJUSTE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Tipo de Ajuste
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('set_balance')}
                    className={`p-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      adjustmentType === 'set_balance'
                        ? 'bg-[#12355b] dark:bg-[#0088FF] text-white border-transparent shadow-sm'
                        : 'bg-gray-50 dark:bg-[#1E293B] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Fijar Saldo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('increase')}
                    className={`p-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      adjustmentType === 'increase'
                        ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                        : 'bg-gray-50 dark:bg-[#1E293B] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    + Incrementar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('decrease')}
                    className={`p-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      adjustmentType === 'decrease'
                        ? 'bg-red-600 text-white border-transparent shadow-sm'
                        : 'bg-gray-50 dark:bg-[#1E293B] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    - Disminuir
                  </button>
                </div>
              </div>

              {/* MONTO DEL AJUSTE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  {adjustmentType === 'set_balance' ? 'Nuevo Saldo Objetivo ($ ARS)' : 'Monto del Ajuste ($ ARS)'}
                </label>
                <FormattedNumberInput
                  value={amount}
                  onChange={(val) => setAmount(val)}
                  placeholder="0,00"
                  className="w-full p-3 text-sm font-bold border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00A86B] outline-none"
                />
              </div>

              {/* MOTIVO O CONCEPTO DEL AJUSTE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Motivo / Concepto del Ajuste Contable
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Reconciliación bancaria, arqueo de caja..."
                  className="w-full p-3 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00A86B] outline-none"
                />
              </div>

              {/* BOTONES ACCION */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#00A86B] hover:bg-[#008f5b] text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Aplicar Ajuste Contable
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
