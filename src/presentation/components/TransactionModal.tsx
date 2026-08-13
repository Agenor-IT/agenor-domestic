import React, { useState } from 'react';
import { PaymentMethodType } from '../../domain/shared/PaymentMethod';
import { X, Save } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  mode: 'nuevo' | 'editar' | 'ver';
  onClose: () => void;
  onSubmit: (data: {
    description: string;
    amount: number;
    direction: 'income' | 'expense';
    paymentMethod: PaymentMethodType;
    occurredOn: string;
  }) => void;
  initialData?: {
    description: string;
    amount: number;
    direction: 'income' | 'expense';
    paymentMethod: PaymentMethodType;
    occurredOn: string;
  };
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSubmit,
  initialData
}) => {
  if (!isOpen) return null;

  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [direction, setDirection] = useState<'income' | 'expense'>(initialData?.direction || 'expense');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(initialData?.paymentMethod || 'cash');
  const [occurredOn, setOccurredOn] = useState(initialData?.occurredOn || new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'ver') {
      onClose();
      return;
    }
    onSubmit({
      description,
      amount,
      direction,
      paymentMethod,
      occurredOn
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-slate-700 transition-colors">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
          <h2 className="text-lg font-bold text-[#172033] dark:text-slate-100">
            {mode === 'nuevo' && 'Registrar Nueva Transacción'}
            {mode === 'editar' && 'Editar Transacción'}
            {mode === 'ver' && 'Ver Detalle de Transacción'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Descripción</label>
            <input
              type="text"
              required
              disabled={mode === 'ver'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 disabled:bg-gray-100 dark:disabled:bg-slate-800"
              placeholder="Ej: Cuota alimentaria, Honorarios, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Monto ($ ARS)</label>
              <input
                type="number"
                step="0.01"
                required
                disabled={mode === 'ver'}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 disabled:bg-gray-100 dark:disabled:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Tipo de Flujo</label>
              <select
                disabled={mode === 'ver'}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'income' | 'expense')}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 disabled:bg-gray-100 dark:disabled:bg-slate-800"
              >
                <option value="income">Ingreso (+)</option>
                <option value="expense">Egreso (-)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Medio de Pago / Cobro</label>
              <select
                disabled={mode === 'ver'}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 disabled:bg-gray-100 dark:disabled:bg-slate-800"
              >
                <option value="cash">Efectivo / Transferencia</option>
                <option value="card">Tarjeta · +1 mes</option>
                <option value="debit">Débito Automático</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Fecha de Operación</label>
              <input
                type="date"
                disabled={mode === 'ver'}
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:border-[#12355b] dark:focus:border-sky-400 disabled:bg-gray-100 dark:disabled:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            {mode !== 'ver' && (
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#12355b] dark:bg-sky-600 hover:bg-[#0d2642] dark:hover:bg-sky-500 rounded-lg shadow-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar Transacción
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
