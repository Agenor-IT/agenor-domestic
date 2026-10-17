import { SearchableSelect } from './SearchableSelect';
import React, { useState } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X, SlidersHorizontal } from 'lucide-react';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { SearchableStructureSelect } from './SearchableStructureSelect';

export interface AdjustmentData {
  componentKey: string;
  componentLabel: string;
  targetSection: 'balance' | 'results';
  adjustmentType: 'set_balance' | 'increase' | 'decrease';
  amount: number;
  reason: string;
  contraAccountId: number;
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAdjustment: (data: AdjustmentData) => Promise<void>;
  liveValues?: Record<string, number | undefined>;
  accounts: DomAccountDTO[];
}

const ADJUSTABLE_COMPONENTS = [
  // SITUACIÓN PATRIMONIAL
  { key: 'bank_available', label: 'Billeteras / Naranja X', section: 'balance' },
  { key: 'bank_accounts', label: 'Cuentas bancarias', section: 'balance' },
  { key: 'cash_available', label: 'Disponible en Efectivo', section: 'balance' },
  { key: 'receivables', label: 'Cuentas por Cobrar', section: 'balance' },
  { key: 'payables', label: 'Proveedores comerciales', section: 'balance' },
  { key: 'card_installments', label: 'Deuda de tarjetas', section: 'balance' },
];

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  onApplyAdjustment,
  liveValues = {},
  accounts
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(ADJUSTABLE_COMPONENTS[0].key);
  const [adjustmentType, setAdjustmentType] = useState<'set_balance' | 'increase' | 'decrease'>('set_balance');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [contraAccountId, setContraAccountId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const currentComp = ADJUSTABLE_COMPONENTS.find(c => c.key === selectedKey) || ADJUSTABLE_COMPONENTS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount < 0 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 || !reason.trim()) {
      setErrorMsg('Ingresá un importe válido y el motivo del ajuste.');
      return;
    }
    if (liveValues[currentComp.key] === undefined) {
      setErrorMsg('No se pudo verificar el saldo de esta cuenta.');
      return;
    }
    if (!contraAccountId) {
      setErrorMsg('Elegí una cuenta de contrapartida.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await onApplyAdjustment({
        componentKey: currentComp.key,
        componentLabel: currentComp.label,
        targetSection: currentComp.section as 'balance' | 'results',
        adjustmentType,
        amount,
        reason: reason.trim(),
        contraAccountId: Number(contraAccountId)
      });
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo registrar el ajuste.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] overflow-hidden transition-all flex flex-col">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1E293B]/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#00A86B] text-white p-2 sm:p-2.5 rounded-xl shadow-md shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">Nuevo Ajuste Contable</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Registrá ambas cuentas y el motivo del ajuste</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO Y FORMULARIO */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {errorMsg && <div role="alert" className="rounded-xl border border-red-500 p-3 text-xs text-red-700 dark:text-red-300">{errorMsg}</div>}
              {/* SELECTOR DE COMPONENTE A AJUSTAR */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Componente a Ajustar
                </label>
                <SearchableSelect
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00A86B] outline-none"
                >
                  <optgroup label="Situación Patrimonial (Balance)">
                    {ADJUSTABLE_COMPONENTS.filter(c => c.section === 'balance').map(c => {
                      const liveVal = liveValues[c.key];
                      return (
                        <option key={c.key} value={c.key}>
                          {c.label} · {liveVal === undefined ? 'Saldo no disponible' : `$ ${liveVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                        </option>
                      );
                    })}
                  </optgroup>
                </SearchableSelect>
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
                <label htmlFor="adjustment-counterpart" className="mb-1.5 block text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                  Cuenta de contrapartida *
                </label>
                <SearchableStructureSelect
                  id="adjustment-counterpart"
                  value={contraAccountId}
                  options={accounts.filter(account => !account.isArchived).map(account => ({
                    id: String(account.id),
                    label: `${account.code} · ${account.name}`,
                    detail: account.kind
                  }))}
                  onChange={setContraAccountId}
                  placeholder="Buscar cuenta por código o nombre"
                  emptyLabel="No hay cuentas disponibles."
                  disabled={saving}
                  accent="emerald"
                />
                <p className="mt-1 text-[10px] text-gray-500">Una transferencia o una deuda no se registran como ingreso.</p>
              </div>

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

          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-gray-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-[#0F172A] sm:flex-row sm:gap-3 sm:px-6 sm:pb-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="w-full sm:flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:flex-1 py-3 bg-[#00A86B] hover:bg-[#008f5b] text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  Aplicar Ajuste Contable
                </button>
          </div>
        </form>
      </div>
    </div>
  );
};
