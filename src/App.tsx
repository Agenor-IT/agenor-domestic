import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { NAVIGATION_ITEMS, Sidebar } from './presentation/components/Sidebar';
import { useDomesticVoice } from './presentation/hooks/useDomesticVoice';
import { BottomNav } from './presentation/components/BottomNav';
import { ReceiptDraft, receiptTransactionFields } from './domain/receipts/ReceiptDraft';
import { confirmDomesticAction, DomesticConfirmation } from './presentation/components/DomesticConfirmation';
import { HomeDueTasksPanel } from './presentation/components/HomeDueTasksPanel';
import { PageHeader } from './presentation/components/PageHeader';
import { MainDashboardKPIs } from './presentation/components/MainDashboardKPIs';
import { SupabaseDomMonthlyCashRepository } from './infrastructure/SupabaseDomMonthlyCashRepository';
import { SupabaseDomConsumptionRepository } from './infrastructure/SupabaseDomConsumptionRepository';
import type { AdjustmentData } from './presentation/components/AdjustmentModal';
import type { TransactionSubmitData } from './presentation/components/TransactionModal';
import type { TransactionItem } from './presentation/components/TransactionsPanel';

// Lazy-loaded secondary panels and heavy modals
const MonthlyCashPanel = React.lazy(() => import('./presentation/components/MonthlyCashPanel').then(m => ({ default: m.MonthlyCashPanel })));
const ProductsConsumptionPanel = React.lazy(() => import('./presentation/components/ProductsConsumptionPanel').then(m => ({ default: m.ProductsConsumptionPanel })));
const FixedAssetsPanel = React.lazy(() => import('./presentation/components/FixedAssetsPanel').then(m => ({ default: m.FixedAssetsPanel })));
const InventoryPanel = React.lazy(() => import('./presentation/components/InventoryPanel').then(m => ({ default: m.InventoryPanel })));
const ParametersPanel = React.lazy(() => import('./presentation/components/ParametersPanel').then(m => ({ default: m.ParametersPanel })));
const ExpensesPanel = React.lazy(() => import('./presentation/components/ExpensesPanel').then(m => ({ default: m.ExpensesPanel })));
const VenturesPanel = React.lazy(() => import('./presentation/components/VenturesPanel').then(m => ({ default: m.VenturesPanel })));
const FinancialChart = React.lazy(() => import('./presentation/components/FinancialChart').then(m => ({ default: m.FinancialChart })));
const ActualTrackingPanel = React.lazy(() => import('./presentation/components/ActualTrackingPanel').then(m => ({ default: m.ActualTrackingPanel })));
const RecpamInflationSection = React.lazy(() => import('./presentation/components/RecpamInflationSection').then(m => ({ default: m.RecpamInflationSection })));
const FiscalYearsSection = React.lazy(() => import('./presentation/components/FiscalYearsSection').then(m => ({ default: m.FiscalYearsSection })));
const OverduesPanel = React.lazy(() => import('./presentation/components/OverduesPanel').then(m => ({ default: m.OverduesPanel })));
const TransactionsPanel = React.lazy(() => import('./presentation/components/TransactionsPanel').then(m => ({ default: m.TransactionsPanel })));
const TransactionModal = React.lazy(() => import('./presentation/components/TransactionModal').then(m => ({ default: m.TransactionModal })));
const AdjustmentModal = React.lazy(() => import('./presentation/components/AdjustmentModal').then(m => ({ default: m.AdjustmentModal })));
const RxTRevaluationModal = React.lazy(() => import('./presentation/components/RxTRevaluationModal').then(m => ({ default: m.RxTRevaluationModal })));
const ReceiptCaptureModal = React.lazy(() => import('./presentation/components/ReceiptCaptureModal').then(m => ({ default: m.ReceiptCaptureModal })));
const DomesticVoicePanel = React.lazy(() => import('./presentation/components/DomesticVoicePanel').then(m => ({ default: m.DomesticVoicePanel })));

const PanelSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse p-2 sm:p-4" role="status" aria-label="Cargando módulo">
    <div className="h-7 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
    <div className="h-28 w-full bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
    <div className="h-64 w-full bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
  </div>
);
import { useDarkMode } from './presentation/hooks/useDarkMode';
import { SupabaseDomVentureRepository } from './infrastructure/SupabaseDomVentureRepository';
import { DomVentureDTO } from './domain/ventures/DomVenture';
import { SupabaseDomExpenseRepository } from './infrastructure/SupabaseDomExpenseRepository';
import { DomExpenseDTO } from './domain/expenses/DomExpense';
import { FlowNode } from './domain/cashflow/CashFlowProjectionService';

import {
  Wallet,
  Receipt,
  Building2,
  BookOpen,
  SlidersHorizontal,
  PlusCircle,
  Camera,
  TrendingUp
} from 'lucide-react';

import { ProjectCashFlowUseCase } from './application/ProjectCashFlowUseCase';
import { PaymentMethodType, CustomPaymentMethod } from './domain/shared/PaymentMethod';
import { SupabaseDomTransactionRepository } from './infrastructure/SupabaseDomTransactionRepository';
import { SupabaseDomAccountingRepository } from './infrastructure/SupabaseDomAccountingRepository';
import { useDomesticAccess } from './presentation/auth/DomesticAuthGate';
import { DomAccountDTO } from './domain/repositories/IAccountingRepository';
import { Money } from './domain/shared/Money';
import { argentinaDate } from './domain/shared/argentinaDate';
import { INITIAL_MONTHS } from './domain/shared/initialSeedData';

export const App: React.FC = () => {
  const { email, personaPadreId, signOut } = useDomesticAccess();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [plannerView, setPlannerView] = useState<'tarjetas' | 'vencimientos' | 'presupuesto'>('tarjetas');
  const [assetsView, setAssetsView] = useState<'bienes_uso' | 'consumo'>('bienes_uso');
  const [accountingView, setAccountingView] = useState<'balance' | 'cierre_rt6' | 'parametros'>('balance');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleTabChange = (tab: string) => {
    if (tab === 'dashboard' || tab === 'home') {
      setCurrentTab('dashboard');
    } else if (tab === 'transacciones' || tab === 'billetera') {
      setCurrentTab('billetera');
          } else if (tab === 'planificador' || tab === 'tarjetas') {
      setCurrentTab('planificador');
      setPlannerView('tarjetas');
    } else if (tab === 'atrasos' || tab === 'vencimientos') {
      setCurrentTab('planificador');
      setPlannerView('vencimientos');
    } else if (tab === 'egresos' || tab === 'fuentes_ingresos' || tab === 'presupuesto') {
      setCurrentTab('planificador');
      setPlannerView('presupuesto');
    } else if (tab === 'patrimonio' || tab === 'bienes_uso') {
      setCurrentTab('patrimonio');
      setAssetsView('bienes_uso');
    } else if (tab === 'bienes_cambio' || tab === 'productos_consumo') {
      setCurrentTab('patrimonio');
      setAssetsView('consumo');
    } else if (tab === 'contable' || tab === 'seguimiento') {
      setCurrentTab('contable');
      setAccountingView('balance');
    } else if (tab === 'parametros') {
      setCurrentTab('contable');
      setAccountingView('parametros');
    } else {
      setCurrentTab(tab);
    }
    window.scrollTo(0, 0);
  };
  const voice = useDomesticVoice({
    section: currentTab, personaPadreId,
    sections: NAVIGATION_ITEMS.map(({ id, label }) => ({ id, label })),
    onNavigate: tab => { setMobileMenuOpen(false); handleTabChange(tab); }
  });
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, PaymentMethodType>>({});
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [isRxTModalOpen, setIsRxTModalOpen] = useState<boolean>(false);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null);
  const [newPurchase, setNewPurchase] = useState(false);
  const purchaseDefaults = useMemo<Partial<TransactionSubmitData> | undefined>(() => newPurchase ? { operationType: 'compra', direction: 'expense' } : undefined, [newPurchase]);
  const receiptFields = useMemo(() => receiptDraft ? receiptTransactionFields(receiptDraft) : undefined, [receiptDraft]);
  const openReceiptCamera = () => receiptInput.current?.click();
  const [dbAccounts, setDbAccounts] = useState<DomAccountDTO[]>([]);
  const paymentMethods = useMemo<CustomPaymentMethod[]>(() => dbAccounts
    .filter(account =>
      account.code.startsWith('1.1.01.') ||
      ['1.1.02.01', '1.1.02.02', '2.1.01.04'].includes(account.code)
    )
    .map(account => ({
      id: account.code,
      name: account.name,
      type: account.code === '2.1.01.04' ? 'card' as const
        : account.code.startsWith('1.1.01.') ? 'cash' as const : 'bank' as const,
      active: !account.isArchived,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name
    })), [dbAccounts]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const INITIAL_TRANSACTIONS: TransactionItem[] = [];

  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [transactionModalMode, setTransactionModalMode] = useState<'nuevo' | 'editar' | 'ver'>('nuevo');
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  const transactionRepo = useMemo(() => new SupabaseDomTransactionRepository(), []);
  const consumptionRepo = useMemo(() => new SupabaseDomConsumptionRepository(), []);
  const monthlyCashRepo = useMemo(() => new SupabaseDomMonthlyCashRepository(), []);
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);
  const ventureRepo = useMemo(() => new SupabaseDomVentureRepository(), []);
  const expenseRepo = useMemo(() => new SupabaseDomExpenseRepository(), []);

  const [dbVentures, setDbVentures] = useState<DomVentureDTO[]>([]);
  const [dbExpenses, setDbExpenses] = useState<DomExpenseDTO[]>([]);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  const refreshAccounts = () => {
    setAccountsLoading(true);
    accountingRepo.getAccounts(personaPadreId, true)
      .then(accs => {
        setDbAccounts(accs);
        setAccountsError(null);
      })
      .catch(err => {
        console.error('Error al cargar cuentas contables:', err);
        setAccountsError('No se pudo cargar el plan de cuentas. Los saldos no están disponibles.');
      })
      .finally(() => setAccountsLoading(false));
  };

  useEffect(() => {
    refreshAccounts();
  }, [accountingRepo, personaPadreId]);

  // Presupuestos separados del Libro Diario y de los cobros/pagos efectivamente registrados.
  useEffect(() => {
    Promise.all([
      ventureRepo.getVentures(personaPadreId),
      expenseRepo.getExpenses(personaPadreId)
    ]).then(([ventures, expenses]) => {
      setDbVentures(ventures);
      setDbExpenses(expenses);
      setProjectionError(null);
    }).catch(err => {
      console.error('Error al cargar fuentes del presupuesto:', err);
      setProjectionError('No se pudo cargar el presupuesto. La proyección no está disponible.');
    });
  }, [ventureRepo, expenseRepo, personaPadreId]);

  // CARGAR TRANSACCIONES DESDE SUPABASE AL INICIAR
  useEffect(() => {
    transactionRepo.getTransactionsByTenant(personaPadreId)
      .then(data => {
          const mapped: TransactionItem[] = data.map(item => ({
            id: item.id || '',
            description: item.description,
            amount: item.amount.toAmount(),
            direction: item.direction,
            paymentMethod: item.paymentMethod,
            occurredOn: item.occurredOn,
            opNumber: item.opNumber,
            counterparty: item.counterparty,
            operationType: item.operationType,
            paymentCondition: item.paymentCondition,
            settlesTransactionId: item.settlesTransactionId,
            classificationAccountId: item.classificationAccountId,
            revision: item.revision,
            journalEntryId: item.journalEntryId,
            purchaseItems: item.purchaseItems
          }));
          setTransactions(mapped);
      })
      .catch(err => {
        console.error('Error cargando dom_transactions desde Supabase:', err);
        setTransactionError('No se pudieron cargar las operaciones.');
      });

  }, [transactionRepo, personaPadreId]);

  const projectionMonths = INITIAL_MONTHS;
  const dynamicSections = useMemo<FlowNode[]>(() => {
    const valueByMonth = (item: { monthlyProjections?: Record<string, number>; baseMonthlyAmount: number }) =>
      projectionMonths.map(month => item.monthlyProjections?.[month] ?? item.baseMonthlyAmount);
    return [
      { id: 'flow-opening', label: 'Saldo inicial del escenario', flowType: 'initialBalance' },
      { id: 'income-section', label: 'Ingresos presupuestados', flowType: 'group',
        children: dbVentures.filter(item => item.status === 'activo').map<FlowNode>(item => ({
          id: `venture-${item.id}`, label: `${item.clientName} · ${item.projectName}`,
          flowType: 'income', origin: valueByMonth(item), defaultMethod: item.defaultPaymentMethod
        })) },
      { id: 'expense-section', label: 'Egresos presupuestados', flowType: 'group',
        children: dbExpenses.filter(item => item.status === 'activo').map<FlowNode>(item => ({
          id: `expense-${item.id}`, label: `${item.supplierName} · ${item.concept}`,
          flowType: 'expense', origin: valueByMonth(item), defaultMethod: item.defaultPaymentMethod
        })) },
      { id: 'flow-net', label: 'Flujo neto proyectado', flowType: 'net' },
      { id: 'flow-extra', label: 'Ingreso adicional necesario', flowType: 'extraNeeded' },
      { id: 'flow-final', label: 'Saldo final proyectado', flowType: 'finalBalance' }
    ];
  }, [dbVentures, dbExpenses, projectionMonths]);

  const useCase = useMemo(() => new ProjectCashFlowUseCase(), []);

  const { nodes, projection } = useMemo(() => {
    return useCase.execute({
      nodes: dynamicSections,
      selectedMethods,
      openingBalance,
      periodCount: projectionMonths.length
    });
  }, [useCase, dynamicSections, selectedMethods, openingBalance, projectionMonths]);

  const handleMethodChange = (nodeId: string, method: PaymentMethodType) => {
    setSelectedMethods(prev => ({
      ...prev,
      [nodeId]: method
    }));
  };

  const [modalInitialData, setModalInitialData] = useState<Partial<TransactionSubmitData> | undefined>(undefined);

  const handleOpenNewTransactionModal = (forcedDirection?: 'income' | 'expense' | React.MouseEvent) => {
    const direction = (forcedDirection === 'income' || forcedDirection === 'expense') ? forcedDirection : undefined;
    setNewPurchase(direction === 'expense');
    setReceiptDraft(null);
    setEditingTransaction(null);
    setModalInitialData(direction ? {
      direction,
      operationType: direction === 'expense' ? 'compra' : 'venta',
      paymentCondition: 'contado'
    } : undefined);
    setTransactionModalMode('nuevo');
    setIsTransactionModalOpen(true);
  };

  const handleOpenEditTransactionModal = (tx: TransactionItem) => {
    setNewPurchase(false);
    setReceiptDraft(null);
    setEditingTransaction(tx);
    setTransactionModalMode('editar');
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    const transaction = transactions.find(item => item.id === id);
    if (!transaction || !await confirmDomesticAction(`¿Anular ${transaction.description}? Se conservará el asiento original y se registrará su reversión.`)) return;
    setTransactionError(null);
    try {
      await transactionRepo.voidTransaction(id, personaPadreId, transaction.revision || 0);
      setTransactions(prev => prev.filter(item => item.id !== id));
      refreshAccounts();
      setAdjustments(prev => ({ ...prev, _refresh: (prev._refresh || 0) + 1 }));
    } catch (err) {
      setTransactionError(err instanceof Error ? err.message : 'No se pudo anular la operación.');
    }
  };

  const handleCreateOrUpdateTransaction = async (data: TransactionSubmitData): Promise<void> => {
    if (!Number.isFinite(data.amount) || data.amount <= 0 ||
        Math.abs(data.amount * 100 - Math.round(data.amount * 100)) > 0.000001) {
      throw new Error('El importe debe ser positivo y tener hasta dos decimales.');
    }
    if (data.operationType === 'canje') {
      throw new Error('El canje requiere una registración específica.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.occurredOn)) {
      throw new Error('Seleccioná una fecha válida.');
    }
    if (data.occurredOn > argentinaDate()) {
      throw new Error('No se puede registrar una operación futura como realizada.');
    }
    if (!data.description.trim() || !data.counterparty.trim() || !data.opNumber.trim()) {
      throw new Error('Completá concepto, contraparte y número de operación.');
    }

    const condition = data.paymentCondition;
    const opType = data.operationType;
    const isIncome = ['venta', 'honorarios', 'alquiler_ganado', 'cobro'].includes(opType);
    if ((isIncome ? 'income' : 'expense') !== data.direction) {
      throw new Error('El tipo de operación y su dirección no coinciden.');
    }
    if ((opType === 'cobro' || opType === 'pago' || opType === 'pago_tarjeta') && condition !== 'contado') {
      throw new Error('Cobros y pagos requieren una cuenta de tesorería.');
    }

    const method = condition === 'contado'
      ? paymentMethods.find(item => item.id === data.paymentMethod && item.active)
      : undefined;
    if (condition === 'contado' && !method) {
      throw new Error('Seleccioná un medio de pago activo.');
    }
    const methodKind: 'cash' | 'bank' | 'card' = method?.type || 'cash';
    if (methodKind === 'card' && !['compra', 'alquiler_perdido'].includes(opType)) {
      throw new Error('Este tipo de operación no admite tarjeta de crédito.');
    }

    const accounts = await accountingRepo.getAccounts(personaPadreId);
    const account = (code: string): DomAccountDTO => {
      const found = accounts.find(item => item.code === code && !item.isArchived);
      if (!found) throw new Error('Falta una cuenta activa del plan contable: ' + code);
      return found;
    };
    const requiresClassification = !['cobro', 'pago', 'pago_tarjeta'].includes(opType);
    const classification = requiresClassification
      ? accounts.find(item => item.id === data.classificationAccountId && !item.isArchived)
      : undefined;
    const isCapitalizableAsset = opType === 'compra' && classification?.kind === 'asset' &&
      (classification.code.startsWith('1.2.01.') || classification.code.startsWith('1.1.05.'));
    if (requiresClassification && (!classification ||
        (classification.kind !== data.direction && !isCapitalizableAsset) ||
        classification.nature !== (data.direction === 'income' ? 'credit' : 'debit'))) {
      throw new Error('Seleccioná una cuenta válida de resultado o un bien capitalizable para esta operación.');
    }
    const financialAccount = condition === 'contado' && methodKind !== 'card'
      ? accounts.find(item => !item.isArchived && (
          (method?.accountId && item.id === method.accountId) ||
          (method?.accountCode && item.code === method.accountCode)
        ))
      : null;
    if (condition === 'contado' && methodKind !== 'card' && !financialAccount) {
      throw new Error('El medio de pago no tiene una cuenta contable activa vinculada.');
    }
    if (financialAccount && (
        !['asset', 'cash', 'bank', 'wallet'].includes(financialAccount.kind) ||
        (methodKind === 'cash' && !financialAccount.code.startsWith('1.1.01.')) ||
        (methodKind === 'bank' && !['1.1.02.01', '1.1.02.02'].includes(financialAccount.code))
      )) {
      throw new Error('El medio de pago no está vinculado a una cuenta de tesorería.');
    }

    const financial = () => {
      if (!financialAccount) throw new Error('Seleccioná una cuenta de tesorería.');
      return financialAccount;
    };

    let debitAccount: DomAccountDTO;
    let creditAccount: DomAccountDTO;
    if (opType === 'venta' || opType === 'honorarios') {
      debitAccount = condition === 'cta_cte' ? account('1.1.03.01') : financial();
      creditAccount = classification!;
    } else if (opType === 'alquiler_ganado') {
      debitAccount = condition === 'cta_cte' ? account('1.1.03.01') : financial();
      creditAccount = classification!;
    } else if (opType === 'compra' || opType === 'alquiler_perdido') {
      debitAccount = classification!;
      creditAccount = condition === 'cta_cte' ? account('2.1.01.01')
        : methodKind === 'card' ? account('2.1.01.04') : financial();
    } else if (opType === 'cobro') {
      debitAccount = financial();
      creditAccount = account('1.1.03.01');
    } else if (opType === 'pago') {
      debitAccount = account('2.1.01.01');
      creditAccount = financial();
    } else if (opType === 'pago_tarjeta') {
      debitAccount = account('2.1.01.04');
      creditAccount = financial();
    } else {
      throw new Error('Tipo de operación no admitido.');
    }

    const amount = Money.fromAmount(data.amount);
    const operationId = editingTransaction?.id || data.requestId;
    const expectedRevision = editingTransaction?.revision || 0;
    const opNumber = data.opNumber.trim();
    const counterparty = data.counterparty.trim();
    const saved = await transactionRepo.saveTransaction({
      id: operationId,
      personaPadreId,
      direction: data.direction,
      amount,
      description: data.description.trim(),
      occurredOn: data.occurredOn,
      paymentMethod: condition === 'cta_cte' ? 'cta_cte' : data.paymentMethod,
      status: 'confirmed',
      opNumber,
      counterparty,
      operationType: opType,
      paymentCondition: condition,
      settlesTransactionId: data.settlesTransactionId || null,
      classificationAccountId: classification?.id || null,
      purchaseItems: data.purchaseItems
    }, [
      { accountId: debitAccount.id, debit: amount.toAmount(), credit: 0, memo: data.description },
      { accountId: creditAccount.id, debit: 0, credit: amount.toAmount(), memo: data.description }
    ], methodKind, financialAccount?.id || null, expectedRevision);

    const item: TransactionItem = {
      id: saved.id || operationId,
      description: saved.description,
      amount: saved.amount.toAmount(),
      direction: saved.direction,
      paymentMethod: saved.paymentMethod,
      occurredOn: saved.occurredOn,
      opNumber: saved.opNumber,
      counterparty: saved.counterparty,
      operationType: saved.operationType,
      paymentCondition: saved.paymentCondition,
      settlesTransactionId: saved.settlesTransactionId,
      classificationAccountId: saved.classificationAccountId,
      revision: saved.revision,
      journalEntryId: saved.journalEntryId,
      purchaseItems: saved.purchaseItems
    };
    setTransactions(previous => editingTransaction
      ? previous.map(tx => tx.id === item.id ? item : tx)
      : [item, ...previous]);
    refreshAccounts();
    setAdjustments(previous => ({ ...previous, _refresh: (previous._refresh || 0) + 1 }));
    setEditingTransaction(null);
    setTransactionModalMode('nuevo');
  };

  const handleApplyAdjustment = async (data: AdjustmentData) => {
    try {
      const dbAccs = await accountingRepo.getAccounts(personaPadreId);

      const accountCodeMap: Record<string, string> = {
        bank_available: '1.1.02.01',
        bank_accounts: '1.1.02.02',
        cash_available: '1.1.01.01',
        receivables: '1.1.03.01',
        payables: '2.1.01.01',
        card_installments: '2.1.01.04'
      };

      const targetCode = accountCodeMap[data.componentKey];
      const targetAcc = dbAccs.find((a: DomAccountDTO) => a.code === targetCode);
      const contraAcc = dbAccs.find((a: DomAccountDTO) => a.id === data.contraAccountId);
      if (!targetAcc || !contraAcc || targetAcc.isArchived || contraAcc.isArchived ||
          targetAcc.id === contraAcc.id) {
        throw new Error('Elegí una cuenta objetivo y una contrapartida activas y diferentes.');
      }
      const current = targetAcc.currentBalance;
      const computedDelta = data.adjustmentType === 'set_balance'
        ? data.amount - current
        : data.adjustmentType === 'increase' ? data.amount : -data.amount;
      if (Math.round((current + computedDelta) * 100) < 0) {
        throw new Error('El ajuste dejaría la cuenta con saldo negativo.');
      }
      if (Math.abs(computedDelta) < 0.01) {
        throw new Error('El importe no modifica el saldo actual.');
      }

      if (Math.abs(computedDelta) >= 0.01) {
        const absDelta = Math.abs(computedDelta);
        const targetIsDebit = (targetAcc.nature === 'debit') === (computedDelta > 0);
        const lines = [
          { personaPadreId, accountId: targetAcc.id, debit: targetIsDebit ? absDelta : 0,
            credit: targetIsDebit ? 0 : absDelta, memo: `Ajuste: ${data.reason}` },
          { personaPadreId, accountId: contraAcc.id, debit: targetIsDebit ? 0 : absDelta,
            credit: targetIsDebit ? absDelta : 0, memo: `Contrapartida: ${data.reason}` }
        ];
        const contraMovement = contraAcc.nature === 'debit'
          ? lines[1].debit - lines[1].credit
          : lines[1].credit - lines[1].debit;
        if (['asset', 'cash', 'bank', 'wallet', 'liability', 'card'].includes(contraAcc.kind) &&
            Math.round((contraAcc.currentBalance + contraMovement) * 100) < 0) {
          throw new Error('La contrapartida quedaría con saldo negativo.');
        }

        const todayStr = argentinaDate();
        const entryRef = `AJU-${crypto.randomUUID()}`;

        await accountingRepo.recordJournalEntry({
          personaPadreId,
          entryDate: todayStr,
          description: `[Ajuste Contable] ${data.componentLabel}: ${data.reason}`,
          referenceId: entryRef,
          lines
        });

        console.log('Asiento de ajuste registrado exitosamente en Supabase dom_journal_entries:', entryRef);
      }
      refreshAccounts();
      setAdjustments(prev => ({ ...prev, _refresh: (prev._refresh || 0) + 1 }));
    } catch (err) {
      console.error('Error al registrar asiento de ajuste en Supabase:', err);
      throw err;
    }
  };

  const accountBalance = (code: string) => dbAccounts.find(account => account.code === code)?.currentBalance || 0;
  const verifiedAccountBalance = (code: string) => dbAccounts.find(account => account.code === code)?.currentBalance;
  const accountsReceivable = Money.fromAmount(accountBalance('1.1.03.01'));
  const accountsPayable = Money.fromAmount(dbAccounts
    .filter(account => account.code.startsWith('2.1.01.') && account.code !== '2.1.01.04')
    .reduce((sum, account) => sum + account.currentBalance, 0));
  const cashAvailable = Money.fromAmount(accountBalance('1.1.01.01'));
  const bankAvailable = Money.fromAmount(accountBalance('1.1.02.01') + accountBalance('1.1.02.02'));
  const cardDebtBalance = verifiedAccountBalance('2.1.01.04');
  const cardDebt = cardDebtBalance == null ? null : Money.fromAmount(cardDebtBalance);

  return (
    <div className="flex min-h-dvh min-w-0 bg-[#F4F6F8] dark:bg-[#070D1B] text-[#172033] dark:text-gray-100 transition-colors duration-300">
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        userEmail={email}
        onSignOut={() => void signOut()}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onNewAdjustment={() => setIsAdjustmentModalOpen(true)}
          onOpenVoice={voice.open}
          voiceActive={voice.active}
          voiceVisible={voice.visible}
          onOpenCamera={openReceiptCamera}
          onOpenMore={() => setMobileMenuOpen(true)}
          moreOpen={mobileMenuOpen}
        />

        <main id="main-content" className="flex-1 min-w-0 w-full px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 lg:px-6 lg:pt-6 lg:pb-8 xl:px-8 2xl:px-10">
          {/* 0. MÓDULO HOME (TODO LIST MINIMALISTA) */}
          {currentTab === 'dashboard' && (
            <HomeDueTasksPanel onOpenExpenses={() => handleTabChange('egresos')} />
          )}

          <Suspense fallback={<PanelSkeleton />}>

          {/* 1. MÓDULO BILLETERA & DIARIO (SALDOS + MOVIMIENTOS INTEGRADOS) */}
          {(currentTab === 'billetera' || currentTab === 'transacciones') && (
            <div className="space-y-6">
              <PageHeader
                title="Billetera & Diario Operativo"
                subtitle="Registro contable automático, tesorería y comprobantes"
                icon={Wallet}
                iconBgColor="bg-[#0088FF]"
                actionContainerClassName="flex"
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button type="button" onClick={openReceiptCamera} className="flex items-center gap-2 rounded-xl bg-[#0088FF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors">
                      <Camera className="h-4 w-4" /> Fotografiar comprobante
                    </button>
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

              {transactionError && (
                <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm text-red-700 dark:text-red-300">
                  {transactionError}
                </p>
              )}

              {/* Saldos de Tesorería */}
              {accountsLoading ? (
                <p role="status" className="text-sm text-gray-500">Cargando saldos contables…</p>
              ) : accountsError || dbAccounts.length === 0 ? (
                <p role="alert" className="rounded-xl border border-amber-500 p-4 text-sm text-amber-700 dark:text-amber-300">
                  {accountsError || 'No hay plan de cuentas para mostrar saldos.'}
                </p>
              ) : (
                <MainDashboardKPIs
                  accountsReceivable={accountsReceivable}
                  accountsPayable={accountsPayable}
                  cashAvailable={cashAvailable}
                  bankAvailable={bankAvailable}
                  cardDebt={cardDebt}
                />
              )}

              {/* Movimientos & Asientos */}
              <TransactionsPanel
                transactions={transactions}
                onEditTransaction={handleOpenEditTransactionModal}
                onDeleteTransaction={handleDeleteTransaction}
                paymentMethods={paymentMethods}
              />
            </div>
          )}

          {/* 2. MÓDULO PLANIFICADOR & TARJETAS */}
          {(currentTab === 'planificador' || currentTab === 'egresos' || currentTab === 'fuentes_ingresos' || currentTab === 'escenario' || currentTab === 'atrasos') && (
            <div>
              <PageHeader
                title="Planificador & Tarjetas"
                subtitle="Cuotas, vencimientos mensuales y estructura presupuestaria"
                icon={Receipt}
                iconBgColor="bg-[#F59E0B]"
              />

              <div className="mb-5 inline-flex rounded-2xl bg-gray-200/80 p-1.5 dark:bg-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setPlannerView('tarjetas')}
                  aria-pressed={plannerView === 'tarjetas'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${plannerView === 'tarjetas' ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Tarjetas & Cuotas
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerView('vencimientos')}
                  aria-pressed={plannerView === 'vencimientos'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${plannerView === 'vencimientos' ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Vencimientos & Atrasos
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerView('presupuesto')}
                  aria-pressed={plannerView === 'presupuesto'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${plannerView === 'presupuesto' ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Estructura Presupuestaria
                </button>
              </div>

              {plannerView === 'tarjetas' && (
                <MonthlyCashPanel
                  personaPadreId={personaPadreId}
                  repository={monthlyCashRepo}
                  cardDebt={accountsLoading || accountsError ? null : cardDebt}
                  onTransactions={() => handleTabChange('transacciones')}
                />
              )}

              {plannerView === 'vencimientos' && (
                <div className="space-y-6">
                  <OverduesPanel transactions={transactions} />
                </div>
              )}

              {plannerView === 'presupuesto' && (
                <div className="space-y-8">
                  <ExpensesPanel />
                  <VenturesPanel onVenturesChange={() => {
                    ventureRepo.getVentures(personaPadreId).then(v => setDbVentures(v));
                  }} />
                </div>
              )}
            </div>
          )}

          {/* 3. MÓDULO PATRIMONIO & BIENES */}
          {(currentTab === 'patrimonio' || currentTab === 'bienes_uso' || currentTab === 'bienes_cambio' || currentTab === 'productos_consumo') && (
            <div>
              <PageHeader
                title="Patrimonio & Bienes"
                subtitle="Bienes de uso, amortizaciones RT 54 y gestión de consumo"
                icon={Building2}
                iconBgColor="bg-[#8B5CF6]"
              />

              <div className="mb-5 inline-flex rounded-2xl bg-gray-200/80 p-1.5 dark:bg-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setAssetsView('bienes_uso')}
                  aria-pressed={assetsView === 'bienes_uso'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${assetsView === 'bienes_uso' ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Bienes de Uso (RT 54)
                </button>
                <button
                  type="button"
                  onClick={() => setAssetsView('consumo')}
                  aria-pressed={assetsView === 'consumo'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${assetsView === 'consumo' ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Productos & Consumo
                </button>
              </div>

              {assetsView === 'bienes_uso' ? (
                <FixedAssetsPanel />
              ) : (
                <div className="space-y-6">
                  <ProductsConsumptionPanel
                    personaPadreId={personaPadreId}
                    repository={consumptionRepo}
                    onPhoto={openReceiptCamera}
                    onNewPurchase={() => { handleOpenNewTransactionModal(); setNewPurchase(true); }}
                    onOpenTransaction={id => {
                      const transaction = transactions.find(item => item.id === id);
                      if (!transaction) { setTransactionError('Actualizá Transacciones para abrir ese comprobante.'); handleTabChange('transacciones'); return; }
                      setReceiptDraft(null); setNewPurchase(false); setEditingTransaction(transaction);
                      setTransactionModalMode('ver'); setIsTransactionModalOpen(true);
                    }}
                  />
                  <InventoryPanel />
                </div>
              )}
            </div>
          )}

          {/* 4. MÓDULO TABLERO CONTABLE RT 6 */}
          {(currentTab === 'contable' || currentTab === 'seguimiento' || currentTab === 'parametros') && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <PageHeader
                  title="Tablero Contable RT 6"
                  subtitle="Estados contables, ajuste por inflación (RECPAM) y tenencia (RxT)"
                  icon={BookOpen}
                  iconBgColor="bg-[#059669]"
                />
                <button
                  type="button"
                  onClick={() => setIsRxTModalOpen(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#059669] px-4 py-2 text-xs font-bold text-white hover:bg-[#047857] shadow-md shadow-emerald-500/20"
                >
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  Revaluar activos (RxT)
                </button>
              </div>

              <div className="mb-5 inline-flex rounded-2xl bg-gray-200/80 p-1.5 dark:bg-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setAccountingView('balance')}
                  aria-pressed={accountingView === 'balance'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${accountingView === 'balance' ? 'bg-[#059669] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Balance & Resultados
                </button>
                <button
                  type="button"
                  onClick={() => setAccountingView('cierre_rt6')}
                  aria-pressed={accountingView === 'cierre_rt6'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${accountingView === 'cierre_rt6' ? 'bg-[#059669] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Ajuste RT 6 & Cierre
                </button>
                <button
                  type="button"
                  onClick={() => setAccountingView('parametros')}
                  aria-pressed={accountingView === 'parametros'}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${accountingView === 'parametros' ? 'bg-[#059669] text-white shadow-sm' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Parámetros & IPC
                </button>
              </div>

              {accountingView === 'balance' && (
                <div className="space-y-6">
                  {projectionError ? (
                    <div role="alert" className="rounded-xl border border-amber-500 p-4 text-sm">{projectionError}</div>
                  ) : (
                    <FinancialChart
                      months={projectionMonths}
                      income={projection.income}
                      expense={projection.expense}
                      net={projection.net}
                    />
                  )}
                  <ActualTrackingPanel
                    adjustments={adjustments}
                    nodes={nodes}
                    months={projectionMonths}
                    selectedMethods={selectedMethods}
                    onMethodChange={handleMethodChange}
                    openingBalance={openingBalance}
                    onOpeningBalanceChange={setOpeningBalance}
                  />
                </div>
              )}

              {accountingView === 'cierre_rt6' && (
                <div className="space-y-6">
                  <RecpamInflationSection />
                  <FiscalYearsSection />
                </div>
              )}

              {accountingView === 'parametros' && (
                <ParametersPanel paymentMethods={paymentMethods} />
              )}
            </div>
          )}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        <DomesticVoicePanel voice={voice} onOpenReceipt={openReceiptCamera} />
        {receiptFile && <ReceiptCaptureModal file={receiptFile} onClose={() => setReceiptFile(null)} onRetake={openReceiptCamera}
          onDraft={draft => {
            setReceiptDraft(draft); setReceiptFile(null); setEditingTransaction(null);
            setTransactionModalMode('nuevo'); setIsTransactionModalOpen(true); handleTabChange('transacciones');
          }} />}
        {isTransactionModalOpen && (
          <TransactionModal
            isOpen={isTransactionModalOpen}
            mode={transactionModalMode}
            onClose={() => { setIsTransactionModalOpen(false); setReceiptDraft(null); setModalInitialData(undefined); }}
            onSubmit={handleCreateOrUpdateTransaction}
            paymentMethods={paymentMethods}
            accounts={dbAccounts}
            transactions={transactions}
            initialData={receiptFields ?? (editingTransaction ? (editingTransaction as Partial<TransactionSubmitData>) : (modalInitialData ?? purchaseDefaults))}
            receiptDraft={receiptDraft ?? undefined}
          />
        )}
        {isAdjustmentModalOpen && (
          <AdjustmentModal
            isOpen={isAdjustmentModalOpen}
            onClose={() => setIsAdjustmentModalOpen(false)}
            onApplyAdjustment={handleApplyAdjustment}
            accounts={dbAccounts}
            liveValues={{
              bank_available: verifiedAccountBalance('1.1.02.01'),
              bank_accounts: verifiedAccountBalance('1.1.02.02'),
              cash_available: verifiedAccountBalance('1.1.01.01'),
              receivables: verifiedAccountBalance('1.1.03.01'),
              payables: verifiedAccountBalance('2.1.01.01'),
              card_installments: verifiedAccountBalance('2.1.01.04')
            }}
          />
        )}
        {isRxTModalOpen && (
          <RxTRevaluationModal
            isOpen={isRxTModalOpen}
            onClose={() => setIsRxTModalOpen(false)}
            accounts={dbAccounts}
            onSuccess={() => {
              setIsRxTModalOpen(false);
              refreshAccounts();
            }}
          />
        )}
      </Suspense>
      <DomesticConfirmation />
      <input ref={receiptInput} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Foto de ticket o factura"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) setReceiptFile(file);
        }} />
    </div>
  );
};

export default App;
