import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './presentation/components/Sidebar';
import { Header } from './presentation/components/Header';
import { PageHeader } from './presentation/components/PageHeader';
import { MainDashboardKPIs } from './presentation/components/MainDashboardKPIs';
import { FinancialChart } from './presentation/components/FinancialChart';
import { ActualTrackingPanel } from './presentation/components/ActualTrackingPanel';
import { NoExtraScenarioPanel } from './presentation/components/NoExtraScenarioPanel';
import { ParametersPanel } from './presentation/components/ParametersPanel';
import { OverduesPanel } from './presentation/components/OverduesPanel';
import { PaymentPrioritiesPanel } from './presentation/components/PaymentPrioritiesPanel';
import { AdjustmentModal, AdjustmentData } from './presentation/components/AdjustmentModal';
import { TransactionModal, TransactionSubmitData } from './presentation/components/TransactionModal';
import { RxTRevaluationModal } from './presentation/components/RxTRevaluationModal';
import { FixedAssetsPanel } from './presentation/components/FixedAssetsPanel';
import { InventoryPanel } from './presentation/components/InventoryPanel';
import { VenturesPanel } from './presentation/components/VenturesPanel';
import { ExpensesPanel } from './presentation/components/ExpensesPanel';
import { TransactionsPanel, TransactionItem } from './presentation/components/TransactionsPanel';
import { useDarkMode } from './presentation/hooks/useDarkMode';
import { SupabaseDomVentureRepository } from './infrastructure/SupabaseDomVentureRepository';
import { DomVentureDTO } from './domain/ventures/DomVenture';

import {
  BarChart3,
  ListOrdered,
  Settings,
  Clock,
  SlidersHorizontal,
  PlusCircle,
  ArrowLeftRight,
  BookOpen,
  Briefcase,
  Receipt
} from 'lucide-react';

import { ProjectCashFlowUseCase } from './application/ProjectCashFlowUseCase';
import {
  INITIAL_MONTHS,
  INITIAL_DEFAULT_IPC,
  INITIAL_SECTIONS,
  DEFAULT_PAYMENT_PRIORITIES
} from './domain/shared/initialSeedData';
import { PaymentMethodType, DEFAULT_CUSTOM_PAYMENT_METHODS, CustomPaymentMethod } from './domain/shared/PaymentMethod';
import { SupabaseDomTransactionRepository } from './infrastructure/SupabaseDomTransactionRepository';
import { SupabaseDomPaymentPriorityRepository } from './infrastructure/SupabaseDomPaymentPriorityRepository';
import { SupabaseDomAccountingRepository } from './infrastructure/SupabaseDomAccountingRepository';
import { supabase } from './infrastructure/supabaseClient';
import { DomAccountDTO } from './domain/repositories/IAccountingRepository';
import { Money } from './domain/shared/Money';
import { PaymentPriority } from './domain/priorities/PaymentPriority';

export const App: React.FC = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [ipcRates, setIpcRates] = useState<number[]>(INITIAL_DEFAULT_IPC);
  const [priorities, setPriorities] = useState<PaymentPriority[]>(DEFAULT_PAYMENT_PRIORITIES);
  const [paymentMethods, setPaymentMethods] = useState<CustomPaymentMethod[]>(DEFAULT_CUSTOM_PAYMENT_METHODS);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, PaymentMethodType>>({});
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [isRxTModalOpen, setIsRxTModalOpen] = useState<boolean>(false);
  const [dbAccounts, setDbAccounts] = useState<DomAccountDTO[]>([]);

  const INITIAL_TRANSACTIONS: TransactionItem[] = [];

  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [transactionModalMode, setTransactionModalMode] = useState<'nuevo' | 'editar' | 'ver'>('nuevo');

  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  const transactionRepo = useMemo(() => new SupabaseDomTransactionRepository(), []);
  const priorityRepo = useMemo(() => new SupabaseDomPaymentPriorityRepository(), []);
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);
  const ventureRepo = useMemo(() => new SupabaseDomVentureRepository(), []);

  const [dbVentures, setDbVentures] = useState<DomVentureDTO[]>([]);

  const refreshAccounts = () => {
    accountingRepo.getAccounts(1)
      .then(accs => setDbAccounts(accs))
      .catch(err => console.error('Error al cargar cuentas contables:', err));
  };

  useEffect(() => {
    refreshAccounts();
  }, [accountingRepo]);

  // CARGAR VENTURES DESDE SUPABASE
  useEffect(() => {
    ventureRepo.getVentures(1)
      .then(v => setDbVentures(v))
      .catch(err => console.error('Error al cargar dom_ventures:', err));
  }, [ventureRepo, currentTab]);

  // CARGAR TRANSACCIONES Y PRIORIDADES DESDE SUPABASE AL INICIAR
  useEffect(() => {
    const personaPadreId = 1;

    transactionRepo.getTransactionsByTenant(personaPadreId)
      .then(data => {
        if (data && data.length > 0) {
          const mapped: TransactionItem[] = data.map(item => ({
            id: item.id || '',
            description: item.description,
            amount: item.amount.toAmount(),
            direction: item.direction,
            paymentMethod: item.paymentMethod,
            occurredOn: item.occurredOn
          }));
          setTransactions(mapped);
        }
      })
      .catch(err => console.error('Error cargando dom_transactions desde Supabase:', err));

    priorityRepo.getPrioritiesByTenant(personaPadreId)
      .then(data => {
        if (data && data.length > 0) {
          setPriorities(data);
        }
      })
      .catch(err => console.error('Error cargando dom_payment_priorities desde Supabase:', err));
  }, [transactionRepo, priorityRepo]);

  // CALCULO DINAMICO DE SECCIONES (Suma real de fuentes de ingresos activas: emprendimientos, alquileres, extraordinarios)
  const dynamicSections = useMemo(() => {
    const activeVentures = dbVentures.filter(v => v.status === 'activo');

    const businessMonthlyTotals = INITIAL_MONTHS.map(month => {
      return activeVentures
        .filter(v => (v.sourceType || 'emprendimiento') === 'emprendimiento')
        .reduce((sum, v) => {
          const proj = v.monthlyProjections?.[month];
          return sum + (proj !== undefined ? proj : v.baseMonthlyAmount);
        }, 0);
    });

    const rentMonthlyTotals = INITIAL_MONTHS.map(month => {
      return activeVentures
        .filter(v => v.sourceType === 'alquiler')
        .reduce((sum, v) => {
          const proj = v.monthlyProjections?.[month];
          return sum + (proj !== undefined ? proj : v.baseMonthlyAmount);
        }, 0);
    });

    const extraMonthlyTotals = INITIAL_MONTHS.map(month => {
      return activeVentures
        .filter(v => v.sourceType === 'extraordinario')
        .reduce((sum, v) => {
          const proj = v.monthlyProjections?.[month];
          return sum + (proj !== undefined ? proj : v.baseMonthlyAmount);
        }, 0);
    });

    return INITIAL_SECTIONS.map(section => {
      if (section.id === 'income-section' && section.children) {
        return {
          ...section,
          children: section.children.map(child => {
            if (child.id === 'income-business') {
              return {
                ...child,
                origin: businessMonthlyTotals
              };
            }
            if (child.id === 'income-rent') {
              return {
                ...child,
                origin: rentMonthlyTotals
              };
            }
            if (child.id === 'income-extra') {
              return {
                ...child,
                origin: extraMonthlyTotals
              };
            }
            return child;
          })
        };
      }
      return section;
    });
  }, [dbVentures]);

  const useCase = useMemo(() => new ProjectCashFlowUseCase(), []);

  const { nodes, projection } = useMemo(() => {
    return useCase.execute({
      nodes: dynamicSections,
      selectedMethods,
      openingBalance,
      ipcRates,
      periodCount: INITIAL_MONTHS.length
    });
  }, [useCase, dynamicSections, selectedMethods, openingBalance, ipcRates]);

  const handleMethodChange = (nodeId: string, method: PaymentMethodType) => {
    setSelectedMethods(prev => ({
      ...prev,
      [nodeId]: method
    }));
  };

  const handleIpcChange = (index: number, val: number) => {
    setIpcRates(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSavePriorities = async (updatedPriorities: PaymentPriority[]) => {
    setPriorities(updatedPriorities);
    try {
      await priorityRepo.savePriorities(1, updatedPriorities);
      console.log('Prioridades guardadas exitosamente en Supabase dom_payment_priorities');
    } catch (err) {
      console.error('Error al guardar prioridades en Supabase:', err);
    }
  };

  const handleSavePaymentMethod = (data: {
    id?: string;
    name: string;
    type: 'cash' | 'bank' | 'card';
    active: boolean;
    accountId?: number;
    accountCode?: string;
    accountName?: string;
  }) => {
    if (data.id) {
      setPaymentMethods(prev => prev.map(pm => pm.id === data.id ? { ...pm, ...data } : pm));
    } else {
      const newId = data.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
      setPaymentMethods(prev => [...prev, { ...data, id: newId }]);
    }
  };

  const handleTogglePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.map(pm => pm.id === id ? { ...pm, active: !pm.active } : pm));
  };

  const handleDeletePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
  };

  const handleOpenNewTransactionModal = () => {
    setEditingTransaction(null);
    setTransactionModalMode('nuevo');
    setIsTransactionModalOpen(true);
  };

  const handleOpenEditTransactionModal = (tx: TransactionItem) => {
    setEditingTransaction(tx);
    setTransactionModalMode('editar');
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    try {
      if (!id.startsWith('tx-')) {
        await transactionRepo.deleteTransaction(id);
        console.log('Transacción eliminada de Supabase dom_transactions:', id);
      }
    } catch (err) {
      console.error('Error al eliminar transacción en Supabase:', err);
    }
  };

  const INITIAL_COMPONENT_BALANCES: Record<string, number> = {
    bank_available: 0.00,
    cash_available: 0.00,
    receivables: 0.00,
    payables: 0.00,
    card_installments: 0.00,
    income_executed: 0.00,
    expense_executed: 0.00,
  };

  const handleCreateOrUpdateTransaction = async (data: TransactionSubmitData) => {
    const personaPadreId = 1;
    const paymentCond = data.paymentCondition || 'contado';
    const opType = data.operationType || 'venta';
    const opNum = data.opNumber || `OP-${Date.now().toString().slice(-4)}`;
    const party = data.counterparty || 'Cliente / Proveedor General';

    if (editingTransaction) {
      setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, ...data } : t));
      try {
        await transactionRepo.updateTransaction({
          id: editingTransaction.id,
          personaPadreId,
          direction: data.direction,
          amount: Money.fromAmount(data.amount),
          description: data.description,
          occurredOn: data.occurredOn,
          paymentMethod: data.paymentMethod as any,
          status: 'confirmed',
          opNumber: opNum,
          counterparty: party,
          operationType: opType,
          paymentCondition: paymentCond
        });
        console.log('Transacción actualizada exitosamente en Supabase dom_transactions');
      } catch (err) {
        console.error('Error actualizando en Supabase dom_transactions:', err);
      }
    } else {
      try {
        const created = await transactionRepo.createTransaction({
          personaPadreId,
          direction: data.direction,
          amount: Money.fromAmount(data.amount),
          description: data.description,
          occurredOn: data.occurredOn,
          paymentMethod: data.paymentMethod as any,
          status: 'confirmed',
          opNumber: opNum,
          counterparty: party,
          operationType: opType,
          paymentCondition: paymentCond
        });

        const newTx: TransactionItem = {
          id: created.id || 'tx-' + Date.now(),
          ...data,
          opNumber: opNum,
          counterparty: party,
          operationType: opType,
          paymentCondition: paymentCond
        };
        setTransactions(prev => [newTx, ...prev]);
        console.log('Nueva transacción guardada exitosamente en Supabase dom_transactions:', created);
      } catch (err) {
        console.error('Error guardando en Supabase dom_transactions:', err);
        const newTx: TransactionItem = {
          id: 'tx-' + Date.now(),
          ...data,
          opNumber: opNum,
          counterparty: party,
          operationType: opType,
          paymentCondition: paymentCond
        };
        setTransactions(prev => [newTx, ...prev]);
      }
    }

    // SINCRONIZACIÓN DE PRECIO ACTUAL: ACTUALIZA EL VALOR ACTUAL EN dom_expenses
    if (data.linkedExpenseId && data.amount > 0) {
      try {
        await supabase
          .from('dom_expenses')
          .update({ base_monthly_amount: data.amount })
          .eq('id', data.linkedExpenseId)
          .eq('persona_padre_id', personaPadreId);
        console.log(`Valor Actual del egreso ID ${data.linkedExpenseId} sincronizado a ${data.amount}`);
      } catch (err) {
        console.error('Error al actualizar base_monthly_amount en dom_expenses:', err);
      }
    }

    // SINCRONIZACIÓN DE PRECIO ACTUAL: ACTUALIZA EL VALOR ACTUAL EN dom_ventures
    if (data.linkedVentureId && data.amount > 0) {
      try {
        await supabase
          .from('dom_ventures')
          .update({ base_monthly_amount: data.amount })
          .eq('id', data.linkedVentureId)
          .eq('persona_padre_id', personaPadreId);
        console.log(`Valor Actual de la fuente de ingreso ID ${data.linkedVentureId} sincronizado a ${data.amount}`);
        ventureRepo.getVentures(personaPadreId).then(v => setDbVentures(v));
      } catch (err) {
        console.error('Error al actualizar base_monthly_amount en dom_ventures:', err);
      }
    }

    const methodObj = paymentMethods.find(p => p.id === data.paymentMethod);
    const methodType = methodObj?.type || 'cash';

    // MATRIZ DE REGISTRO CONTABLE PROFESIONAL POR PARTIDA DOBLE (RT 17)
    try {
      const dbAccs = await accountingRepo.getAccounts(personaPadreId);

      const cashAcc = dbAccs.find((a: DomAccountDTO) => a.code === '1.1.01.01') || dbAccs[0];
      const bankAcc = dbAccs.find((a: DomAccountDTO) => a.code === '1.1.02.01') || dbAccs[0];
      const recAcc = dbAccs.find((a: DomAccountDTO) => a.code === '1.1.03.01') || dbAccs[0];
      const payAcc = dbAccs.find((a: DomAccountDTO) => a.code === '2.1.01.01') || dbAccs[0];
      const salesIncAcc = dbAccs.find((a: DomAccountDTO) => a.code === '4.1.01.01') || dbAccs.find((a: DomAccountDTO) => a.kind === 'income') || dbAccs[0];
      const rentIncAcc = dbAccs.find((a: DomAccountDTO) => a.code === '4.1.01.02') || salesIncAcc;
      const barterIncAcc = dbAccs.find((a: DomAccountDTO) => a.code === '4.2.01.01') || salesIncAcc;
      const rentExpAcc = dbAccs.find((a: DomAccountDTO) => a.code === '5.1.01.01') || dbAccs.find((a: DomAccountDTO) => a.kind === 'expense') || dbAccs[0];
      const suppliesExpAcc = dbAccs.find((a: DomAccountDTO) => a.code === '5.1.01.02') || rentExpAcc;

      const customAssignedAcc = methodObj?.accountCode
        ? dbAccs.find((a: DomAccountDTO) => a.code === methodObj.accountCode)
        : methodObj?.accountId
        ? dbAccs.find((a: DomAccountDTO) => a.id === methodObj.accountId)
        : null;

      const financialAcc = customAssignedAcc || (methodType === 'cash' ? cashAcc : bankAcc);

      let lines = [];
      let prefix = paymentCond === 'contado' ? '[CONTADO]' : '[CTA CTE]';

      if (opType === 'venta' || opType === 'honorarios') {
        if (paymentCond === 'contado') {
          lines = [
            { personaPadreId, accountId: financialAcc.id, debit: data.amount, credit: 0, memo: `Cobro de contado: ${party}` },
            { personaPadreId, accountId: salesIncAcc.id, debit: 0, credit: data.amount, memo: `Ingreso por venta/honorarios: ${party}` }
          ];
        } else {
          lines = [
            { personaPadreId, accountId: recAcc.id, debit: data.amount, credit: 0, memo: `Crédito en Cta Cte: ${party}` },
            { personaPadreId, accountId: salesIncAcc.id, debit: 0, credit: data.amount, memo: `Venta devengada en Cta Cte: ${party}` }
          ];
        }
      } else if (opType === 'compra') {
        if (paymentCond === 'contado') {
          lines = [
            { personaPadreId, accountId: suppliesExpAcc.id, debit: data.amount, credit: 0, memo: `Egreso por compra: ${party}` },
            { personaPadreId, accountId: financialAcc.id, debit: 0, credit: data.amount, memo: `Pago de contado: ${party}` }
          ];
        } else {
          lines = [
            { personaPadreId, accountId: suppliesExpAcc.id, debit: data.amount, credit: 0, memo: `Compra devengada en Cta Cte: ${party}` },
            { personaPadreId, accountId: payAcc.id, debit: 0, credit: data.amount, memo: `Deuda comercial en Cta Cte: ${party}` }
          ];
        }
      } else if (opType === 'cobro') {
        lines = [
          { personaPadreId, accountId: financialAcc.id, debit: data.amount, credit: 0, memo: `Cobro efectivo/banco: ${party}` },
          { personaPadreId, accountId: recAcc.id, debit: 0, credit: data.amount, memo: `Cancelación crédito Cta Cte: ${party}` }
        ];
      } else if (opType === 'pago') {
        lines = [
          { personaPadreId, accountId: payAcc.id, debit: data.amount, credit: 0, memo: `Cancelación deuda Cta Cte: ${party}` },
          { personaPadreId, accountId: financialAcc.id, debit: 0, credit: data.amount, memo: `Pago efectivo/banco: ${party}` }
        ];
      } else if (opType === 'alquiler_ganado') {
        if (paymentCond === 'contado') {
          lines = [
            { personaPadreId, accountId: financialAcc.id, debit: data.amount, credit: 0, memo: `Cobro alquiler: ${party}` },
            { personaPadreId, accountId: rentIncAcc.id, debit: 0, credit: data.amount, memo: `Alquiler ganado: ${party}` }
          ];
        } else {
          lines = [
            { personaPadreId, accountId: recAcc.id, debit: data.amount, credit: 0, memo: `Alquiler a cobrar en Cta Cte: ${party}` },
            { personaPadreId, accountId: rentIncAcc.id, debit: 0, credit: data.amount, memo: `Alquiler ganado devengado: ${party}` }
          ];
        }
      } else if (opType === 'alquiler_perdido') {
        if (paymentCond === 'contado') {
          lines = [
            { personaPadreId, accountId: rentExpAcc.id, debit: data.amount, credit: 0, memo: `Alquiler residencia: ${party}` },
            { personaPadreId, accountId: financialAcc.id, debit: 0, credit: data.amount, memo: `Pago alquiler de contado: ${party}` }
          ];
        } else {
          lines = [
            { personaPadreId, accountId: rentExpAcc.id, debit: data.amount, credit: 0, memo: `Alquiler devengado en Cta Cte: ${party}` },
            { personaPadreId, accountId: payAcc.id, debit: 0, credit: data.amount, memo: `Deuda por alquiler: ${party}` }
          ];
        }
      } else if (opType === 'canje') {
        lines = [
          { personaPadreId, accountId: suppliesExpAcc.id, debit: data.amount, credit: 0, memo: `Recepción de bien/servicio en canje: ${party}` },
          { personaPadreId, accountId: barterIncAcc.id, debit: 0, credit: data.amount, memo: `Entrega de bien/servicio en canje: ${party}` }
        ];
      } else {
        lines = [
          { personaPadreId, accountId: financialAcc.id, debit: data.direction === 'income' ? data.amount : 0, credit: data.direction === 'expense' ? data.amount : 0, memo: data.description },
          { personaPadreId, accountId: data.direction === 'income' ? salesIncAcc.id : suppliesExpAcc.id, debit: data.direction === 'expense' ? data.amount : 0, credit: data.direction === 'income' ? data.amount : 0, memo: data.description }
        ];
      }

      await accountingRepo.recordJournalEntry({
        personaPadreId,
        entryDate: data.occurredOn,
        description: `${prefix} [${opType.toUpperCase()}] ${party}: ${data.description}`,
        referenceId: opNum,
        lines
      });

      console.log('Asiento contable registrado exitosamente para la transacción:', opNum);
    } catch (err) {
      console.error('Error al registrar asiento contable de transacción:', err);
    }

    setAdjustments(prev => {
      const getPrev = (key: string) => prev[key] !== undefined ? prev[key] : INITIAL_COMPONENT_BALANCES[key];

      if (paymentCond === 'cta_cte') {
        if (data.direction === 'income') {
          return {
            ...prev,
            income_executed: getPrev('income_executed') + data.amount,
            receivables: getPrev('receivables') + data.amount
          };
        } else {
          const targetDebt = methodType === 'card' ? 'card_installments' : 'payables';
          return {
            ...prev,
            expense_executed: getPrev('expense_executed') + data.amount,
            [targetDebt]: getPrev(targetDebt) + data.amount
          };
        }
      } else if (opType === 'cobro' || opType === 'pago') {
        if (data.direction === 'income') {
          const targetAccount = methodType === 'cash' ? 'cash_available' : 'bank_available';
          return {
            ...prev,
            [targetAccount]: getPrev(targetAccount) + data.amount,
            receivables: Math.max(0, getPrev('receivables') - data.amount)
          };
        } else {
          const targetDebt = methodType === 'card' ? 'card_installments' : 'payables';
          const targetAccount = methodType === 'cash' ? 'cash_available' : 'bank_available';
          return {
            ...prev,
            [targetDebt]: Math.max(0, getPrev(targetDebt) - data.amount),
            [targetAccount]: getPrev(targetAccount) - data.amount
          };
        }
      } else {
        // contado
        if (data.direction === 'income') {
          const targetAccount = methodType === 'cash' ? 'cash_available' : 'bank_available';
          return {
            ...prev,
            income_executed: getPrev('income_executed') + data.amount,
            [targetAccount]: getPrev(targetAccount) + data.amount
          };
        } else {
          const nextExpense = getPrev('expense_executed') + data.amount;
          if (methodType === 'card') {
            return {
              ...prev,
              expense_executed: nextExpense,
              card_installments: getPrev('card_installments') + data.amount
            };
          } else {
            const targetAccount = methodType === 'cash' ? 'cash_available' : 'bank_available';
            return {
              ...prev,
              expense_executed: nextExpense,
              [targetAccount]: getPrev(targetAccount) - data.amount
            };
          }
        }
      }
    });
  };

  const handleApplyAdjustment = async (data: AdjustmentData) => {
    const baseInitial = INITIAL_COMPONENT_BALANCES[data.componentKey] ?? 0;
    const current = adjustments[data.componentKey] !== undefined ? adjustments[data.componentKey] : baseInitial;

    let computedNextVal = current;
    let computedDelta = 0;

    if (data.adjustmentType === 'set_balance') {
      computedNextVal = data.amount;
      computedDelta = data.amount - current;
    } else if (data.adjustmentType === 'increase') {
      computedNextVal = current + data.amount;
      computedDelta = data.amount;
    } else if (data.adjustmentType === 'decrease') {
      computedNextVal = current - data.amount;
      computedDelta = -data.amount;
    }

    try {
      const personaPadreId = 1;
      const dbAccs = await accountingRepo.getAccounts(personaPadreId);

      const accountCodeMap: Record<string, string> = {
        bank_available: '1.1.02.01',
        cash_available: '1.1.01.01',
        receivables: '1.1.03.01',
        payables: '2.1.01.01',
        card_installments: '2.1.01.02',
        income_executed: '4.1.01.01',
        expense_executed: '5.1.01.01'
      };

      const targetCode = accountCodeMap[data.componentKey] || '1.1.02.01';
      const targetAcc = dbAccs.find((a: DomAccountDTO) => a.code === targetCode) || dbAccs[0];
      const expenseAdjAcc = dbAccs.find((a: DomAccountDTO) => a.code === '5.2.01.01') || dbAccs.find((a: DomAccountDTO) => a.kind === 'expense');
      const incomeAdjAcc = dbAccs.find((a: DomAccountDTO) => a.code === '4.2.01.01') || dbAccs.find((a: DomAccountDTO) => a.kind === 'income');

      if (targetAcc && Math.abs(computedDelta) >= 0.01) {
        const absDelta = Math.abs(computedDelta);
        let lines = [];

        if (targetAcc.nature === 'debit') {
          if (computedDelta > 0) {
            lines = [
              { personaPadreId, accountId: targetAcc.id, debit: absDelta, credit: 0, memo: `Ajuste: ${data.reason}` },
              { personaPadreId, accountId: incomeAdjAcc?.id || targetAcc.id, debit: 0, credit: absDelta, memo: `Reconciliación: ${data.reason}` }
            ];
          } else {
            lines = [
              { personaPadreId, accountId: expenseAdjAcc?.id || targetAcc.id, debit: absDelta, credit: 0, memo: `Reconciliación: ${data.reason}` },
              { personaPadreId, accountId: targetAcc.id, debit: 0, credit: absDelta, memo: `Ajuste: ${data.reason}` }
            ];
          }
        } else {
          if (computedDelta > 0) {
            lines = [
              { personaPadreId, accountId: expenseAdjAcc?.id || targetAcc.id, debit: absDelta, credit: 0, memo: `Reconciliación: ${data.reason}` },
              { personaPadreId, accountId: targetAcc.id, debit: 0, credit: absDelta, memo: `Ajuste: ${data.reason}` }
            ];
          } else {
            lines = [
              { personaPadreId, accountId: targetAcc.id, debit: absDelta, credit: 0, memo: `Ajuste: ${data.reason}` },
              { personaPadreId, accountId: incomeAdjAcc?.id || targetAcc.id, debit: 0, credit: absDelta, memo: `Reconciliación: ${data.reason}` }
            ];
          }
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const entryRef = `AJU-${Date.now().toString().slice(-4)}`;

        await accountingRepo.recordJournalEntry({
          personaPadreId,
          entryDate: todayStr,
          description: `[Ajuste Contable] ${data.componentLabel}: ${data.reason}`,
          referenceId: entryRef,
          lines
        });

        console.log('Asiento de ajuste registrado exitosamente en Supabase dom_journal_entries:', entryRef);
      }
    } catch (err) {
      console.error('Error al registrar asiento de ajuste en Supabase:', err);
    }

    setAdjustments(prev => ({
      ...prev,
      [data.componentKey]: computedNextVal
    }));
  };

  const accountsReceivable = Money.fromAmount(adjustments['receivables'] ?? 0);
  const accountsPayable = Money.fromAmount(adjustments['payables'] ?? 0);
  const cashAvailable = Money.fromAmount(adjustments['cash_available'] ?? 0);
  const bankAvailable = Money.fromAmount(adjustments['bank_available'] ?? 0);
  const totalCardLimit = paymentMethods
    .filter(pm => pm.active && pm.type === 'card')
    .reduce((sum, pm) => sum + (pm.creditLimit || 0), 0);

  const initialCardDebtFromMethods = paymentMethods
    .filter(pm => pm.active && pm.type === 'card')
    .reduce((sum, pm) => {
      const limit = pm.creditLimit || 0;
      const initAvail = pm.initialAvailable !== undefined ? pm.initialAvailable : limit;
      return sum + Math.max(0, limit - initAvail);
    }, 0);

  const hasDirectCardsAvailAdj = adjustments['cards_available'] !== undefined;

  let dynamicCardsAvailable = 0;

  if (hasDirectCardsAvailAdj) {
    dynamicCardsAvailable = Math.max(0, adjustments['cards_available']);
  } else {
    const cardDebt = adjustments['card_installments'] !== undefined
      ? adjustments['card_installments']
      : (initialCardDebtFromMethods + transactions
          .filter(t => {
            const pm = paymentMethods.find(m => m.id === t.paymentMethod);
            return pm?.type === 'card' || t.paymentMethod === 'card';
          })
          .reduce((sum, t) => sum + (t.direction === 'expense' ? t.amount : -t.amount), 0)
        );

    dynamicCardsAvailable = Math.max(0, totalCardLimit - cardDebt);
  }

  const cardsAvailable = Money.fromAmount(dynamicCardsAvailable);

  return (
    <div className="flex min-h-screen bg-[#F4F6F8] dark:bg-[#070D1B] text-[#172033] dark:text-gray-100 transition-colors duration-300">
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 max-w-[1850px] w-full mx-auto">
          {/* MÓDULO HOME */}
          {currentTab === 'dashboard' && (
            <>
              <Header
                onOpenNewTransaction={handleOpenNewTransactionModal}
                onOpenNewAdjustment={() => setIsAdjustmentModalOpen(true)}
                onOpenRxTRevaluation={() => setIsRxTModalOpen(true)}
              />

              <MainDashboardKPIs
                accountsReceivable={accountsReceivable}
                accountsPayable={accountsPayable}
                cashAvailable={cashAvailable}
                bankAvailable={bankAvailable}
                cardsAvailable={cardsAvailable}
              />

              <FinancialChart
                months={INITIAL_MONTHS}
                income={projection.income}
                expense={projection.expense}
                net={projection.net}
              />
            </>
          )}

          {/* MÓDULO TRANSACCIONES */}
          {currentTab === 'transacciones' && (
            <>
              <PageHeader
                title="Gestión de Transacciones y Movimientos"
                subtitle="Administración detallada de ingresos y egresos registrados"
                icon={ArrowLeftRight}
                iconBgColor="bg-[#0088FF]"
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={handleOpenNewTransactionModal}
                      className="flex items-center gap-2 bg-[#0088FF] hover:bg-blue-600 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      <span>Nuevo Movimiento</span>
                    </button>
                    <button
                      onClick={() => setIsAdjustmentModalOpen(true)}
                      className="flex items-center gap-2 bg-[#00A86B] hover:bg-[#008f5b] text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <SlidersHorizontal className="w-4 h-4 shrink-0" />
                      <span>Nuevo Ajuste</span>
                    </button>
                  </div>
                }
              />
              <TransactionsPanel
                transactions={transactions}
                onOpenNewTransaction={handleOpenNewTransactionModal}
                onEditTransaction={handleOpenEditTransactionModal}
                onDeleteTransaction={handleDeleteTransaction}
                paymentMethods={paymentMethods}
              />
            </>
          )}

          {/* MÓDULO FUENTES DE INGRESOS */}
          {(currentTab === 'fuentes_ingresos' || currentTab === 'emprendimientos') && (
            <>
              <PageHeader
                title="Fuentes de Ingresos"
                subtitle="Gestión unificada de ingresos por emprendimientos, alquileres e ingresos extraordinarios"
                icon={Briefcase}
                iconBgColor="bg-[#0088FF]"
              />
              <VenturesPanel onVenturesChange={() => {
                ventureRepo.getVentures(1).then(v => setDbVentures(v));
              }} />
            </>
          )}

          {/* MÓDULO ESTRUCTURA DE EGRESOS */}
          {currentTab === 'egresos' && (
            <>
              <PageHeader
                title="Estructura de Egresos"
                subtitle="Gestión unificada de egresos domésticos, gastos de emprendimiento y extraordinarios"
                icon={Receipt}
                iconBgColor="bg-rose-600"
              />
              <ExpensesPanel />
            </>
          )}

          {/* MÓDULO REPORTES CONTABLES */}
          {currentTab === 'seguimiento' && (
            <>
              <PageHeader
                title="Reportes Contables en Vivo"
                subtitle="Estados Financieros (P&L, Situación Patrimonial), Libro Diario y Libro Mayor agrupado por cuenta"
                icon={BookOpen}
                iconBgColor="bg-[#0f8a5f]"
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={handleOpenNewTransactionModal}
                      className="flex items-center gap-2 bg-[#12355b] dark:bg-[#0088FF] hover:bg-[#0d2642] dark:hover:bg-blue-600 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      <span>Nueva Transacción</span>
                    </button>
                    <button
                      onClick={() => setIsAdjustmentModalOpen(true)}
                      className="flex items-center gap-2 bg-[#00A86B] hover:bg-[#008f5b] text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <SlidersHorizontal className="w-4 h-4 shrink-0" />
                      <span>Nuevo Ajuste</span>
                    </button>
                  </div>
                }
              />
              <ActualTrackingPanel
                adjustments={adjustments}
                nodes={nodes}
                months={INITIAL_MONTHS}
                selectedMethods={selectedMethods}
                onMethodChange={handleMethodChange}
                openingBalance={openingBalance}
                onOpeningBalanceChange={setOpeningBalance}
              />
            </>
          )}

          {/* MÓDULO ESCENARIO SIN EXTRA */}
          {currentTab === 'escenario' && (
            <>
              <PageHeader
                title="Escenario Base Sin Ingreso Extra"
                subtitle="Simulación de saldo remanente y proyección acumulada de faltante"
                icon={BarChart3}
                iconBgColor="bg-amber-600"
              />
              <NoExtraScenarioPanel />
            </>
          )}

          {/* MÓDULO RANKING PRIORIDADES */}
          {currentTab === 'prioridades' && (
            <>
              <PageHeader
                title="Ranking de Prioridades de Pago"
                subtitle="Jerarquía configurable de acreedores y asignación en dom_payment_priorities"
                icon={ListOrdered}
                iconBgColor="bg-[#6d4db3]"
              />
              <PaymentPrioritiesPanel
                priorities={priorities}
                onSave={handleSavePriorities}
              />
            </>
          )}

          {/* MÓDULO PARÁMETROS & IPC */}
          {currentTab === 'parametros' && (
            <>
              <PageHeader
                title="Parámetros de Ajuste e Inflación IPC"
                subtitle="Configuración de medios de pago, tasas de inflación y reglas de cálculo"
                icon={Settings}
                iconBgColor="bg-slate-700"
              />
              <ParametersPanel
                ipcRates={ipcRates}
                onIpcChange={handleIpcChange}
                paymentMethods={paymentMethods}
                accounts={dbAccounts}
                onSavePaymentMethod={handleSavePaymentMethod}
                onTogglePaymentMethod={handleTogglePaymentMethod}
                onDeletePaymentMethod={handleDeletePaymentMethod}
              />
            </>
          )}

          {/* MÓDULO ATRASOS & MORAS */}
          {currentTab === 'atrasos' && (
            <>
              <PageHeader
                title="Control de Atrasos y Moras"
                subtitle="Seguimiento de saldos vencidos y pagos confirmados de obligaciones"
                icon={Clock}
                iconBgColor="bg-[#b54747]"
              />
              <OverduesPanel />
            </>
          )}

          {/* MÓDULO BIENES DE USO */}
          {currentTab === 'bienes_uso' && (
            <FixedAssetsPanel />
          )}

          {/* MÓDULO BIENES DE CAMBIO */}
          {currentTab === 'bienes_cambio' && (
            <InventoryPanel />
          )}
        </main>
      </div>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        mode={transactionModalMode}
        onClose={() => setIsTransactionModalOpen(false)}
        onSubmit={handleCreateOrUpdateTransaction}
        paymentMethods={paymentMethods}
        initialData={editingTransaction ? (editingTransaction as any) : undefined}
      />

      <AdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onApplyAdjustment={handleApplyAdjustment}
        adjustments={adjustments}
        liveValues={{
          bank_available: bankAvailable.toAmount(),
          cash_available: cashAvailable.toAmount(),
          cards_available: dynamicCardsAvailable,
          receivables: accountsReceivable.toAmount(),
          payables: accountsPayable.toAmount(),
          card_installments: adjustments['card_installments'] ?? initialCardDebtFromMethods,
          income_executed: adjustments['income_executed'] ?? 0,
          expense_executed: adjustments['expense_executed'] ?? 0
        }}
      />

      <RxTRevaluationModal
        isOpen={isRxTModalOpen}
        onClose={() => setIsRxTModalOpen(false)}
        accounts={dbAccounts}
        onSuccess={() => {
          setIsRxTModalOpen(false);
          refreshAccounts();
        }}
      />
    </div>
  );
};

export default App;
