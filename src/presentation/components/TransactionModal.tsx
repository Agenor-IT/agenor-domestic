import React, { useState, useEffect, useMemo } from 'react';
import { CustomPaymentMethod, DEFAULT_CUSTOM_PAYMENT_METHODS } from '../../domain/shared/PaymentMethod';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  X,
  Save,
  FileText,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Info
} from 'lucide-react';
import { SupabaseDomExpenseRepository } from '../../infrastructure/SupabaseDomExpenseRepository';
import { SupabaseDomVentureRepository } from '../../infrastructure/SupabaseDomVentureRepository';
import { DomExpenseDTO } from '../../domain/expenses/DomExpense';
import { DomVentureDTO } from '../../domain/ventures/DomVenture';
import { Money } from '../../domain/shared/Money';

export interface TransactionSubmitData {
  description: string;
  amount: number;
  direction: 'income' | 'expense';
  paymentMethod: string;
  occurredOn: string;
  accrualType: 'devengado' | 'percibido' | 'contado';
  opNumber: string;
  counterparty: string;
  operationType: 'venta' | 'compra' | 'cobro' | 'pago' | 'canje' | 'alquiler_ganado' | 'alquiler_perdido' | 'honorarios';
  paymentCondition: 'contado' | 'cta_cte';
  linkedExpenseId?: string;
  linkedVentureId?: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  mode: 'nuevo' | 'editar' | 'ver';
  onClose: () => void;
  onSubmit: (data: TransactionSubmitData) => void;
  paymentMethods?: CustomPaymentMethod[];
  initialData?: Partial<TransactionSubmitData>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSubmit,
  paymentMethods = DEFAULT_CUSTOM_PAYMENT_METHODS,
  initialData
}) => {
  const activeMethods = paymentMethods.filter(pm => pm.active);
  const defaultMethodId = activeMethods[0]?.id || 'efectivo';
  const defaultOpNum = `OP-${Date.now().toString().slice(-4)}`;

  const expenseRepo = useMemo(() => new SupabaseDomExpenseRepository(), []);
  const ventureRepo = useMemo(() => new SupabaseDomVentureRepository(), []);

  const [expensesList, setExpensesList] = useState<DomExpenseDTO[]>([]);
  const [venturesList, setVenturesList] = useState<DomVentureDTO[]>([]);

  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [direction, setDirection] = useState<'income' | 'expense'>(initialData?.direction || 'income');
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData?.paymentMethod || defaultMethodId);
  const [occurredOn, setOccurredOn] = useState(initialData?.occurredOn || new Date().toISOString().split('T')[0]);
  const [opNumber, setOpNumber] = useState(initialData?.opNumber || defaultOpNum);
  const [counterparty, setCounterparty] = useState(initialData?.counterparty || '');
  const [operationType, setOperationType] = useState<'venta' | 'compra' | 'cobro' | 'pago' | 'canje' | 'alquiler_ganado' | 'alquiler_perdido' | 'honorarios'>(
    initialData?.operationType || 'venta'
  );
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'cta_cte'>(
    initialData?.paymentCondition || 'contado'
  );

  const [linkedExpenseId, setLinkedExpenseId] = useState<string>(initialData?.linkedExpenseId || '');
  const [linkedVentureId, setLinkedVentureId] = useState<string>(initialData?.linkedVentureId || '');

  // Carga de egresos y fuentes de ingresos disponibles
  useEffect(() => {
    if (isOpen) {
      expenseRepo.getExpenses(1)
        .then(data => setExpensesList(data.filter(e => e.status === 'activo')))
        .catch(err => console.error('Error cargando dom_expenses en modal:', err));

      ventureRepo.getVentures(1)
        .then(data => setVenturesList(data.filter(v => v.status === 'activo')))
        .catch(err => console.error('Error cargando dom_ventures en modal:', err));
    }
  }, [isOpen, expenseRepo, ventureRepo]);

  useEffect(() => {
    if (isOpen) {
      setDescription(initialData?.description || '');
      setAmount(initialData?.amount || 0);
      setDirection(initialData?.direction || 'income');
      setPaymentMethod(initialData?.paymentMethod || defaultMethodId);
      setOccurredOn(initialData?.occurredOn || new Date().toISOString().split('T')[0]);
      setOpNumber(initialData?.opNumber || `OP-${Date.now().toString().slice(-4)}`);
      setCounterparty(initialData?.counterparty || '');
      setOperationType(initialData?.operationType || 'venta');
      setPaymentCondition(initialData?.paymentCondition || 'contado');
      setLinkedExpenseId(initialData?.linkedExpenseId || '');
      setLinkedVentureId(initialData?.linkedVentureId || '');
    }
  }, [isOpen, initialData, defaultMethodId]);

  if (!isOpen) return null;

  const handleOperationTypeChange = (type: 'venta' | 'compra' | 'cobro' | 'pago' | 'canje' | 'alquiler_ganado' | 'alquiler_perdido' | 'honorarios') => {
    setOperationType(type);
    if (type === 'venta' || type === 'cobro' || type === 'alquiler_ganado' || type === 'honorarios') {
      setDirection('income');
      setLinkedExpenseId('');
    } else if (type === 'compra' || type === 'pago' || type === 'alquiler_perdido') {
      setDirection('expense');
      setLinkedVentureId('');
    }
  };

  // Agrupamiento de egresos por categoría
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, DomExpenseDTO[]> = {};
    expensesList.forEach(exp => {
      const cat = exp.category || 'Varios';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(exp);
    });
    return groups;
  }, [expensesList]);

  // Selección de egreso vinculado
  const handleSelectExpense = (id: string) => {
    setLinkedExpenseId(id);
    if (!id || id === 'otro') return;
    const found = expensesList.find(e => e.id === id);
    if (found) {
      setCounterparty(found.supplierName);
      setDescription(found.concept);
      if (!amount || amount === 0) {
        setAmount(found.baseMonthlyAmount);
      }
    }
  };

  // Selección de fuente de ingreso vinculada
  const handleSelectVenture = (id: string) => {
    setLinkedVentureId(id);
    if (!id || id === 'otro') return;
    const found = venturesList.find(v => v.id === id);
    if (found) {
      setCounterparty(found.clientName);
      setDescription(found.projectName);
      if (!amount || amount === 0) {
        setAmount(found.baseMonthlyAmount);
      }
    }
  };

  const selectedExpenseObj = expensesList.find(e => e.id === linkedExpenseId);
  const selectedVentureObj = venturesList.find(v => v.id === linkedVentureId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'ver') {
      onClose();
      return;
    }

    const calculatedAccrualType = paymentCondition === 'contado' ? 'contado' : 'devengado';

    onSubmit({
      description: description || `${operationType.toUpperCase()} - ${counterparty || 'General'}`,
      amount,
      direction,
      paymentMethod: paymentCondition === 'contado' ? paymentMethod : 'cta_cte',
      occurredOn,
      accrualType: calculatedAccrualType,
      opNumber: opNumber || defaultOpNum,
      counterparty: counterparty || 'Cliente / Proveedor General',
      operationType,
      paymentCondition,
      linkedExpenseId: linkedExpenseId && linkedExpenseId !== 'otro' ? linkedExpenseId : undefined,
      linkedVentureId: linkedVentureId && linkedVentureId !== 'otro' ? linkedVentureId : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0F172A] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 transition-all flex flex-col my-0 sm:my-8">
        {/* HEADER AGRANDADO */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-[#1E293B] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-[#0088FF]/10 text-[#0088FF] dark:text-blue-400 rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#172033] dark:text-white flex items-center gap-2 flex-wrap">
                <span className="truncate">
                  {mode === 'nuevo' && 'Registrar Operación Contable'}
                  {mode === 'editar' && 'Editar Operación Contable'}
                  {mode === 'ver' && 'Ver Detalle de Operación'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  direction === 'income'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {direction === 'income' ? 'Ingreso' : 'Egreso'}
                </span>
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Imputación en Partida Doble y sincronización con el Valor Actual de la estructura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs overflow-y-auto flex-1">
          {/* SECCIÓN 1: TIPO DE OPERACIÓN Y CONDICIÓN DE PAGO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Operación *
              </label>
              <select
                disabled={mode === 'ver'}
                value={operationType}
                onChange={(e) => handleOperationTypeChange(e.target.value as any)}
                className="w-full font-bold border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF]"
              >
                <optgroup label="Egresos y Compras">
                  <option value="compra">🛒 Compra (Egreso / Insumos / Servicios)</option>
                  <option value="pago">💳 Pago (Cancela Deuda / Pasivo)</option>
                  <option value="alquiler_perdido">🏘️ Alquileres Perdidos (Egreso)</option>
                </optgroup>
                <optgroup label="Ingresos y Ventas">
                  <option value="venta">📈 Venta (Ingreso)</option>
                  <option value="cobro">💵 Cobro (Cancela Cta Cte / Activo)</option>
                  <option value="alquiler_ganado">🏠 Alquileres Ganados (Ingreso)</option>
                  <option value="honorarios">💼 Honorarios / Servicios</option>
                </optgroup>
                <optgroup label="Otros">
                  <option value="canje">🔄 Canje / Permuta (Compensación)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Condición de Pago / Imputación *
              </label>
              <select
                disabled={mode === 'ver'}
                value={paymentCondition}
                onChange={(e) => setPaymentCondition(e.target.value as any)}
                className="w-full font-bold border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF]"
              >
                <option value="contado">⚡ Contado (Afecta Tesorería / Caja / Banco)</option>
                <option value="cta_cte">📄 Cuenta Corriente (Cta Cte / Imputa Activo o Pasivo)</option>
              </select>
            </div>
          </div>

          {/* SECCIÓN 2: VÍNCULO CON ESTRUCTURA (COMPRA -> EGRESOS, VENTA -> FUENTES DE INGRESO) */}
          <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-xl p-3 sm:p-4 space-y-2.5">
            {direction === 'expense' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <ShoppingCart className="w-4 h-4 shrink-0" />
                    <span>Concepto / Egreso a Vincular</span>
                  </label>
                  <span className="text-[10px] text-gray-500">
                    Sincroniza el Valor Actual en Estructura de Egresos
                  </span>
                </div>
                <select
                  disabled={mode === 'ver'}
                  value={linkedExpenseId}
                  onChange={(e) => handleSelectExpense(e.target.value)}
                  className="w-full font-bold border border-rose-200 dark:border-rose-900/40 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- Seleccionar Egreso / Concepto de Compra --</option>
                  {Object.entries(groupedExpenses).map(([category, items]) => (
                    <optgroup key={category} label={`📂 ${category}`}>
                      {items.map(exp => (
                        <option key={exp.id} value={exp.id}>
                          {exp.supplierName} — {exp.concept} (Valor Actual: {Money.fromAmount(exp.baseMonthlyAmount).toFormattedString()})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="otro">➕ Otro concepto libre (sin vincular a estructura)</option>
                </select>

                {selectedExpenseObj && (
                  <div className="flex items-start sm:items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-medium animate-in fade-in duration-150">
                    <Info className="w-4 h-4 shrink-0 text-rose-500 mt-0.5 sm:mt-0" />
                    <span>
                      Al guardar esta operación, el <strong>Valor Actual</strong> de <strong>"{selectedExpenseObj.supplierName} - {selectedExpenseObj.concept}"</strong> se actualizará al monto ingresado, impactando automáticamente en las proyecciones financieras.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>Fuente de Ingreso / Concepto a Vincular</span>
                  </label>
                  <span className="text-[10px] text-gray-500">
                    Sincroniza el Valor Actual en Fuentes de Ingresos
                  </span>
                </div>
                <select
                  disabled={mode === 'ver'}
                  value={linkedVentureId}
                  onChange={(e) => handleSelectVenture(e.target.value)}
                  className="w-full font-bold border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Seleccionar Fuente de Ingreso / Concepto --</option>
                  {venturesList.map(ven => (
                    <option key={ven.id} value={ven.id}>
                      {ven.clientName} — {ven.projectName} ({ven.sourceType || 'emprendimiento'}) (Valor Actual: {Money.fromAmount(ven.baseMonthlyAmount).toFormattedString()})
                    </option>
                  ))}
                  <option value="otro">➕ Otro ingreso libre (sin vincular a fuentes)</option>
                </select>

                {selectedVentureObj && (
                  <div className="flex items-start sm:items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium animate-in fade-in duration-150">
                    <Info className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5 sm:mt-0" />
                    <span>
                      Al guardar esta operación, el <strong>Valor Actual</strong> de <strong>"{selectedVentureObj.clientName} - {selectedVentureObj.projectName}"</strong> se actualizará al monto ingresado, impactando automáticamente en el flujo y proyección de ingresos.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* SECCIÓN 3: FECHA, N° OP Y CONTRAPARTE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Fecha Operación *
              </label>
              <input
                type="date"
                required
                disabled={mode === 'ver'}
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                N° Operación / Ref *
              </label>
              <input
                type="text"
                required
                disabled={mode === 'ver'}
                value={opNumber}
                onChange={(e) => setOpNumber(e.target.value)}
                placeholder="ej. OP-1002 / FC-0001"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Contraparte ({direction === 'income' ? 'Cliente / Pagador' : 'Proveedor / Beneficiario'}) *
              </label>
              <input
                type="text"
                required
                disabled={mode === 'ver'}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={direction === 'income' ? 'ej. Tupperware / Consumidor Final' : 'ej. EPEC / AFIP / Supermercado'}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-medium"
              />
            </div>
          </div>

          {/* SECCIÓN 4: MONTO Y MEDIO DE PAGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Monto Total ($ ARS) *
              </label>
              <FormattedNumberInput
                disabled={mode === 'ver'}
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0,00"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-[#0088FF] dark:text-blue-400 text-base font-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                {paymentCondition === 'contado' ? 'Medio de Pago / Cuenta Tesorería *' : 'Imputación Contable Automática'}
              </label>
              {paymentCondition === 'contado' ? (
                <select
                  disabled={mode === 'ver'}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full font-bold border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF]"
                >
                  {activeMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} {pm.accountCode ? `(${pm.accountCode} - ${pm.accountName})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>
                    {direction === 'income' ? 'Imputa a Activo: 1.1.03.01 Cuentas por Cobrar' : 'Imputa a Pasivo: 2.1.01.01 Cuentas por Pagar'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5: DESCRIPCIÓN */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              Descripción / Leyenda Operativa
            </label>
            <input
              type="text"
              disabled={mode === 'ver'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-medium"
              placeholder="Ej: Factura de servicio / Pago mensual / Cobro honorarios"
            />
          </div>

          {/* ACCIONES */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancelar
            </button>
            {mode !== 'ver' && (
              <button
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-white bg-[#0088FF] hover:bg-[#0077EE] rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Operación</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
