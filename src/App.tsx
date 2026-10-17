import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './presentation/components/Sidebar';
import { BottomNav } from './presentation/components/BottomNav';
import { HomeDueTasksPanel } from './presentation/components/HomeDueTasksPanel';
import { PageHeader } from './presentation/components/PageHeader';
import { MainDashboardKPIs } from './presentation/components/MainDashboardKPIs';
import { FinancialChart } from './presentation/components/FinancialChart';
import { ActualTrackingPanel } from './presentation/components/ActualTrackingPanel';
import { NoExtraScenarioPanel } from './presentation/components/NoExtraScenarioPanel';
import { ParametersPanel } from './presentation/components/ParametersPanel';
import { OverduesPanel } from './presentation/components/OverduesPanel';
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
import { SupabaseDomExpenseRepository } from './infrastructure/SupabaseDomExpenseRepository';
import { DomExpenseDTO } from './domain/expenses/DomExpense';
import { FlowNode } from './domain/cashflow/CashFlowProjectionService';

import {
  BarChart3,
  Settings,
  SlidersHorizontal,
  PlusCircle,
  ArrowLeftRight,
  BookOpen,
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
  const [reportsView, setReportsView] = useState<'summary' | 'accounting' | 'overdues'>('summary');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (currentTab === 'atrasos') {
      setReportsView('overdues');
      setCurrentTab('seguimiento');
    }
  }, [currentTab]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    window.scrollTo(0, 0);
  };
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, PaymentMethodType>>({});
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [isRxTModalOpen, setIsRxTModalOpen] = useState<boolean>(false);
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
  }, [ventureRepo, expenseRepo, currentTab, personaPadreId]);

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
            journalEntryId: item.journalEntryId
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
    const transaction = transactions.find(item => item.id === id);
    if (!transaction || !window.confirm('¿Anular esta operación? Se conservará el asiento original y se registrará su reversión.')) return;
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
      classificationAccountId: classification?.id || null
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
      journalEntryId: saved.journalEntryId
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
  const cardsAvailable = null;

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
          onNewTransaction={handleOpenNewTransactionModal}
          onOpenRevaluation={() => setIsRxTModalOpen(true)}
          onOpenMore={() => setMobileMenuOpen(true)}
          moreOpen={mobileMenuOpen}
        />

        <main id="main-content" className="flex-1 min-w-0 w-full px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 lg:px-6 lg:pt-6 lg:pb-8 xl:px-8 2xl:px-10">
          {/* MÓDULO HOME */}
          {currentTab === 'dashboard' && (
            <HomeDueTasksPanel onOpenExpenses={() => handleTabChange('egresos')} />
          )}

          {/* MÓDULO TRANSACCIONES */}
          {currentTab === 'transacciones' && (
            <>
              <PageHeader
                title="Transacciones"
                icon={ArrowLeftRight}
                iconBgColor="bg-[#0088FF]"
                actionContainerClassName="hidden lg:flex"
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
              {transactionError && <p role="alert" className="mb-3 rounded-xl border border-red-500 p-3 text-sm text-red-700 dark:text-red-300">{transactionError}</p>}
              <TransactionsPanel
                transactions={transactions}
                onEditTransaction={handleOpenEditTransactionModal}
                onDeleteTransaction={handleDeleteTransaction}
                paymentMethods={paymentMethods}
              />
            </>
          )}

          {/* MÓDULO FUENTES DE INGRESOS */}
          {(currentTab === 'fuentes_ingresos' || currentTab === 'emprendimientos') && (
            <VenturesPanel onVenturesChange={() => {
              ventureRepo.getVentures(personaPadreId).then(v => setDbVentures(v));
            }} />
          )}

          {/* MÓDULO ESTRUCTURA DE EGRESOS */}
          {currentTab === 'egresos' && (
            <ExpensesPanel />
          )}

          {/* MÓDULO REPORTES CONTABLES */}
          {currentTab === 'seguimiento' && (
            <>
              <PageHeader
                title="Reportes y Dashboard"
                subtitle="Indicadores financieros, reportes contables y atrasos"
                icon={BookOpen}
                iconBgColor="bg-[#0f8a5f]"
              />
              <div className="mb-5 grid grid-cols-1 gap-2 rounded-2xl bg-gray-200/80 p-1.5 dark:bg-[#1E293B] sm:inline-grid sm:grid-cols-3 sm:min-w-[32rem]">
                <button
                  type="button"
                  onClick={() => setReportsView('summary')}
                  aria-pressed={reportsView === 'summary'}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${reportsView === 'summary' ? 'bg-[#12355b] text-white shadow-sm dark:bg-[#0088FF]' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setReportsView('accounting')}
                  aria-pressed={reportsView === 'accounting'}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${reportsView === 'accounting' ? 'bg-[#12355b] text-white shadow-sm dark:bg-[#0088FF]' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Reportes contables
                </button>
                <button
                  type="button"
                  onClick={() => setReportsView('overdues')}
                  aria-pressed={reportsView === 'overdues'}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${reportsView === 'overdues' ? 'bg-[#12355b] text-white shadow-sm dark:bg-[#0088FF]' : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  Pendientes
                </button>
              </div>
              {reportsView === 'summary' ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-[#172033] dark:text-white">Resumen financiero</h2>
                    <button
                      type="button"
                      onClick={() => setIsRxTModalOpen(true)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#059669] px-4 py-2 text-xs font-bold text-white hover:bg-[#047857]"
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      Revaluar activos (RxT)
                    </button>
                  </div>
                  {accountsLoading ? (
                    <p role="status" className="mb-4 text-sm text-gray-500">Cargando saldos contables…</p>
                  ) : accountsError || dbAccounts.length === 0 ? (
                    <p role="alert" className="mb-4 rounded-xl border border-amber-500 p-4 text-sm text-amber-700 dark:text-amber-300">
                      {accountsError || 'No hay plan de cuentas para mostrar saldos.'}
                    </p>
                  ) : (
                    <MainDashboardKPIs
                      accountsReceivable={accountsReceivable}
                      accountsPayable={accountsPayable}
                      cashAvailable={cashAvailable}
                      bankAvailable={bankAvailable}
                      cardsAvailable={cardsAvailable}
                    />
                  )}
                  {projectionError ? <div role="alert" className="rounded-xl border border-amber-500 p-4 text-sm">{projectionError}</div> : <FinancialChart
                    months={projectionMonths}
                    income={projection.income}
                    expense={projection.expense}
                    net={projection.net}
                  />}
                </div>
              ) : reportsView === 'accounting' ? (
                <ActualTrackingPanel
                  adjustments={adjustments}
                  nodes={nodes}
                  months={projectionMonths}
                  selectedMethods={selectedMethods}
                  onMethodChange={handleMethodChange}
                  openingBalance={openingBalance}
                  onOpeningBalanceChange={setOpeningBalance}
                />
              ) : (
                <OverduesPanel transactions={transactions} />
              )}
            </>
          )}

          {/* MÓDULO ESCENARIO SIN EXTRA */}
          {currentTab === 'escenario' && (
            <>
              <PageHeader
                title="Escenario de caja sin aporte adicional"
                subtitle="Proyección desde fuentes y egresos registrados"
                icon={BarChart3}
                iconBgColor="bg-amber-600"
              />
              <NoExtraScenarioPanel months={projectionMonths} income={projection.income}
                expense={projection.expense} openingBalance={openingBalance} loadError={projectionError} />
            </>
          )}

          {/* MÓDULO PARÁMETROS & IPC */}
          {currentTab === 'parametros' && (
            <>
              <PageHeader
                title="Configuración contable"
                subtitle="Cuentas de pago y ejercicios económicos"
                icon={Settings}
                iconBgColor="bg-slate-700"
              />
              <ParametersPanel
                paymentMethods={paymentMethods}
              />
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
        accounts={dbAccounts}
        transactions={transactions}
        initialData={editingTransaction ? (editingTransaction as any) : undefined}
      />

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
