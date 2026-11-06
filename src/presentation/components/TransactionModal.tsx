import { SearchableSelect } from './SearchableSelect';
import React, { useState, useEffect, useMemo } from 'react';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  X,
  Save,
  FileText,
  CreditCard,
    TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { SupabaseDomExpenseRepository } from '../../infrastructure/SupabaseDomExpenseRepository';
import { SupabaseDomVentureRepository } from '../../infrastructure/SupabaseDomVentureRepository';
import { DomExpenseDTO } from '../../domain/expenses/DomExpense';
import { DomVentureDTO } from '../../domain/ventures/DomVenture';
import { Money } from '../../domain/shared/Money';
import { useDomesticAccess } from '../auth/DomesticAuthGate';
import { SearchableStructureSelect, StructureOption } from './SearchableStructureSelect';
import { TransactionItem } from './TransactionsPanel';
import { argentinaDate } from '../../domain/shared/argentinaDate';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { ReceiptDraft } from '../../domain/receipts/ReceiptDraft';
import { PurchaseItemInput, validatePurchaseItems } from '../../domain/consumption/Consumption';
import { PurchaseItemsEditor } from './PurchaseItemsEditor';

export interface TransactionSubmitData {
  description: string;
  amount: number;
  direction: 'income' | 'expense';
  paymentMethod: string;
  occurredOn: string;
  accrualType: 'devengado' | 'percibido' | 'contado';
  opNumber: string;
  counterparty: string;
  operationType: 'venta' | 'compra' | 'cobro' | 'pago' | 'pago_tarjeta' | 'canje' | 'alquiler_ganado' | 'alquiler_perdido' | 'honorarios';
  paymentCondition: 'contado' | 'cta_cte';
  linkedExpenseId?: string;
  linkedVentureId?: string;
  settlesTransactionId?: string | null;
  requestId: string;
  classificationAccountId?: number | null;
  purchaseItems?: PurchaseItemInput[];
}

interface TransactionModalProps {
  isOpen: boolean;
  mode: 'nuevo' | 'editar' | 'ver';
  onClose: () => void;
  onSubmit: (data: TransactionSubmitData) => Promise<void>;
  paymentMethods: CustomPaymentMethod[];
  accounts: DomAccountDTO[];
  transactions: TransactionItem[];
  initialData?: Partial<TransactionSubmitData> & { id?: string };
  receiptDraft?: ReceiptDraft;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSubmit,
  paymentMethods,
  accounts,
  transactions,
  initialData,
  receiptDraft
}) => {
  const { personaPadreId } = useDomesticAccess();
  const activeMethods = paymentMethods.filter(pm => pm.active);
  const defaultMethodId = activeMethods.find(method => method.type !== 'card')?.id || activeMethods[0]?.id || '';
  const defaultOpNum = `OP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const expenseRepo = useMemo(() => new SupabaseDomExpenseRepository(), []);
  const ventureRepo = useMemo(() => new SupabaseDomVentureRepository(), []);

  const [expensesList, setExpensesList] = useState<DomExpenseDTO[]>([]);
  const [venturesList, setVenturesList] = useState<DomVentureDTO[]>([]);

  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [direction, setDirection] = useState<'income' | 'expense'>(initialData?.direction || 'income');
  const [paymentMethod, setPaymentMethod] = useState<string>(receiptDraft ? '' : initialData?.paymentMethod || defaultMethodId);
  const [occurredOn, setOccurredOn] = useState(initialData?.occurredOn ?? argentinaDate());
  const [opNumber, setOpNumber] = useState(initialData?.opNumber ?? defaultOpNum);
  const [counterparty, setCounterparty] = useState(initialData?.counterparty || '');
  const [operationType, setOperationType] = useState<TransactionSubmitData['operationType']>(
    initialData?.operationType || 'venta'
  );
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'cta_cte'>(
    initialData?.paymentCondition || 'contado'
  );

  const [linkedExpenseId, setLinkedExpenseId] = useState<string>(initialData?.linkedExpenseId || '');
  const [linkedVentureId, setLinkedVentureId] = useState<string>(initialData?.linkedVentureId || '');
  const [settlesTransactionId, setSettlesTransactionId] = useState(initialData?.settlesTransactionId || '');
  const [classificationAccountId, setClassificationAccountId] = useState(
    initialData?.classificationAccountId ? String(initialData.classificationAccountId) : ''
  );
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptPaymentConfirmed, setReceiptPaymentConfirmed] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemInput[]>(initialData?.purchaseItems ?? []);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(receiptDraft || (initialData?.purchaseItems && initialData.purchaseItems.length > 0)));

  const handleDirectionToggle = (dir: 'income' | 'expense') => {
    if (dir === direction) return;
    setDirection(dir);
    if (dir === 'expense') {
      setOperationType('compra');
      setLinkedVentureId('');
    } else {
      setOperationType('venta');
      setLinkedExpenseId('');
    }
    setClassificationAccountId('');
    setSettlesTransactionId('');
  };

  // Carga de egresos y fuentes de ingresos disponibles
  useEffect(() => {
    if (isOpen) {
      expenseRepo.getExpenses(personaPadreId)
        .then(data => setExpensesList(data.filter(e => e.status === 'activo')))
        .catch(err => console.error('Error cargando dom_expenses en modal:', err));

      ventureRepo.getVentures(personaPadreId)
        .then(data => setVenturesList(data.filter(v => v.status === 'activo')))
        .catch(err => console.error('Error cargando dom_ventures en modal:', err));
    }
  }, [isOpen, expenseRepo, ventureRepo, personaPadreId]);

  useEffect(() => {
    if (isOpen) {
      setDescription(initialData?.description || '');
      setAmount(initialData?.amount || 0);
      setDirection(initialData?.direction || 'income');
      setPaymentMethod(receiptDraft ? '' : initialData?.paymentMethod || defaultMethodId);
      setOccurredOn(initialData?.occurredOn ?? argentinaDate());
      setOpNumber(initialData?.opNumber ?? `OP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
      setCounterparty(initialData?.counterparty || '');
      setOperationType(initialData?.operationType || 'venta');
      setPaymentCondition(initialData?.paymentCondition || 'contado');
      setLinkedExpenseId(initialData?.linkedExpenseId || '');
      setLinkedVentureId(initialData?.linkedVentureId || '');
      setSettlesTransactionId(initialData?.settlesTransactionId || '');
      setClassificationAccountId(initialData?.classificationAccountId ? String(initialData.classificationAccountId) : '');
      setRequestId(crypto.randomUUID());
      setSubmitError(null);
      setReceiptPaymentConfirmed(false);
      setPurchaseItems(initialData?.purchaseItems ?? []);
      setShowAdvanced(Boolean(receiptDraft || (initialData?.purchaseItems && initialData.purchaseItems.length > 0)));
    }
  }, [isOpen, initialData, defaultMethodId, receiptDraft]);

  const handleOperationTypeChange = (type: TransactionSubmitData['operationType']) => {
    setOperationType(type);
    setSettlesTransactionId('');
    setClassificationAccountId('');
    if (type === 'cobro' || type === 'pago' || type === 'pago_tarjeta') {
      setPaymentCondition('contado');
      if (activeMethods.find(method => method.id === paymentMethod)?.type === 'card') {
        setPaymentMethod(activeMethods.find(method => method.type !== 'card')?.id || '');
      }
    }
    if (type === 'venta' || type === 'cobro' || type === 'alquiler_ganado' || type === 'honorarios') {
      setDirection('income');
      setLinkedExpenseId('');
    } else if (type === 'compra' || type === 'pago' || type === 'pago_tarjeta' || type === 'alquiler_perdido') {
      setDirection('expense');
      setLinkedVentureId('');
    }
  };

  const expenseOptions = useMemo<StructureOption[]>(() => [
    ...expensesList.map(exp => ({
      id: exp.id,
      label: `${exp.supplierName} — ${exp.concept}`,
      detail: `${exp.category || 'Varios'} · Valor actual: ${Money.fromAmount(exp.baseMonthlyAmount).toFormattedString()}`
    })),
    { id: 'otro', label: 'Otro concepto libre', detail: 'Sin vincular a la estructura de egresos' }
  ], [expensesList]);

  const ventureOptions = useMemo<StructureOption[]>(() => [
    ...venturesList.map(ven => ({
      id: ven.id,
      label: `${ven.clientName} — ${ven.projectName}`,
      detail: `${ven.sourceType || 'emprendimiento'} · Valor actual: ${Money.fromAmount(ven.baseMonthlyAmount).toFormattedString()}`
    })),
    { id: 'otro', label: 'Otro ingreso libre', detail: 'Sin vincular a fuentes de ingresos' }
  ], [venturesList]);

  const settlementOptions = useMemo<StructureOption[]>(() => transactions
    .filter(tx => tx.paymentCondition === 'cta_cte' && tx.journalEntryId != null && !tx.settlesTransactionId &&
      (operationType === 'cobro'
        ? ['venta', 'honorarios', 'alquiler_ganado'].includes(tx.operationType || '')
        : operationType === 'pago' && ['compra', 'alquiler_perdido'].includes(tx.operationType || '')))
    .map(tx => {
      const settled = transactions
        .filter(item => item.settlesTransactionId === tx.id && item.id !== initialData?.id)
        .reduce((sum, item) => sum + item.amount, 0);
      const pending = Math.round((tx.amount - settled) * 100) / 100;
      return { tx, pending };
    })
    .filter(item => item.pending > 0)
    .map(({ tx, pending }) => ({
      id: tx.id,
      label: `${tx.opNumber || tx.occurredOn} · ${tx.counterparty || tx.description}`,
      detail: `Pendiente ${Money.fromAmount(pending).toFormattedString()}`,
      searchText: `${tx.description} ${tx.occurredOn}`
    })), [transactions, operationType, initialData?.id]);
  const requiresClassification = !['cobro', 'pago', 'pago_tarjeta'].includes(operationType);
  const classificationOptions = accounts
    .filter(account => !account.isArchived &&
      (account.kind === direction || (operationType === 'compra' && account.kind === 'asset' &&
        (account.code.startsWith('1.2.01.') || account.code.startsWith('1.1.05.')))) &&
      account.nature === (direction === 'income' ? 'credit' : 'debit'))
    .map(account => ({
      id: String(account.id),
      label: `${account.code} · ${account.name}`,
      detail: account.kind === 'asset' ? 'Bien capitalizable' : direction === 'income' ? 'Ingreso' : 'Gasto'
    }));

  if (!isOpen) return null;

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
  const handleSelectSettlement = (id: string) => {
    setSettlesTransactionId(id);
    const source = transactions.find(tx => tx.id === id);
    if (!source) return;
    const settled = transactions
      .filter(tx => tx.settlesTransactionId === id && tx.id !== initialData?.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    setCounterparty(source.counterparty || '');
    setAmount(Math.max(0, Math.round((source.amount - settled) * 100) / 100));
    setDescription(`${operationType === 'cobro' ? 'Cobro' : 'Pago'} de ${source.opNumber || source.description}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'ver') {
      onClose();
      return;
    }

    const calculatedAccrualType = paymentCondition === 'contado' ? 'contado' : 'devengado';
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      setSubmitError('Ingresá un importe positivo con hasta dos decimales.');
      return;
    }
    if (receiptDraft && !receiptPaymentConfirmed) {
      setSubmitError('Indicá si el comprobante está pagado o queda en cuenta corriente.');
      return;
    }
    if (!description.trim() || !counterparty.trim() || !opNumber.trim()) {
      setSubmitError('Completá concepto, contraparte y número de operación.');
      return;
    }
    if (['cobro', 'pago'].includes(operationType) && !settlesTransactionId) {
      setSubmitError('Seleccioná la operación pendiente que estás cancelando.');
      return;
    }
    if (requiresClassification && !classificationAccountId) {
      setSubmitError('Seleccioná la cuenta contable del ingreso o gasto.');
      return;
    }
    if (operationType !== 'compra' && purchaseItems.length) {
      setSubmitError('El detalle de productos pertenece a una compra. Quitá los renglones antes de cambiar el tipo de operación.');
      return;
    }
    let validatedItems: PurchaseItemInput[] | undefined;
    try {
      if (operationType === 'compra' && (purchaseItems.length || initialData?.purchaseItems !== undefined)) validatedItems = validatePurchaseItems(purchaseItems);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Detalle de compra inválido.'); return; }
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({
      description: description.trim(),
      amount,
      direction,
      paymentMethod: paymentCondition === 'contado' ? paymentMethod : 'cta_cte',
      occurredOn,
      accrualType: calculatedAccrualType,
      opNumber: opNumber.trim(),
      counterparty: counterparty.trim(),
      operationType,
      paymentCondition,
      linkedExpenseId: linkedExpenseId && linkedExpenseId !== 'otro' ? linkedExpenseId : undefined,
      linkedVentureId: linkedVentureId && linkedVentureId !== 'otro' ? linkedVentureId : undefined,
      settlesTransactionId: settlesTransactionId || null,
      requestId,
      classificationAccountId: requiresClassification ? Number(classificationAccountId) : null,
      purchaseItems: validatedItems
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar la operación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 transition-all flex flex-col">
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
                Imputación en partida doble; los presupuestos permanecen separados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col text-xs">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 sm:p-6">
          {receiptDraft && <div role="status" className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
            <p className="font-bold">Datos leídos del comprobante. Revisalos antes de guardar.</p>
            <p>Completá los campos faltantes y elegí la cuenta contable y la condición de pago. Una factura no acredita un pago.</p>
            {receiptDraft.currency !== 'ARS' && <p className="font-bold">Moneda detectada: {receiptDraft.currency ?? 'sin identificar'}. El importe quedó vacío: ingresá el valor en pesos que corresponda.</p>}
          </div>}

          {/* 1. SELECTOR SUPERIOR DIRECTO: GASTO vs INGRESO */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 dark:bg-[#1E293B] rounded-2xl">
            <button
              type="button"
              disabled={mode === 'ver'}
              onClick={() => handleDirectionToggle('expense')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                direction === 'expense'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span>🔴 Registrar Gasto</span>
            </button>
            <button
              type="button"
              disabled={mode === 'ver'}
              onClick={() => handleDirectionToggle('income')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                direction === 'income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>🟢 Registrar Ingreso</span>
            </button>
          </div>

          {/* 2. IMPORTE DESTACADO & CONCEPTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Importe Total ($ ARS) *
              </label>
              <FormattedNumberInput
                disabled={mode === 'ver'}
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0,00"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white text-lg font-black focus:ring-2 focus:ring-[#0088FF]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                {direction === 'expense' ? '¿En qué gastaste? (Concepto) *' : 'Concepto del ingreso *'}
              </label>
              {receiptDraft ? (
                <textarea
                  required
                  disabled={mode === 'ver'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={direction === 'expense' ? 'ej. Supermercado mensual, Nafta, Factura Luz' : 'ej. Sueldo del mes, Cobro honorarios'}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-[#0088FF]"
                />
              ) : (
                <input
                  type="text"
                  required
                  disabled={mode === 'ver'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={direction === 'expense' ? 'ej. Supermercado mensual, Nafta, Factura Luz' : 'ej. Sueldo del mes, Cobro honorarios'}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-[#0088FF]"
                />
              )}
            </div>
          </div>

          {/* 3. LUGAR/PROVEEDOR Y FECHA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                {direction === 'expense' ? 'Comercio / Lugar / Proveedor *' : 'Cliente / Pagador / Origen *'}
              </label>
              <input
                type="text"
                required
                disabled={mode === 'ver' || (['cobro', 'pago'].includes(operationType) && !!settlesTransactionId)}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={direction === 'expense' ? 'ej. Coto, YPF, Movistar' : 'ej. Empresa Empleadora, Cliente'}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0088FF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Fecha de la Operación *
              </label>
              <input
                type="date"
                required
                max={argentinaDate()}
                disabled={mode === 'ver'}
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-[#0088FF]"
              />
            </div>
          </div>

          {/* 4. MEDIO DE PAGO Y CATEGORÍA CONTABLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                {paymentCondition === 'contado' ? '¿Cómo se pagó? (Medio de Pago) *' : 'Condición de Pago'}
              </label>
              {receiptDraft && !receiptPaymentConfirmed ? (
                <p className="rounded-xl bg-gray-50 p-2.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Seleccioná la condición de pago.</p>
              ) : paymentCondition === 'contado' ? (
                <SearchableSelect
                  disabled={mode === 'ver'}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full font-bold border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF]"
                >
                  {activeMethods.filter(pm => pm.type !== 'card' || ['compra', 'alquiler_perdido'].includes(operationType)).map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}{pm.accountCode ? ` · ${pm.accountCode}` : ''}
                    </option>
                  ))}
                </SearchableSelect>
              ) : (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>
                    {direction === 'income' ? 'A cobrar (Cuenta Corriente 1.1.03.01)' : 'A pagar (Cuenta Corriente 2.1.01.01)'}
                  </span>
                </div>
              )}
              {operationType !== 'cobro' && operationType !== 'pago' && operationType !== 'pago_tarjeta' && (
                <label className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={mode === 'ver'}
                    checked={paymentCondition === 'cta_cte'}
                    onChange={(e) => {
                      setPaymentCondition(e.target.checked ? 'cta_cte' : 'contado');
                      setReceiptPaymentConfirmed(true);
                    }}
                    className="rounded text-[#0088FF]"
                  />
                  <span>Queda pendiente de pago (cuenta corriente)</span>
                </label>
              )}
            </div>

            {requiresClassification && (
              <div>
                <label htmlFor="transaction-classification" className="mb-1 block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  Categoría contable *
                </label>
                <SearchableStructureSelect
                  id="transaction-classification"
                  value={classificationAccountId}
                  options={classificationOptions}
                  onChange={setClassificationAccountId}
                  placeholder={direction === 'expense' ? 'Elegí el rubro (Alimentos, Servicios, etc.)' : 'Elegí el rubro de ingreso'}
                  emptyLabel="No hay cuentas de resultado disponibles."
                  disabled={mode === 'ver'}
                  accent={direction === 'income' ? 'emerald' : 'rose'}
                />
              </div>
            )}
          </div>

          {/* 5. OPCIONES AVANZADAS Y COMPROBANTE (COLAPSABLE) */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1E293B]/60 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>⚙️ Opciones avanzadas y comprobante</span>
                {(opNumber !== defaultOpNum || linkedExpenseId || linkedVentureId || settlesTransactionId || purchaseItems.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-[#0088FF]" />
                )}
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 bg-white dark:bg-[#0F172A] border-t border-gray-200 dark:border-gray-800 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      N° Operación / Factura / Ticket
                    </label>
                    <input
                      type="text"
                      disabled={mode === 'ver'}
                      value={opNumber}
                      onChange={(e) => setOpNumber(e.target.value)}
                      placeholder="ej. OP-1002 / FC-0001"
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo técnico de operación
                    </label>
                    <SearchableSelect
                      disabled={mode === 'ver'}
                      value={operationType}
                      onChange={(e) => handleOperationTypeChange(e.target.value as any)}
                      className="w-full font-bold border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 outline-none bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                    >
                      <optgroup label="Egresos y Compras">
                        <option value="compra">Compra habitual</option>
                        <option value="pago">Pago de deuda previa</option>
                        <option value="pago_tarjeta">Pago de resumen tarjeta</option>
                        <option value="alquiler_perdido">Alquiler pagado</option>
                      </optgroup>
                      <optgroup label="Ingresos y Ventas">
                        <option value="venta">Venta / Ingreso general</option>
                        <option value="cobro">Cobro de cuenta corriente</option>
                        <option value="alquiler_ganado">Alquiler cobrado</option>
                        <option value="honorarios">Honorarios profesionales</option>
                      </optgroup>
                    </SearchableSelect>
                  </div>
                </div>

                {/* Vínculo con presupuesto */}
                {direction === 'expense' && operationType !== 'pago_tarjeta' && (
                  <div>
                    <label htmlFor="transaction-expense-search" className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block mb-1">
                      Vincular a presupuesto de egresos recurrente (opcional)
                    </label>
                    <SearchableStructureSelect
                      id="transaction-expense-search"
                      value={linkedExpenseId}
                      options={expenseOptions}
                      onChange={handleSelectExpense}
                      placeholder="Buscar en presupuesto..."
                      emptyLabel="No hay egresos en el presupuesto."
                      disabled={mode === 'ver'}
                      accent="rose"
                    />
                    {selectedExpenseObj && (
                      <div className="mt-2 flex items-start sm:items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                        <Info className="w-4 h-4 shrink-0 text-rose-500 mt-0.5 sm:mt-0" />
                        <span>Se autocompleta desde <strong>"{selectedExpenseObj.supplierName} - {selectedExpenseObj.concept}"</strong>.</span>
                      </div>
                    )}
                  </div>
                )}

                {direction === 'income' && (
                  <div>
                    <label htmlFor="transaction-venture-search" className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                      Vincular a fuente de ingreso presupuestada (opcional)
                    </label>
                    <SearchableStructureSelect
                      id="transaction-venture-search"
                      value={linkedVentureId}
                      options={ventureOptions}
                      onChange={handleSelectVenture}
                      placeholder="Buscar en fuentes de ingreso..."
                      emptyLabel="No hay fuentes presupuestadas."
                      disabled={mode === 'ver'}
                      accent="emerald"
                    />
                    {selectedVentureObj && (
                      <div className="mt-2 flex items-start sm:items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                        <Info className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5 sm:mt-0" />
                        <span>Se autocompleta desde <strong>"{selectedVentureObj.clientName} - {selectedVentureObj.projectName}"</strong>.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancelación de operaciones pendientes */}
                {(operationType === 'cobro' || operationType === 'pago') && (
                  <div>
                    <label htmlFor="transaction-settlement-search" className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block mb-1">
                      Operación pendiente a cancelar *
                    </label>
                    <SearchableStructureSelect
                      id="transaction-settlement-search"
                      value={settlesTransactionId}
                      options={settlementOptions}
                      onChange={handleSelectSettlement}
                      placeholder="Buscar pendiente por número o contraparte"
                      emptyLabel="No hay operaciones pendientes compatibles."
                      disabled={mode === 'ver'}
                      accent={operationType === 'cobro' ? 'emerald' : 'rose'}
                    />
                  </div>
                )}

                {/* Detalle de ítems de compra */}
                {(operationType === 'compra' || purchaseItems.length > 0) && (
                  <PurchaseItemsEditor
                    personaPadreId={personaPadreId}
                    value={purchaseItems}
                    onChange={setPurchaseItems}
                    readOnly={mode === 'ver' || saving}
                  />
                )}
              </div>
            )}
          </div>

          </div>

          {/* ACCIONES */}
          {submitError && <p role="alert" className="px-4 text-xs text-red-600 dark:text-red-400 sm:px-6">{submitError}</p>}
          <div className="flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-[#0F172A] sm:flex-row sm:gap-3 sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancelar
            </button>
            {mode !== 'ver' && (
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-white bg-[#0088FF] hover:bg-[#0077EE] rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Registrando…' : 'Guardar operación'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
