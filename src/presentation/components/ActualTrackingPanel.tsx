import React, { useState, useEffect, useMemo } from 'react';
import { Money } from '../../domain/shared/Money';
import { TableSearchFilter } from './TableSearchFilter';
import { SupabaseDomAccountingRepository } from '../../infrastructure/SupabaseDomAccountingRepository';
import { SupabaseDomFixedAssetRepository } from '../../infrastructure/SupabaseDomFixedAssetRepository';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { DomFixedAssetDTO } from '../../domain/assets/DomFixedAsset';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  PieChart,
  Landmark,
  ShieldCheck,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  BookOpen,
  FileSpreadsheet,
  ListTree,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  AlertTriangle,
  TableProperties
} from 'lucide-react';
import { RxTRevaluationModal } from './RxTRevaluationModal';
import { ProjectionTable } from './ProjectionTable';
import { FlowNode } from '../../domain/cashflow/CashFlowProjectionService';
import { PaymentMethodType } from '../../domain/shared/PaymentMethod';

interface ActualTrackingPanelProps {
  adjustments?: Record<string, number>;
  nodes?: FlowNode[];
  months?: string[];
  selectedMethods?: Record<string, PaymentMethodType>;
  onMethodChange?: (nodeId: string, method: PaymentMethodType) => void;
  openingBalance?: number;
  onOpeningBalanceChange?: (val: number) => void;
}

export const ActualTrackingPanel: React.FC<ActualTrackingPanelProps> = ({
  adjustments = {},
  nodes,
  months,
  selectedMethods,
  onMethodChange,
  openingBalance,
  onOpeningBalanceChange
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'results' | 'balance' | 'journal' | 'ledger' | 'chart_of_accounts' | 'proyeccion'>('all');
  const [journalSearch, setJournalSearch] = useState<string>('');
  const [journalTypeFilter, setJournalTypeFilter] = useState<'all' | 'income' | 'expense' | 'adjustment'>('all');

  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>('1.1.02.01');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  const [coaSearch, setCoaSearch] = useState<string>('');
  const [coaGroupFilter, setCoaGroupFilter] = useState<'all' | 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'egreso'>('all');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);
  const [newAccountCode, setNewAccountCode] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountGroup, setNewAccountGroup] = useState<'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'egreso'>('activo');
  const [newAccountSubrubro, setNewAccountSubrubro] = useState<string>('Activo Corriente');
  const [isRxTModalOpen, setIsRxTModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<DomAccountDTO | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<DomAccountDTO | null>(null);

  const [collapsedSubrubros, setCollapsedSubrubros] = useState<Record<string, boolean>>({
    '1.1': true,
    '1.2': true,
    '2.1': true,
    '2.2': true,
    '3.1': true,
    '4.1': true,
    '5.1': true
  });

  const toggleSubrubro = (key: string) => {
    setCollapsedSubrubros(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [dbAccounts, setDbAccounts] = useState<DomAccountDTO[]>([]);
  const [dbEntries, setDbEntries] = useState<any[]>([]);
  const [dbFixedAssets, setDbFixedAssets] = useState<DomFixedAssetDTO[]>([]);

  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);
  const fixedAssetRepo = useMemo(() => new SupabaseDomFixedAssetRepository(), []);

  useEffect(() => {
    Promise.all([
      accountingRepo.getAccounts(1),
      accountingRepo.getJournalEntries(1),
      fixedAssetRepo.getFixedAssets(1)
    ])
      .then(([accs, entries, assets]) => {
        setDbAccounts(accs);
        setDbEntries(entries);
        setDbFixedAssets(assets);
      })
      .catch(err => console.error('Error al cargar datos contables desde Supabase:', err));
  }, [accountingRepo, fixedAssetRepo, adjustments]);

  const todayDateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const activeBank = adjustments['bank_available'] ?? 0.00;
  const activeCash = adjustments['cash_available'] ?? 0.00;
  const activeReceivables = adjustments['receivables'] ?? 0.00;
  const passivePayables = adjustments['payables'] ?? 0.00;
  const passiveCardStock = adjustments['card_installments'] ?? 0.00;
  const ingresosEjecutados = adjustments['income_executed'] ?? 0.00;
  const egresosEjecutados = adjustments['expense_executed'] ?? 0.00;

  const totalActivo = activeBank + activeCash + activeReceivables;
  const totalPasivo = passivePayables + passiveCardStock;
  const patrimonioNeto = totalActivo - totalPasivo;

  // Clasificación por Rubros y Subrubros
  const assetAccounts = dbAccounts.filter(a => a.kind === 'asset' || a.kind === 'cash' || a.kind === 'bank' || a.kind === 'wallet');
  const activoCorriente = assetAccounts.filter(a => !a.subrubro || a.subrubro === 'Activo Corriente' || a.subrubro === 'General');
  const activoNoCorriente = assetAccounts.filter(a => a.subrubro === 'Activo No Corriente');

  const liabilityAccounts = dbAccounts.filter(a => a.kind === 'liability' || a.kind === 'card');
  const pasivoCorriente = liabilityAccounts.filter(a => !a.subrubro || a.subrubro === 'Pasivo Corriente' || a.subrubro === 'General');
  const pasivoNoCorriente = liabilityAccounts.filter(a => a.subrubro === 'Pasivo No Corriente');

  const equityAccounts = dbAccounts.filter(a => a.kind === 'equity');
  const incomeAccounts = dbAccounts.filter(a => a.kind === 'income');
  const expenseAccounts = dbAccounts.filter(a => a.kind === 'expense');

  const totalActivoCorriente = assetAccounts.length > 0
    ? activoCorriente.reduce((sum, a) => sum + a.currentBalance, 0)
    : (activeBank + activeCash + activeReceivables);

  const fixedAssetsNetValue = dbFixedAssets.reduce((sum, a) => sum + (a.acquisitionCost - a.accumulatedDepreciation), 0);
  const rawActivoNoCorriente = assetAccounts.length > 0
    ? activoNoCorriente.reduce((sum, a) => sum + a.currentBalance, 0)
    : 0;

  const totalActivoNoCorriente = rawActivoNoCorriente > 0 ? rawActivoNoCorriente : fixedAssetsNetValue;

  const totalActivoCalculado = assetAccounts.length > 0
    ? (totalActivoCorriente + totalActivoNoCorriente)
    : totalActivo;

  const totalPasivoCorriente = liabilityAccounts.length > 0
    ? pasivoCorriente.reduce((sum, a) => sum + a.currentBalance, 0)
    : (passivePayables + passiveCardStock);

  const totalPasivoNoCorriente = liabilityAccounts.length > 0
    ? pasivoNoCorriente.reduce((sum, a) => sum + a.currentBalance, 0)
    : 0;

  const totalPasivoCalculado = liabilityAccounts.length > 0
    ? (totalPasivoCorriente + totalPasivoNoCorriente)
    : totalPasivo;

  const totalPatrimonioNetoCalculado = equityAccounts.length > 0
    ? equityAccounts.reduce((sum, a) => sum + a.currentBalance, 0)
    : patrimonioNeto;

  const totalIngresosCalculados = incomeAccounts.length > 0
    ? incomeAccounts.reduce((sum, a) => sum + a.currentBalance, 0)
    : ingresosEjecutados;

  const totalEgresosCalculados = expenseAccounts.length > 0
    ? expenseAccounts.reduce((sum, a) => sum + a.currentBalance, 0)
    : egresosEjecutados;

  const resultadoNetoRealCalculado = totalIngresosCalculados - totalEgresosCalculados;

  // ASIENTOS DEL LIBRO DIARIO (DESDE SUPABASE DB)
  const journalEntries = useMemo(() => {
    if (dbEntries.length === 0) {
      return [];
    }

    return dbEntries.map(entry => {
      const debitLine = (entry.lines || []).find((l: any) => Number(l.debit) > 0);
      const creditLine = (entry.lines || []).find((l: any) => Number(l.credit) > 0);
      const totalDebit = (entry.lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = (entry.lines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0);

      const refStr = entry.referenceId || `AST-${String(entry.entryNumber).padStart(3, '0')}`;
      let entryType: 'income' | 'expense' | 'adjustment' = 'adjustment';
      const descLower = (entry.description || '').toLowerCase();

      if (descLower.includes('ajuste') || descLower.includes('apertura') || refStr.startsWith('AJU') || refStr.startsWith('APERTURA')) {
        entryType = 'adjustment';
      } else if (descLower.includes('cobro') || descLower.includes('honorario') || descLower.includes('ingreso')) {
        entryType = 'income';
      } else if (descLower.includes('pago') || descLower.includes('compra') || descLower.includes('alquiler') || descLower.includes('egreso')) {
        entryType = 'expense';
      }

      const formattedDate = entry.entryDate && entry.entryDate.includes('-')
        ? entry.entryDate.split('-').reverse().join('/')
        : (entry.entryDate || todayDateStr);

      return {
        id: refStr,
        date: formattedDate,
        type: entryType,
        concept: entry.description,
        debitAccount: debitLine ? `${debitLine.accountCode} ${debitLine.accountName}` : 'Varias Cuentas',
        creditAccount: creditLine ? `${creditLine.accountCode} ${creditLine.accountName}` : 'Varias Cuentas',
        debitAmount: totalDebit,
        creditAmount: totalCredit,
        lines: entry.lines || []
      };
    });
  }, [dbEntries, todayDateStr]);

  const filteredJournalEntries = journalEntries.filter((entry) => {
    const matchesSearch = entry.concept.toLowerCase().includes(journalSearch.toLowerCase()) ||
      entry.id.toLowerCase().includes(journalSearch.toLowerCase()) ||
      entry.debitAccount.toLowerCase().includes(journalSearch.toLowerCase()) ||
      entry.creditAccount.toLowerCase().includes(journalSearch.toLowerCase());
    const matchesType = journalTypeFilter === 'all' || entry.type === journalTypeFilter;
    return matchesSearch && matchesType;
  });

  const totalJournalDebit = filteredJournalEntries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalJournalCredit = filteredJournalEntries.reduce((sum, e) => sum + e.creditAmount, 0);

  // PLAN DE CUENTAS MAYORES DINÁMICO
  const ledgerAccountsList = useMemo(() => {
    if (dbAccounts.length > 0) {
      return dbAccounts.map(a => ({
        code: a.code,
        name: `${a.code} - ${a.name}`,
        initial: a.openingBalance,
        type: a.kind === 'asset' || a.kind === 'cash' || a.kind === 'bank' || a.kind === 'wallet' ? 'activo'
            : a.kind === 'liability' || a.kind === 'card' ? 'pasivo'
            : a.kind === 'equity' ? 'patrimonio' : 'resultado'
      }));
    }
    return [
      { code: '1.1.01.01', name: '1.1.01.01 - Efectivo en Caja', initial: 0.00, type: 'activo' },
      { code: '1.1.02.01', name: '1.1.02.01 - Cuentas Virtuales / Wallets', initial: 0.00, type: 'activo' },
      { code: '1.1.02.02', name: '1.1.02.02 - Bancos / Cuentas Bancarias', initial: 0.00, type: 'activo' },
      { code: '1.1.03.01', name: '1.1.03.01 - Cuentas por Cobrar', initial: 0.00, type: 'activo' },
      { code: '2.1.01.01', name: '2.1.01.01 - Cuentas por Pagar (Proveedores)', initial: 0.00, type: 'pasivo' },
      { code: '2.1.01.02', name: '2.1.01.02 - Tarjetas de Crédito', initial: 0.00, type: 'pasivo' },
      { code: '3.1.01.01', name: '3.1.01.01 - Capital Neto del Hogar', initial: 0.00, type: 'patrimonio' },
      { code: '4.1.01.01', name: '4.1.01.01 - Ventas e Ingresos Comerciales', initial: 0.00, type: 'resultado' },
      { code: '4.1.01.02', name: '4.1.01.02 - Alquileres Ganados', initial: 0.00, type: 'resultado' },
      { code: '4.2.01.01', name: '4.2.01.01 - Ingresos por Canje / Permuta', initial: 0.00, type: 'resultado' },
      { code: '5.1.01.01', name: '5.1.01.01 - Alquiler Residencia / Inmuebles', initial: 0.00, type: 'resultado' },
      { code: '5.1.01.02', name: '5.1.01.02 - Supermercado e Insumos', initial: 0.00, type: 'resultado' },
      { code: '5.2.01.01', name: '5.2.01.01 - Ajustes y Reconciliación Contable', initial: 0.00, type: 'resultado' }
    ];
  }, [dbAccounts]);

  const handleNavigateToLedger = (code: string) => {
    const target = ledgerAccountsList.find(a => a.code === code || code.startsWith(a.code) || a.code.startsWith(code))?.code || code;
    setSelectedLedgerAccount(target);
    setActiveSection('ledger');
  };

  const currentLedgerAccount = ledgerAccountsList.find(a => a.code === selectedLedgerAccount) || ledgerAccountsList[0];

  // MOVIMIENTOS Y SALDO ACUMULADO PARCIAL DEL LIBRO MAYOR PARA LA CUENTA SELECCIONADA
  let currentRunningBalance = currentLedgerAccount ? currentLedgerAccount.initial : 0;
  const isDebitNature = currentLedgerAccount ? (currentLedgerAccount.type === 'activo' || currentLedgerAccount.type === 'resultado') : true;

  const rawLedgerMovements = journalEntries
    .filter(entry => {
      const targetCode = currentLedgerAccount?.code || '';
      if (entry.lines && entry.lines.length > 0) {
        return entry.lines.some((l: any) => l.accountCode === targetCode || (l.accountCode && targetCode.startsWith(l.accountCode)) || (l.accountCode && l.accountCode.startsWith(targetCode)));
      }
      return entry.debitAccount.includes(targetCode) || entry.creditAccount.includes(targetCode);
    })
    .map(entry => {
      const targetCode = currentLedgerAccount?.code || '';
      let debit = 0;
      let credit = 0;
      let contraAccount = 'Varias Cuentas';

      if (entry.lines && entry.lines.length > 0) {
        const myLine = entry.lines.find((l: any) => l.accountCode === targetCode || (l.accountCode && targetCode.startsWith(l.accountCode)) || (l.accountCode && l.accountCode.startsWith(targetCode)));
        const otherLines = entry.lines.filter((l: any) => l !== myLine);

        if (myLine) {
          debit = Number(myLine.debit || 0);
          credit = Number(myLine.credit || 0);
        }
        if (otherLines.length > 0) {
          contraAccount = otherLines.map((l: any) => `${l.accountCode || ''} ${l.accountName || ''}`).join(', ');
        }
      } else {
        const isDebit = entry.debitAccount.includes(targetCode);
        debit = isDebit ? entry.debitAmount : 0;
        credit = isDebit ? 0 : entry.creditAmount;
        contraAccount = isDebit ? entry.creditAccount : entry.debitAccount;
      }

      return {
        id: entry.id,
        date: entry.date,
        concept: entry.concept,
        contraAccount,
        debit,
        credit
      };
    })
    .filter(m => m.concept.toLowerCase().includes(ledgerSearch.toLowerCase()));

  const ledgerMovements = rawLedgerMovements.map(m => {
    if (isDebitNature) {
      currentRunningBalance = currentRunningBalance + m.debit - m.credit;
    } else {
      currentRunningBalance = currentRunningBalance + m.credit - m.debit;
    }
    return {
      ...m,
      runningBalance: currentRunningBalance
    };
  });

  const totalLedgerDebit = ledgerMovements.reduce((sum, m) => sum + m.debit, 0);
  const totalLedgerCredit = ledgerMovements.reduce((sum, m) => sum + m.credit, 0);
  const finalLedgerBalance = (currentLedgerAccount?.initial || 0) + (isDebitNature ? totalLedgerDebit - totalLedgerCredit : totalLedgerCredit - totalLedgerDebit);

  return (
    <div className="space-y-8">
      {/* NAVEGADOR DE SECCIONES (ESTADOS FINANCIEROS, LIBRO DIARIO Y LIBRO MAYOR) */}
      <div className="p-1.5 sm:p-2 bg-gray-200/80 dark:bg-[#1E293B] rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-none gap-1.5 sm:gap-2 pb-0.5 sm:pb-0">
          <button
            onClick={() => setActiveSection('all')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'all'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <PieChart className="w-4 h-4 shrink-0" />
            <span>Vista Completa</span>
          </button>

          <button
            onClick={() => setActiveSection('results')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'results'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>1. Resultados</span>
          </button>

          <button
            onClick={() => setActiveSection('balance')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'balance'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span>2. Balance</span>
          </button>

          <button
            onClick={() => setActiveSection('journal')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'journal'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>3. Libro Diario</span>
          </button>

          <button
            onClick={() => setActiveSection('ledger')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'ledger'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>4. Libro Mayor</span>
          </button>

          <button
            onClick={() => setActiveSection('chart_of_accounts')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'chart_of_accounts'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <ListTree className="w-4 h-4 shrink-0" />
            <span>5. Plan de Cuentas</span>
          </button>

          <button
            onClick={() => setActiveSection('proyeccion')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeSection === 'proyeccion'
                ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-800'
            }`}
          >
            <TableProperties className="w-4 h-4 shrink-0" />
            <span>6. Proyección</span>
          </button>
        </div>
      </div>

      {/* VISTA COMPLETA Y SECCIONES INDIVIDUALES (2 COLUMNAS LADO A LADO EN VISTA COMPLETA) */}
      {(activeSection === 'all' || activeSection === 'results' || activeSection === 'balance') && (
        <div className={`grid gap-6 ${activeSection === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* SECCIÓN 1 (IZQUIERDA EN VISTA COMPLETA): ESTADO DE SITUACIÓN PATRIMONIAL TRADICIONAL (TABLA 3 CUERPOS) */}
          {(activeSection === 'all' || activeSection === 'balance') && (
            <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#12355b] text-white p-2.5 rounded-xl shadow-md">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#172033] dark:text-white">Estado de Situación Patrimonial</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Balance Tradicional (Activo vs Pasivo + PN) al {todayDateStr}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    patrimonioNeto >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                  }`}>
                    {patrimonioNeto >= 0 ? 'Solvencia Positiva' : 'Patrimonio Negativo'}
                  </span>
                </div>

                {/* ESTRUCTURA TIPO TABLA DE TRES CUERPOS CON SUBRUBROS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CUERPO 1: ACTIVO (COLUMNA IZQUIERDA) */}
                  <div className="bg-gray-50/80 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          1. ACTIVO (Bienes y Derechos)
                        </h3>
                      </div>

                      {/* SUBRUBRO 1.1: ACTIVO CORRIENTE */}
                      <div className="space-y-2">
                        <div
                          onClick={() => toggleSubrubro('1.1')}
                          className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsedSubrubros['1.1'] ? <ChevronRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                            1.1 ACTIVO CORRIENTE
                          </span>
                          <strong className="font-extrabold text-xs table-cell-num text-emerald-900 dark:text-emerald-200">
                            {Money.fromAmount(totalActivoCorriente).toFormattedString()}
                          </strong>
                        </div>
                        {!collapsedSubrubros['1.1'] && (
                          <div className="space-y-2 pt-1 pl-1">
                            {activoCorriente.length > 0 ? (
                              activoCorriente.map(acc => (
                                <div
                                  key={acc.id}
                                  onClick={() => handleNavigateToLedger(acc.code || '1.1.01')}
                                  title={`Ver Libro Mayor de ${acc.name}`}
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {acc.code} {acc.name}
                                  </span>
                                  <strong className="font-bold text-gray-900 dark:text-white table-cell-num">
                                    {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                  </strong>
                                </div>
                              ))
                            ) : (
                              <>
                                <div
                                  onClick={() => handleNavigateToLedger('1.1.02')}
                                  title="Ver Libro Mayor de Banco Naranja X"
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                    1.1.02 Banco / Naranja X
                                  </span>
                                  <strong className="font-bold text-gray-900 dark:text-white table-cell-num">
                                    {Money.fromAmount(activeBank).toFormattedString()}
                                  </strong>
                                </div>
                                <div
                                  onClick={() => handleNavigateToLedger('1.1.01')}
                                  title="Ver Libro Mayor de Caja Efectivo"
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                    1.1.01 Caja Efectivo
                                  </span>
                                  <strong className="font-bold text-gray-900 dark:text-white table-cell-num">
                                    {Money.fromAmount(activeCash).toFormattedString()}
                                  </strong>
                                </div>
                                <div
                                  onClick={() => handleNavigateToLedger('1.2.01')}
                                  title="Ver Libro Mayor de Cuentas por Cobrar"
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <ArrowDownLeft className="w-3.5 h-3.5 text-purple-500" />
                                    1.2.01 Cuentas por Cobrar
                                  </span>
                                  <strong className="font-bold text-emerald-600 dark:text-emerald-400 table-cell-num">
                                    {Money.fromAmount(activeReceivables).toFormattedString()}
                                  </strong>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* SUBRUBRO 1.2: ACTIVO NO CORRIENTE */}
                      <div className="space-y-2 pt-1">
                        <div
                          onClick={() => toggleSubrubro('1.2')}
                          className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsedSubrubros['1.2'] ? <ChevronRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                            1.2 ACTIVO NO CORRIENTE
                          </span>
                          <strong className="font-extrabold text-xs table-cell-num text-emerald-900 dark:text-emerald-200">
                            {Money.fromAmount(totalActivoNoCorriente).toFormattedString()}
                          </strong>
                        </div>
                        {!collapsedSubrubros['1.2'] && (
                          <div className="space-y-2 pt-1 pl-1">
                            {(() => {
                              const getAccountBalanceNoCorriente = (acc: DomAccountDTO): number => {
                                if (acc.currentBalance > 0) return acc.currentBalance;

                                const matchingAssets = dbFixedAssets.filter(fa => {
                                  if (fa.assetAccountId && String(fa.assetAccountId) === String(acc.id)) return true;
                                  if (fa.category === 'vehiculos' && (acc.code === '1.2.01.02' || acc.name.toLowerCase().includes('rodado') || acc.name.toLowerCase().includes('vehiculo'))) return true;
                                  if (fa.category === 'inmuebles' && (acc.code === '1.2.01.01' || acc.name.toLowerCase().includes('inmueble'))) return true;
                                  if (fa.category === 'tecnologia' && (acc.code === '1.2.01.03' || acc.name.toLowerCase().includes('tecnolog') || acc.name.toLowerCase().includes('informatic'))) return true;
                                  if (fa.category === 'muebles' && (acc.code === '1.2.01.04' || acc.name.toLowerCase().includes('mueble'))) return true;
                                  if (fa.category === 'maquinaria' && (acc.code === '1.2.01.05' || acc.name.toLowerCase().includes('maquinaria'))) return true;
                                  if (fa.category === 'instalaciones' && (acc.code === '1.2.01.06' || acc.name.toLowerCase().includes('instalacion'))) return true;
                                  return false;
                                });

                                return matchingAssets.reduce((sum, fa) => sum + Math.max(0, fa.acquisitionCost - fa.accumulatedDepreciation), 0);
                              };

                              const baseList = activoNoCorriente.length > 0 ? activoNoCorriente : [
                                { id: 44, code: '1.2.01.02', name: 'Rodados y Vehículos', currentBalance: fixedAssetsNetValue, kind: 'asset', subrubro: 'Activo No Corriente' } as DomAccountDTO,
                                { id: 34, code: '1.2.01.01', name: 'Inmuebles', currentBalance: 0, kind: 'asset', subrubro: 'Activo No Corriente' } as DomAccountDTO,
                                { id: 45, code: '1.2.01.03', name: 'Equipos Informáticos y Tecnología', currentBalance: 0, kind: 'asset', subrubro: 'Activo No Corriente' } as DomAccountDTO
                              ];

                              const itemsWithBalance = baseList.map(acc => ({
                                acc,
                                balance: getAccountBalanceNoCorriente(acc)
                              })).filter(item => item.balance > 0);

                              const finalItems = itemsWithBalance.length > 0 ? itemsWithBalance : baseList.map(acc => ({ acc, balance: acc.currentBalance }));

                              if (finalItems.length === 0) {
                                return (
                                  <div className="text-xs text-gray-400 dark:text-gray-500 italic px-2.5 py-1">
                                    Sin cuentas contables ni bienes registrados en Activo No Corriente
                                  </div>
                                );
                              }

                              return finalItems.map(({ acc, balance }) => (
                                <div
                                  key={acc.id}
                                  onClick={() => handleNavigateToLedger(acc.code || '1.2.01.02')}
                                  title={`Ver Libro Mayor de ${acc.name}`}
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all group"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span className="font-mono text-[11px] text-gray-400">{acc.code}</span>
                                    <span>{acc.name}</span>
                                  </span>
                                  <strong className="font-bold text-gray-900 dark:text-white table-cell-num group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {Money.fromAmount(balance).toFormattedString()}
                                  </strong>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">TOTAL ACTIVO</span>
                      <strong className="text-sm font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num">
                        {Money.fromAmount(totalActivoCalculado).toFormattedString()}
                      </strong>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: PASIVO (CUERPO 2) Y PATRIMONIO NETO (CUERPO 3) APILADOS */}
                  <div className="space-y-4 flex flex-col justify-between">
                    {/* CUERPO 2: PASIVO */}
                    <div className="bg-gray-50/80 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" />
                          2. PASIVO (Deudas y Obligaciones)
                        </h3>
                      </div>

                      {/* SUBRUBRO 2.1: PASIVO CORRIENTE */}
                      <div className="space-y-2">
                        <div
                          onClick={() => toggleSubrubro('2.1')}
                          className="text-[11px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider bg-red-100/70 dark:bg-red-950/60 hover:bg-red-200/80 dark:hover:bg-red-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsedSubrubros['2.1'] ? <ChevronRight className="w-3.5 h-3.5 text-red-700 dark:text-red-400" /> : <ChevronDown className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />}
                            2.1 PASIVO CORRIENTE
                          </span>
                          <strong className="font-extrabold text-xs table-cell-num text-red-900 dark:text-red-200">
                            {Money.fromAmount(totalPasivoCorriente).toFormattedString()}
                          </strong>
                        </div>
                        {!collapsedSubrubros['2.1'] && (
                          <div className="space-y-2 pt-1 pl-1">
                            {pasivoCorriente.length > 0 ? (
                              pasivoCorriente.map(acc => (
                                <div
                                  key={acc.id}
                                  onClick={() => handleNavigateToLedger(acc.code || '2.1.01')}
                                  title={`Ver Libro Mayor de ${acc.name}`}
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {acc.code} {acc.name}
                                  </span>
                                  <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                    {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                  </strong>
                                </div>
                              ))
                            ) : (
                              <>
                                <div
                                  onClick={() => handleNavigateToLedger('2.1.01')}
                                  title="Ver Libro Mayor de Obligaciones Prioritarias"
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                                    2.1.01 Obligaciones Prioritarias
                                  </span>
                                  <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                    {Money.fromAmount(passivePayables).toFormattedString()}
                                  </strong>
                                </div>
                                <div
                                  onClick={() => handleNavigateToLedger('2.1.02')}
                                  title="Ver Libro Mayor de Consumos de Tarjeta Naranja"
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <CreditCardIcon className="w-3.5 h-3.5 text-amber-500" />
                                    2.1.02 Tarjeta Naranja en Cuotas
                                  </span>
                                  <strong className="font-bold text-amber-600 dark:text-amber-400 table-cell-num">
                                    {Money.fromAmount(passiveCardStock).toFormattedString()}
                                  </strong>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* SUBRUBRO 2.2: PASIVO NO CORRIENTE */}
                      <div className="space-y-2 pt-1">
                        <div
                          onClick={() => toggleSubrubro('2.2')}
                          className="text-[11px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider bg-red-100/70 dark:bg-red-950/60 hover:bg-red-200/80 dark:hover:bg-red-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsedSubrubros['2.2'] ? <ChevronRight className="w-3.5 h-3.5 text-red-700 dark:text-red-400" /> : <ChevronDown className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />}
                            2.2 PASIVO NO CORRIENTE
                          </span>
                          <strong className="font-extrabold text-xs table-cell-num text-red-900 dark:text-red-200">
                            {Money.fromAmount(totalPasivoNoCorriente).toFormattedString()}
                          </strong>
                        </div>
                        {!collapsedSubrubros['2.2'] && (
                          <div className="space-y-2 pt-1 pl-1">
                            {pasivoNoCorriente.length > 0 ? (
                              pasivoNoCorriente.map(acc => (
                                <div
                                  key={acc.id}
                                  onClick={() => handleNavigateToLedger(acc.code || '2.2.01.01')}
                                  title={`Ver Libro Mayor de ${acc.name}`}
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {acc.code} {acc.name}
                                  </span>
                                  <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                    {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                  </strong>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-400 dark:text-gray-500 italic px-2.5 py-1">
                                Sin deudas registradas en Pasivo No Corriente
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">TOTAL PASIVO</span>
                        <strong className="text-xs font-bold text-[#b54747] dark:text-red-400 table-cell-num">
                          {Money.fromAmount(totalPasivoCalculado).toFormattedString()}
                        </strong>
                      </div>
                    </div>

                    {/* CUERPO 3: PATRIMONIO NETO */}
                    <div className="bg-gray-50/80 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Landmark className="w-4 h-4" />
                          3. PATRIMONIO NETO
                        </h3>
                      </div>

                      <div className="space-y-2">
                        <div
                          onClick={() => toggleSubrubro('3.1')}
                          className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider bg-purple-100/70 dark:bg-purple-950/60 hover:bg-purple-200/80 dark:hover:bg-purple-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsedSubrubros['3.1'] ? <ChevronRight className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />}
                            3.1 CAPITAL Y RESERVAS
                          </span>
                          <strong className="font-extrabold text-xs table-cell-num text-purple-900 dark:text-purple-200">
                            {Money.fromAmount(totalPatrimonioNetoCalculado).toFormattedString()}
                          </strong>
                        </div>
                        {!collapsedSubrubros['3.1'] && (
                          <div className="space-y-2 pt-1 pl-1">
                            {equityAccounts.length > 0 ? (
                              equityAccounts.map(acc => (
                                <div
                                  key={acc.id}
                                  onClick={() => handleNavigateToLedger(acc.code || '3.1.01')}
                                  title={`Ver Libro Mayor de ${acc.name}`}
                                  className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                                >
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {acc.code} {acc.name}
                                  </span>
                                  <strong className="font-bold text-purple-600 dark:text-purple-400 table-cell-num">
                                    {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                  </strong>
                                </div>
                              ))
                            ) : (
                              <div
                                onClick={() => handleNavigateToLedger('3.1.01')}
                                title="Ver Libro Mayor de Capital Neto del Hogar"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  3.1.01 Capital Neto del Hogar
                                </span>
                                <strong className={`font-bold table-cell-num ${
                                  totalPatrimonioNetoCalculado >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {Money.fromAmount(totalPatrimonioNetoCalculado).toFormattedString()}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">TOTAL PATRIMONIO NETO</span>
                        <strong className="text-xs font-bold text-purple-600 dark:text-purple-400 table-cell-num">
                          {Money.fromAmount(totalPatrimonioNetoCalculado).toFormattedString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIE DE VERIFICACIÓN DE ECUACIÓN PATRIMONIAL */}
              <div className="mt-4 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex flex-wrap justify-between items-center text-xs font-bold text-blue-900 dark:text-blue-300 gap-2">
                <span>Ecuación Patrimonial:</span>
                <span>Activo ({Money.fromAmount(totalActivoCalculado).toFormattedString()}) = Pasivo ({Money.fromAmount(totalPasivoCalculado).toFormattedString()}) + PN ({Money.fromAmount(totalPatrimonioNetoCalculado).toFormattedString()})</span>
              </div>
            </section>
          )}

          {/* SECCIÓN 2 (DERECHA EN VISTA COMPLETA): ESTADO DE RESULTADOS TRADICIONAL (P&L APILADO) */}
          {(activeSection === 'all' || activeSection === 'results') && (
            <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#0f8a5f] text-white p-2.5 rounded-xl shadow-md">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#172033] dark:text-white">Estado de Resultados Real</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">P&L Tradicional Apilado (Ingresos - Egresos)</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    resultadoNetoRealCalculado >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                  }`}>
                    {resultadoNetoRealCalculado >= 0 ? 'Superávit Operativo' : 'Déficit Operativo'}
                  </span>
                </div>

                {/* ESTRUCTURA TRADICIONAL APILADA DE RESULTADOS CON SUBRUBROS */}
                <div className="space-y-4">
                  {/* BLOQUE 1: INGRESOS OPERATIVOS (+) */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-900/80">
                      <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        (+) INGRESOS OPERATIVOS REALES COBRADOS
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <div
                        onClick={() => toggleSubrubro('4.1')}
                        className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                      >
                        <span className="flex items-center gap-1.5">
                          {collapsedSubrubros['4.1'] ? <ChevronRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                          4.1 INGRESOS OPERATIVOS
                        </span>
                        <strong className="font-extrabold text-xs table-cell-num text-emerald-900 dark:text-emerald-200">
                          {Money.fromAmount(totalIngresosCalculados).toFormattedString()}
                        </strong>
                      </div>
                      {!collapsedSubrubros['4.1'] && (
                        <div className="space-y-2 pt-1 pl-1">
                          {incomeAccounts.length > 0 ? (
                            incomeAccounts.map(acc => (
                              <div
                                key={acc.id}
                                onClick={() => handleNavigateToLedger(acc.code || '4.1.01')}
                                title={`Ver Libro Mayor de ${acc.name}`}
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-emerald-100 dark:border-emerald-900/40 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  {acc.code} {acc.name}
                                </span>
                                <strong className="font-bold text-emerald-600 dark:text-emerald-400 table-cell-num">
                                  {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                </strong>
                              </div>
                            ))
                          ) : (
                            <>
                              <div
                                onClick={() => handleNavigateToLedger('4.1.01')}
                                title="Ver Libro Mayor de Honorarios Profesionales"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-emerald-100 dark:border-emerald-900/40 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  4.1.01 Honorarios Profesionales
                                </span>
                                <strong className="font-bold text-emerald-600 dark:text-emerald-400 table-cell-num">
                                  {Money.fromAmount(1500000.00).toFormattedString()}
                                </strong>
                              </div>
                              <div
                                onClick={() => handleNavigateToLedger('4.1.02')}
                                title="Ver Libro Mayor de Cobro Trabajo Consultoría"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-emerald-100 dark:border-emerald-900/40 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  4.1.02 Cobro Trabajo Consultoría
                                </span>
                                <strong className="font-bold text-emerald-600 dark:text-emerald-400 table-cell-num">
                                  {Money.fromAmount(1262000.00).toFormattedString()}
                                </strong>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/80 flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase">SUBTOTAL INGRESOS</span>
                      <strong className="text-sm font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num">
                        {Money.fromAmount(totalIngresosCalculados).toFormattedString()}
                      </strong>
                    </div>
                  </div>

                  {/* BLOQUE 2: EGRESOS OPERATIVOS (-) */}
                  <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-red-200 dark:border-red-900/80">
                      <h3 className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4" />
                        (-) EGRESOS OPERATIVOS REALES PAGADOS
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <div
                        onClick={() => toggleSubrubro('5.1')}
                        className="text-[11px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider bg-red-100/70 dark:bg-red-950/60 hover:bg-red-200/80 dark:hover:bg-red-900/80 px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-all select-none"
                      >
                        <span className="flex items-center gap-1.5">
                          {collapsedSubrubros['5.1'] ? <ChevronRight className="w-3.5 h-3.5 text-red-700 dark:text-red-400" /> : <ChevronDown className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />}
                          5.1 EGRESOS OPERATIVOS
                        </span>
                        <strong className="font-extrabold text-xs table-cell-num text-red-900 dark:text-red-200">
                          {Money.fromAmount(totalEgresosCalculados).toFormattedString()}
                        </strong>
                      </div>
                      {!collapsedSubrubros['5.1'] && (
                        <div className="space-y-2 pt-1 pl-1">
                          {expenseAccounts.length > 0 ? (
                            expenseAccounts.map(acc => (
                              <div
                                key={acc.id}
                                onClick={() => handleNavigateToLedger(acc.code || '5.1.01')}
                                title={`Ver Libro Mayor de ${acc.name}`}
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-red-100 dark:border-red-900/40 cursor-pointer hover:border-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  {acc.code} {acc.name}
                                </span>
                                <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                  {Money.fromAmount(acc.currentBalance).toFormattedString()}
                                </strong>
                              </div>
                            ))
                          ) : (
                            <>
                              <div
                                onClick={() => handleNavigateToLedger('5.1.01')}
                                title="Ver Libro Mayor de Alquiler Residencia"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-red-100 dark:border-red-900/40 cursor-pointer hover:border-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  5.1.01 Alquiler Residencia
                                </span>
                                <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                  {Money.fromAmount(450000.00).toFormattedString()}
                                </strong>
                              </div>
                              <div
                                onClick={() => handleNavigateToLedger('5.1.02')}
                                title="Ver Libro Mayor de Supermercado e Insumos"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-red-100 dark:border-red-900/40 cursor-pointer hover:border-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  5.1.02 Supermercado e Insumos
                                </span>
                                <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                  {Money.fromAmount(125400.00).toFormattedString()}
                                </strong>
                              </div>
                              <div
                                onClick={() => handleNavigateToLedger('5.1.03')}
                                title="Ver Libro Mayor de Compra Electrodomésticos Cuota 1"
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-[#0F172A] rounded-lg text-xs border border-red-100 dark:border-red-900/40 cursor-pointer hover:border-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/50 hover:shadow-xs transition-all"
                              >
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  5.1.03 Compra Electrodomésticos Cuota 1
                                </span>
                                <strong className="font-bold text-red-600 dark:text-red-400 table-cell-num">
                                  {Money.fromAmount(85000.00).toFormattedString()}
                                </strong>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-red-200 dark:border-red-900/80 flex justify-between items-center">
                      <span className="text-xs font-bold text-red-900 dark:text-red-200 uppercase">SUBTOTAL EGRESOS</span>
                      <strong className="text-sm font-bold text-[#b54747] dark:text-red-400 table-cell-num">
                        {Money.fromAmount(totalEgresosCalculados).toFormattedString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANNER DESTACADO RESULTADO NETO DEL EJERCICIO */}
              <div className={`mt-4 p-4 rounded-xl border flex justify-between items-center ${
                resultadoNetoRealCalculado >= 0
                  ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/60'
                  : 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-blue-900 dark:text-blue-300">
                    (=) RESULTADO NETO DEL EJERCICIO (P&L)
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Diferencia entre Ingresos y Egresos reales</span>
                </div>
                <strong className="text-2xl font-bold text-[#12355b] dark:text-blue-400 table-cell-num">
                  {Money.fromAmount(resultadoNetoRealCalculado).toFormattedString()}
                </strong>
              </div>
            </section>
          )}
        </div>
      )}


      {/* SECCIÓN 3: LIBRO DIARIO (SOLO EN PESTAÑA LIBRO DIARIO) */}
      {activeSection === 'journal' && (
        <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#12355b] text-white p-2.5 rounded-xl shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172033] dark:text-white">3. Libro Diario Contable</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Asientos cronológicos de la contabilidad del hogar con partida doble</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setJournalTypeFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  journalTypeFilter === 'all'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                Todos los Asientos
              </button>
              <button
                onClick={() => setJournalTypeFilter('income')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  journalTypeFilter === 'income'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                Solo Ingresos
              </button>
              <button
                onClick={() => setJournalTypeFilter('expense')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  journalTypeFilter === 'expense'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                Solo Egresos
              </button>
              <button
                onClick={() => setJournalTypeFilter('adjustment')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  journalTypeFilter === 'adjustment'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                Solo Ajustes
              </button>
            </div>
          </div>

          <TableSearchFilter
            searchTerm={journalSearch}
            onSearchChange={setJournalSearch}
            placeholder="Buscar por N° asiento, concepto o cuenta contable..."
          />

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-[#1E293B] text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-gray-100 dark:bg-[#1E293B] z-10">N° Asiento</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Concepto / Leyenda</th>
                  <th className="py-3 px-4">Cuentas Involucradas (Debe / Haber)</th>
                  <th className="py-3 px-4 text-right">Debe ($ ARS)</th>
                  <th className="py-3 px-4 text-right">Haber ($ ARS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 text-xs">
                {filteredJournalEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">
                      No se encontraron asientos en el Libro Diario para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredJournalEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#12355b] dark:text-blue-400 whitespace-nowrap sticky left-0 bg-white dark:bg-[#0F172A] z-10">
                        {entry.id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        {entry.concept}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        {entry.lines && entry.lines.length > 0 ? (
                          <div className="space-y-1">
                            {entry.lines.filter((l: any) => Number(l.debit) > 0).map((l: any, idx: number) => (
                              <div key={`d-${idx}`} className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">DEBE</span>
                                  <span>{l.accountCode} {l.accountName}</span>
                                </div>
                                {entry.lines.length > 2 && (
                                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    ${Number(l.debit).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            ))}
                            {entry.lines.filter((l: any) => Number(l.credit) > 0).map((l: any, idx: number) => (
                              <div key={`c-${idx}`} className="font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between gap-2 pl-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">HABER</span>
                                  <span>a {l.accountCode} {l.accountName}</span>
                                </div>
                                {entry.lines.length > 2 && (
                                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                    ${Number(l.credit).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded font-bold">DEBE</span>
                              {entry.debitAccount}
                            </div>
                            <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 pl-4">
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 rounded font-bold">HABER</span>
                              a {entry.creditAccount}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 table-cell-num whitespace-nowrap">
                        {Money.fromAmount(entry.debitAmount).toFormattedString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 table-cell-num whitespace-nowrap">
                        {Money.fromAmount(entry.creditAmount).toFormattedString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-[#1E293B] font-bold text-xs border-t border-gray-300 dark:border-gray-700">
                  <td colSpan={4} className="py-3 px-4 text-gray-800 dark:text-gray-200">
                    Suma Totales Partida Doble (Cuadre Contable)
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 table-cell-num">
                    {Money.fromAmount(totalJournalDebit).toFormattedString()}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-400 table-cell-num">
                    {Money.fromAmount(totalJournalCredit).toFormattedString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* SECCIÓN 4: LIBRO MAYOR (SOLO EN PESTAÑA LIBRO MAYOR) */}
      {activeSection === 'ledger' && (
        <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#0f8a5f] text-white p-2.5 rounded-xl shadow-md">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172033] dark:text-white">4. Libro Mayor de Cuentas Contables</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Resumen agrupado por cuenta con saldo acumulado e historial de débitos/créditos</p>
              </div>
            </div>

            {/* SELECTOR DE CUENTA MAYOR */}
            <div className="w-full sm:w-72">
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Seleccionar Cuenta Contable
              </label>
              <select
                value={selectedLedgerAccount}
                onChange={(e) => setSelectedLedgerAccount(e.target.value)}
                className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none"
              >
                {ledgerAccountsList.map((acc) => (
                  <option key={acc.code} value={acc.code} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* RESUMEN DE SALDOS DE LA CUENTA SELECCIONADA */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3.5 bg-gray-50/80 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Saldo Inicial</span>
              <strong className="text-base font-bold text-gray-900 dark:text-white table-cell-num mt-1 block">
                {Money.fromAmount(currentLedgerAccount.initial).toFormattedString()}
              </strong>
            </div>

            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">Total Débitos (Debe)</span>
              <strong className="text-base font-bold text-[#0f8a5f] dark:text-emerald-400 table-cell-num mt-1 block">
                {Money.fromAmount(totalLedgerDebit).toFormattedString()}
              </strong>
            </div>

            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">Total Créditos (Haber)</span>
              <strong className="text-base font-bold text-[#12355b] dark:text-blue-400 table-cell-num mt-1 block">
                {Money.fromAmount(totalLedgerCredit).toFormattedString()}
              </strong>
            </div>

            <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl">
              <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block">Saldo Final Acumulado</span>
              <strong className="text-base font-bold text-purple-900 dark:text-purple-300 table-cell-num mt-1 block">
                {Money.fromAmount(finalLedgerBalance).toFormattedString()}
              </strong>
            </div>
          </div>

          <TableSearchFilter
            searchTerm={ledgerSearch}
            onSearchChange={setLedgerSearch}
            placeholder={`Buscar movimiento en mayor de ${currentLedgerAccount.name}...`}
          />

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-[#1E293B] text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-gray-100 dark:bg-[#1E293B] z-10">Fecha</th>
                  <th className="py-3 px-4">N° Asiento</th>
                  <th className="py-3 px-4">Concepto / Leyenda</th>
                  <th className="py-3 px-4">Contrapartida</th>
                  <th className="py-3 px-4 text-right">Debe ($ ARS)</th>
                  <th className="py-3 px-4 text-right">Haber ($ ARS)</th>
                  <th className="py-3 px-4 text-right">Saldo Acumulado ($ ARS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 text-xs">
                {ledgerMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400 font-medium">
                      No hay imputaciones registradas en el mayor para la cuenta {currentLedgerAccount.name}.
                    </td>
                  </tr>
                ) : (
                  ledgerMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {mov.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#12355b] dark:text-blue-400 whitespace-nowrap">
                        {mov.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        {mov.concept}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        {mov.contraAccount}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 table-cell-num whitespace-nowrap">
                        {mov.debit > 0 ? Money.fromAmount(mov.debit).toFormattedString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 table-cell-num whitespace-nowrap">
                        {mov.credit > 0 ? Money.fromAmount(mov.credit).toFormattedString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white table-cell-num whitespace-nowrap">
                        {Money.fromAmount(mov.runningBalance).toFormattedString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECCIÓN 5: PLAN DE CUENTAS (SOLO EN PESTAÑA PLAN DE CUENTAS) */}
      {activeSection === 'chart_of_accounts' && (
        <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#6d4db3] text-white p-2.5 rounded-xl shadow-md">
                <ListTree className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172033] dark:text-white">5. Plan de Cuentas Contables (Nomenclador)</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Estructura codificada del plan de cuentas del hogar (Activo, Pasivo, Patrimonio Neto e Imputaciones)</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const clientCodes = dbAccounts
                    .filter(a => a.code.startsWith('1.1.03.'))
                    .map(a => parseInt(a.code.replace('1.1.03.', '')) || 0);
                  const nextNum = (clientCodes.length > 0 ? Math.max(...clientCodes) : 0) + 1;
                  setNewAccountCode(`1.1.03.${String(nextNum).padStart(2, '0')}`);
                  setNewAccountName('Cuentas por Cobrar - Cliente ');
                  setNewAccountGroup('activo');
                  setNewAccountSubrubro('Activo Corriente');
                  setIsAddAccountModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Subcuenta Cliente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const supplierCodes = dbAccounts
                    .filter(a => a.code.startsWith('2.1.01.'))
                    .map(a => parseInt(a.code.replace('2.1.01.', '')) || 0);
                  const nextNum = (supplierCodes.length > 0 ? Math.max(...supplierCodes) : 0) + 1;
                  setNewAccountCode(`2.1.01.${String(nextNum).padStart(2, '0')}`);
                  setNewAccountName('Cuentas por Pagar - Proveedor ');
                  setNewAccountGroup('pasivo');
                  setNewAccountSubrubro('Pasivo Corriente');
                  setIsAddAccountModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Subcuenta Proveedor</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(true)}
                className="flex items-center gap-1.5 bg-[#6d4db3] hover:bg-[#5b3da0] text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva Cuenta</span>
              </button>
            </div>
          </div>

          {/* FILTROS POR GRUPO CONTABLE */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCoaGroupFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'all'
                    ? 'bg-[#12355b] dark:bg-[#0088FF] text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                Todas las Cuentas
              </button>
              <button
                type="button"
                onClick={() => setCoaGroupFilter('activo')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'activo'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                1. Activos
              </button>
              <button
                type="button"
                onClick={() => setCoaGroupFilter('pasivo')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'pasivo'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                2. Pasivos
              </button>
              <button
                type="button"
                onClick={() => setCoaGroupFilter('patrimonio')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'patrimonio'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                3. Patrimonio
              </button>
              <button
                type="button"
                onClick={() => setCoaGroupFilter('ingreso')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'ingreso'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                4. Ingresos
              </button>
              <button
                type="button"
                onClick={() => setCoaGroupFilter('egreso')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  coaGroupFilter === 'egreso'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1E293B] text-gray-700 dark:text-gray-300'
                }`}
              >
                5. Egresos
              </button>
            </div>
          </div>

          <TableSearchFilter
            searchTerm={coaSearch}
            onSearchChange={setCoaSearch}
            placeholder="Buscar por código (ej: 1.1.01) o nombre de la cuenta..."
          />

          {/* FORMULARIO AGREGAR CUENTA CONTABLE */}
          {isAddAccountModalOpen && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAccountCode.trim() || !newAccountName.trim()) return;

                const kindMap: Record<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'> = {
                  activo: 'asset',
                  pasivo: 'liability',
                  patrimonio: 'equity',
                  ingreso: 'income',
                  egreso: 'expense'
                };

                const natureMap: Record<string, 'debit' | 'credit'> = {
                  asset: 'debit',
                  expense: 'debit',
                  liability: 'credit',
                  equity: 'credit',
                  income: 'credit'
                };

                const selectedKind = kindMap[newAccountGroup] || 'asset';

                try {
                  const created = await accountingRepo.createAccount({
                    personaPadreId: 1,
                    code: newAccountCode.trim(),
                    name: newAccountName.trim(),
                    kind: selectedKind,
                    nature: natureMap[selectedKind] || 'debit',
                    subrubro: newAccountSubrubro,
                    openingBalance: 0,
                    currentBalance: 0,
                    color: '#3B82F6',
                    isArchived: false
                  });

                  setDbAccounts(prev => [...prev, created]);
                  setIsAddAccountModalOpen(false);
                  setNewAccountCode('');
                  setNewAccountName('');
                } catch (err) {
                  console.error('Error guardando cuenta contable:', err);
                }
              }}
              className="p-4 bg-gray-50 dark:bg-[#1E293B]/80 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3"
            >
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Nueva Cuenta en Plan de Cuentas (Supabase)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Código Nomenclador (Ej: 1.1.04)"
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                  className="text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre de la Cuenta"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none"
                />
                <select
                  value={newAccountGroup}
                  onChange={(e) => {
                    const group = e.target.value as any;
                    setNewAccountGroup(group);
                    if (group === 'activo') setNewAccountSubrubro('Activo Corriente');
                    else if (group === 'pasivo') setNewAccountSubrubro('Pasivo Corriente');
                    else if (group === 'patrimonio') setNewAccountSubrubro('Patrimonio Neto');
                    else if (group === 'ingreso') setNewAccountSubrubro('Ingresos Operativos');
                    else if (group === 'egreso') setNewAccountSubrubro('Egresos Operativos');
                  }}
                  className="text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none"
                >
                  <option value="activo">1. Activo</option>
                  <option value="pasivo">2. Pasivo</option>
                  <option value="patrimonio">3. Patrimonio Neto</option>
                  <option value="ingreso">4. Ingreso</option>
                  <option value="egreso">5. Egreso</option>
                </select>
                <select
                  value={newAccountSubrubro}
                  onChange={(e) => setNewAccountSubrubro(e.target.value)}
                  className="text-xs font-semibold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none"
                >
                  <option value="Activo Corriente">Activo Corriente</option>
                  <option value="Activo No Corriente">Activo No Corriente</option>
                  <option value="Pasivo Corriente">Pasivo Corriente</option>
                  <option value="Pasivo No Corriente">Pasivo No Corriente</option>
                  <option value="Patrimonio Neto">Patrimonio Neto</option>
                  <option value="Ingresos Operativos">Ingresos Operativos</option>
                  <option value="Egresos Operativos">Egresos Operativos</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#6d4db3] hover:bg-[#5b3da0] rounded-lg shadow-sm"
                >
                  Guardar Cuenta en Supabase
                </button>
              </div>
            </form>
          )}

          {/* TABLA PLAN DE CUENTAS */}
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-[#1E293B] text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-gray-100 dark:bg-[#1E293B] z-10">Código</th>
                  <th className="py-3 px-4">Nombre de la Cuenta Contable</th>
                  <th className="py-3 px-4">Subrubro / Clasificación</th>
                  <th className="py-3 px-4">Rubro / Grupo</th>
                  <th className="py-3 px-4">Naturaleza del Saldo</th>
                  <th className="py-3 px-4 text-right">Saldo Vivo Actual ($ ARS)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 text-xs">
                {dbAccounts
                  .filter(acc => coaGroupFilter === 'all' || 
                    (coaGroupFilter === 'activo' && acc.kind === 'asset') ||
                    (coaGroupFilter === 'pasivo' && acc.kind === 'liability') ||
                    (coaGroupFilter === 'patrimonio' && acc.kind === 'equity') ||
                    (coaGroupFilter === 'ingreso' && acc.kind === 'income') ||
                    (coaGroupFilter === 'egreso' && acc.kind === 'expense')
                  )
                  .filter(acc => acc.code.toLowerCase().includes(coaSearch.toLowerCase()) || acc.name.toLowerCase().includes(coaSearch.toLowerCase()))
                  .map((acc) => {
                    const hasMovements = (Math.abs(acc.openingBalance || 0) > 0) ||
                      (Math.abs(acc.currentBalance || 0) > 0) ||
                      dbEntries.some(entry => entry.lines && entry.lines.some((l: any) => l.accountId === acc.id || l.accountCode === acc.code));

                    const groupLabel = acc.kind === 'asset' ? 'activo'
                      : acc.kind === 'liability' ? 'pasivo'
                      : acc.kind === 'equity' ? 'patrimonio'
                      : acc.kind === 'income' ? 'ingreso' : 'egreso';

                    return (
                      <tr
                        key={acc.id}
                        className="hover:bg-blue-50/60 dark:hover:bg-blue-950/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#12355b] dark:text-blue-400 whitespace-nowrap sticky left-0 bg-white dark:bg-[#0F172A] z-10">
                          {acc.code}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          {acc.name}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {acc.subrubro || 'General'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            groupLabel === 'activo' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' :
                            groupLabel === 'pasivo' ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300' :
                            groupLabel === 'patrimonio' ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300' :
                            groupLabel === 'ingreso' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' :
                            'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}>
                            {groupLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-600 dark:text-gray-300">
                          {acc.nature === 'debit' ? 'Deudor (+)' : 'Acreedor (-)'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-sm table-cell-num whitespace-nowrap text-gray-900 dark:text-white">
                          {Money.fromAmount(acc.currentBalance).toFormattedString()}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            Activa Imputable
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* VER MAYOR / DETALLE */}
                            <button
                              type="button"
                              onClick={() => handleNavigateToLedger(acc.code)}
                              title={`Ver Libro Mayor y Detalle de ${acc.name}`}
                              className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-all cursor-pointer"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>

                            {/* EDITAR CUENTA */}
                            <button
                              type="button"
                              onClick={() => setEditingAccount(acc)}
                              title={`Editar Cuenta ${acc.name}`}
                              className="p-1.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg transition-all cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* ELIMINAR CUENTA (BLOQUEADO SI TIENE MOVIMIENTOS) */}
                            {hasMovements ? (
                              <button
                                type="button"
                                disabled
                                title="No se puede eliminar: la cuenta registra saldo o movimientos contables."
                                className="p-1.5 text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-lg opacity-40 cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingAccount(acc)}
                                title={`Eliminar Cuenta ${acc.name}`}
                                className="p-1.5 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

      {/* MODAL EDITAR CUENTA CONTABLE */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 flex flex-col">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
              <Pencil className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Editar Cuenta Contable</span>
            </h3>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const updated = await accountingRepo.updateAccount(editingAccount);
                  setDbAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
                  setEditingAccount(null);
                } catch (err: any) {
                  alert(err.message || 'Error al actualizar cuenta contable');
                }
              }}
              className="space-y-3 flex-1"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Código Nomenclador</label>
                <input
                  type="text"
                  required
                  value={editingAccount.code}
                  onChange={(e) => setEditingAccount({ ...editingAccount, code: e.target.value })}
                  className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre de la Cuenta</label>
                <input
                  type="text"
                  required
                  value={editingAccount.name}
                  onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Subrubro / Clasificación</label>
                <input
                  type="text"
                  required
                  value={editingAccount.subrubro || ''}
                  onChange={(e) => setEditingAccount({ ...editingAccount, subrubro: e.target.value })}
                  className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Naturaleza del Saldo</label>
                <select
                  value={editingAccount.nature}
                  onChange={(e) => setEditingAccount({ ...editingAccount, nature: e.target.value as 'debit' | 'credit' })}
                  className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                >
                  <option value="debit">Deudor (+)</option>
                  <option value="credit">Acreedor (-)</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-2 pt-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer text-center"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR CUENTA CONTABLE */}
      {deletingAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Eliminar Cuenta Contable
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              ¿Confirma eliminar la cuenta contable <strong className="text-gray-900 dark:text-white">{deletingAccount.code} - {deletingAccount.name}</strong>?
            </p>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-semibold">
              Esta cuenta no registra saldos ni movimientos contables. Se desactivará del Plan de Cuentas.
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await accountingRepo.deleteAccount(1, deletingAccount.id);
                    setDbAccounts(prev => prev.filter(a => a.id !== deletingAccount.id));
                    setDeletingAccount(null);
                  } catch (err: any) {
                    alert(err.message || 'Error al eliminar cuenta contable');
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer text-center"
              >
                Eliminar Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

        </section>
      )}

      {/* SECCIÓN 6: PROYECCIÓN DINÁMICA & FLUJO DE CAJA */}
      {activeSection === 'proyeccion' && nodes && months && selectedMethods && onMethodChange && onOpeningBalanceChange && (
        <ProjectionTable
          nodes={nodes}
          months={months}
          selectedMethods={selectedMethods}
          onMethodChange={onMethodChange}
          openingBalance={openingBalance ?? 0}
          onOpeningBalanceChange={onOpeningBalanceChange}
        />
      )}

      {/* MODAL DE REVALUACIÓN DE ACTIVOS Y RESULTADOS POR TENENCIA (RxT) */}
      <RxTRevaluationModal
        isOpen={isRxTModalOpen}
        onClose={() => setIsRxTModalOpen(false)}
        accounts={dbAccounts}
        onSuccess={() => {
          Promise.all([
            accountingRepo.getAccounts(1),
            accountingRepo.getJournalEntries(1)
          ]).then(([accs, entries]) => {
            setDbAccounts(accs);
            setDbEntries(entries);
          });
        }}
      />
    </div>
  );
};

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
