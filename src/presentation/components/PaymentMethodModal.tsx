import React, { useState, useEffect } from 'react';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X, Save, CreditCard } from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  mode: 'nuevo' | 'editar' | 'ver';
  initialData?: CustomPaymentMethod | null;
  accounts: DomAccountDTO[];
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    type: 'cash' | 'bank' | 'card';
    active: boolean;
    accountId?: number;
    accountCode?: string;
    accountName?: string;
    creditLimit?: number;
    initialAvailable?: number;
    initialBalance?: number;
  }) => void;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  mode,
  initialData,
  accounts,
  onClose,
  onSave
}) => {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'cash' | 'bank' | 'card'>('bank');
  const [active, setActive] = useState<boolean>(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [initialAvailable, setInitialAvailable] = useState<number>(0);
  const [initialBalance, setInitialBalance] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setType(initialData.type || 'bank');
        setActive(initialData.active !== undefined ? initialData.active : true);
        setSelectedAccountId(initialData.accountId ? String(initialData.accountId) : '');
        setCreditLimit(initialData.creditLimit || 0);
        setInitialAvailable(
          initialData.initialAvailable !== undefined
            ? initialData.initialAvailable
            : (initialData.creditLimit || 0)
        );
        setInitialBalance(initialData.initialBalance || 0);
      } else {
        setName('');
        setType('bank');
        setActive(true);
        setSelectedAccountId('');
        setCreditLimit(0);
        setInitialAvailable(0);
        setInitialBalance(0);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'ver') {
      onClose();
      return;
    }
    if (!name.trim()) return;

    const accObj = accounts.find(a => a.id === Number(selectedAccountId));

    onSave({
      id: initialData?.id,
      name: name.trim(),
      type,
      active,
      accountId: accObj?.id,
      accountCode: accObj?.code,
      accountName: accObj?.name,
      creditLimit: type === 'card' ? creditLimit : undefined,
      initialAvailable: type === 'card' ? initialAvailable : undefined,
      initialBalance: type !== 'card' ? initialBalance : undefined
    });
    onClose();
  };

  const getTitle = () => {
    switch (mode) {
      case 'nuevo': return 'Nuevo Medio de Pago';
      case 'editar': return 'Editar Medio de Pago';
      case 'ver': return 'Detalle de Medio de Pago';
    }
  };

  const implicitDebt = Math.max(0, creditLimit - initialAvailable);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-6 relative animate-in fade-in zoom-in duration-150 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-[#0088FF] rounded-xl shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#172033] dark:text-white truncate">
                {getTitle()}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                Configuración del canal financiero e imputación contable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Nombre del Medio de Pago *
            </label>
            <input
              type="text"
              required
              disabled={mode === 'ver'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: CA Naranja, Tarjeta Visa, Efectivo..."
              className="w-full text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0088FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Tipo de Medio *
              </label>
              <select
                disabled={mode === 'ver'}
                value={type}
                onChange={(e) => setType(e.target.value as 'cash' | 'bank' | 'card')}
                className="w-full text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0088FF]"
              >
                <option value="bank">Caja de Ahorro / Banco</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta de Crédito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Estado *
              </label>
              <select
                disabled={mode === 'ver'}
                value={active ? 'activo' : 'inactivo'}
                onChange={(e) => setActive(e.target.value === 'activo')}
                className="w-full text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0088FF]"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          {type === 'card' ? (
            <div className="space-y-4 p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1 whitespace-nowrap">
                    Límite Otorgado ($ ARS)
                  </label>
                  <FormattedNumberInput
                    disabled={mode === 'ver'}
                    value={creditLimit}
                    onChange={(val) => {
                      setCreditLimit(val);
                      if (initialAvailable === 0) setInitialAvailable(val);
                    }}
                    placeholder="0,00"
                    className="w-full text-xs p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-[#0088FF]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Límite total asignado por el banco</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1 whitespace-nowrap">
                    Disponible Actual al Iniciar ($ ARS)
                  </label>
                  <FormattedNumberInput
                    disabled={mode === 'ver'}
                    value={initialAvailable}
                    onChange={(val) => setInitialAvailable(val)}
                    placeholder="0,00"
                    className="w-full text-xs p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-[#0088FF]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Margen libre real hoy</p>
                </div>
              </div>

              <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between border-t border-amber-200 dark:border-amber-900/40 pt-2">
                <span>Deuda Acumulada Implícita al Iniciar:</span>
                <span className="font-mono font-bold">$ {implicitDebt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Saldo Inicial Disponible ($ ARS)
              </label>
              <FormattedNumberInput
                disabled={mode === 'ver'}
                value={initialBalance}
                onChange={(val) => setInitialBalance(val)}
                placeholder="0,00"
                className="w-full text-xs p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-[#0088FF]"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Saldo de efectivo o dinero en cuenta disponible al iniciar el sistema.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Cuenta Contable Asignada por Defecto
            </label>
            <select
              disabled={mode === 'ver'}
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0088FF]"
            >
              <option value="">-- Imputación genérica según tipo --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* ACCIONES FOOTER */}
          <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-2.5 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer text-center"
            >
              {mode === 'ver' ? 'Cerrar' : 'Cancelar'}
            </button>

            {mode !== 'ver' && (
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2.5 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Medio</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
