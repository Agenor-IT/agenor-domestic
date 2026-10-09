import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import { TableSearchFilter } from './TableSearchFilter';
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Home,
  Briefcase,
  Sparkles,
  DollarSign,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  X,
  Loader2,
  PowerOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  SupabaseDomExpenseRepository,
  PaginatedExpensesResult
} from '../../infrastructure/SupabaseDomExpenseRepository';
import { DomExpenseDTO, ExpenseSourceType, ExpenseNatureType, ExpensePaymentCondition } from '../../domain/expenses/DomExpense';
import { DomExpenseReceipt } from '../../domain/expenses/DomExpenseReceipt';
import { LocalDomExpenseReceiptRepository } from '../../infrastructure/LocalDomExpenseReceiptRepository';
import { Money } from '../../domain/shared/Money';
import { INITIAL_MONTHS } from '../../domain/shared/initialSeedData';

const EXPENSE_SOURCE_TYPES: { id: ExpenseSourceType; label: string; icon: any }[] = [
  { id: 'domestico', label: 'Doméstico', icon: Home },
  { id: 'emprendimiento', label: 'Emprendimiento', icon: Briefcase },
  { id: 'extraordinario', label: 'Extraordinario', icon: Sparkles }
];

const EXPENSE_CATEGORIES = [
  'Servicios',
  'Alimentación & Hogar',
  'Familia & Hijos',
  'Salud',
  'Software & Infraestructura',
  'Conectividad',
  'Impuestos',
  'Mantenimiento & Reparación',
  'Varios'
];

interface ExpensesPanelProps {
  onExpensesChange?: () => void;
}

export const ExpensesPanel: React.FC<ExpensesPanelProps> = ({ onExpensesChange }) => {
  const [paginatedData, setPaginatedData] = useState<PaginatedExpensesResult | null>(null);
  const [allExpenses, setAllExpenses] = useState<DomExpenseDTO[]>([]);
  const [expenseReceipts, setExpenseReceipts] = useState<DomExpenseReceipt[]>([]);
  const [tableView, setTableView] = useState<'mensual' | 'comprobantes'>('mensual');
  const [receiptRowFilter, setReceiptRowFilter] = useState<{ category: string; supplierName: string } | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<DomExpenseReceipt | null>(null);
  const [receiptExpenseId, setReceiptExpenseId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [receiptCondition, setReceiptCondition] = useState<ExpensePaymentCondition>('cuenta_corriente');
  const [receiptDueDate, setReceiptDueDate] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeSourceTab, setActiveSourceTab] = useState<'todos' | ExpenseSourceType>('todos');
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('activo');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'nuevo' | 'editar' | 'ver'>('nuevo');
  const [editingExpense, setEditingExpense] = useState<DomExpenseDTO | null>(null);

  // Form State
  const [supplierName, setSupplierName] = useState<string>('');
  const [counterparties, setCounterparties] = useState<string[]>([]);
  const [counterpartyQuery, setCounterpartyQuery] = useState<string>('');
  const [isCounterpartyListOpen, setIsCounterpartyListOpen] = useState<boolean>(false);
  const [concept, setConcept] = useState<string>('');
  const [sourceType, setSourceType] = useState<ExpenseSourceType>('domestico');
  const [expenseType, setExpenseType] = useState<ExpenseNatureType>('fijo');
  const [category, setCategory] = useState<string>('Servicios');
  const [status, setStatus] = useState<'activo' | 'en_negociacion' | 'finalizado' | 'pausado'>('activo');
  const [baseMonthlyAmount, setBaseMonthlyAmount] = useState<number>(50000);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'cash' | 'card' | 'debit'>('card');
  const [paymentCondition, setPaymentCondition] = useState<ExpensePaymentCondition>('contado');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const repository = useMemo(() => new SupabaseDomExpenseRepository(), []);
  const receiptRepository = useMemo(() => new LocalDomExpenseReceiptRepository(), []);
  const counterpartiesStorageKey = 'dom_expense_counterparties_1';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(counterpartiesStorageKey) || '[]');
      if (Array.isArray(saved)) setCounterparties(saved.filter((item): item is string => typeof item === 'string'));
    } catch {
      setCounterparties([]);
    }
  }, []);

  const availableCounterparties = useMemo(() => {
    const names = new Set(counterparties);
    (paginatedData?.items || []).forEach(item => {
      if (item.supplierName?.trim()) names.add(item.supplierName.trim());
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [counterparties, paginatedData?.items]);

  const filteredCounterparties = useMemo(() => {
    const query = counterpartyQuery.trim().toLocaleLowerCase('es');
    return availableCounterparties.filter(name => name.toLocaleLowerCase('es').includes(query));
  }, [availableCounterparties, counterpartyQuery]);

  const saveCounterparty = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setSupplierName(cleanName);
    setCounterpartyQuery(cleanName);
    setIsCounterpartyListOpen(false);
    if (!availableCounterparties.some(item => item.localeCompare(cleanName, 'es', { sensitivity: 'base' }) === 0)) {
      const updated = [...counterparties, cleanName].sort((a, b) => a.localeCompare(b, 'es'));
      setCounterparties(updated);
      localStorage.setItem(counterpartiesStorageKey, JSON.stringify(updated));
    }
  };

  // Debounce para búsqueda en backend (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repository.getPaginatedExpenses({
        personaPadreId: 1,
        page: currentPage,
        pageSize,
        search: debouncedSearch,
        sourceType: activeSourceTab,
        expenseType: selectedExpenseType,
        status: selectedStatus,
        orderBy: sortField,
        orderDir: sortDirection
      });
      setPaginatedData(res);
      onExpensesChange?.();
    } catch (err) {
      console.error('Error al cargar egresos paginados:', err);
    } finally {
      setLoading(false);
    }
  }, [repository, currentPage, pageSize, debouncedSearch, activeSourceTab, selectedExpenseType, selectedStatus, sortField, sortDirection, onExpensesChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejo de ordenamiento desde las columnas
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      if (field === 'base_monthly_amount' || field === 'projection') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
    setCurrentPage(1);
  };

  const filteredAllExpenses = useMemo(() => allExpenses.filter(expense => {
    const search = debouncedSearch.trim().toLocaleLowerCase('es');
    const matchesSearch = !search || [expense.supplierName, expense.concept, expense.category]
      .some(value => value.toLocaleLowerCase('es').includes(search));
    const matchesSource = activeSourceTab === 'todos' || expense.sourceType === activeSourceTab;
    const matchesType = selectedExpenseType === 'todos' || expense.expenseType === selectedExpenseType;
    const matchesStatus = selectedStatus === 'todos' || expense.status === selectedStatus;
    return matchesSearch && matchesSource && matchesType && matchesStatus;
  }), [allExpenses, debouncedSearch, activeSourceTab, selectedExpenseType, selectedStatus]);

  const expenseMonths = useMemo(() => {
    const months = new Set(['2026-08', '2026-09', '2026-10']);
    filteredAllExpenses.forEach(expense => {
      if (expense.dueDate) {
        months.add(expense.dueDate.slice(0, 7));
      }
    });
    expenseReceipts.forEach(receipt => {
      if (filteredAllExpenses.some(expense => expense.id === receipt.expenseId)) {
        months.add((receipt.dueDate || receipt.createdAt).slice(0, 7));
      }
    });
    const sortedMonths = [...months].sort();
    return sortedMonths.map(month => ({
      key: month,
      label: `${month.slice(5, 7)}/${month.slice(2, 4)}`
    }));
  }, [filteredAllExpenses, expenseReceipts]);

  const monthlyExpenseRows = useMemo(() => {
    const rows = new Map<string, { expenseId: string; supplierName: string; category: string; sourceType: ExpenseSourceType; amounts: Record<string, number> }>();
    filteredAllExpenses.forEach(expense => {
      const key = `${expense.supplierName.trim().toLocaleLowerCase('es')}|${expense.category.toLocaleLowerCase('es')}`;
      const row = rows.get(key) || {
        expenseId: expense.id,
        supplierName: expense.supplierName,
        category: expense.category,
        sourceType: expense.sourceType || 'domestico',
        amounts: {}
      };
      // Todas las categorías conservan su fila; sólo comprobantes Cta Cte cargados llenan celdas.
      if (expense.dueDate) {
        const month = expense.dueDate.slice(0, 7);
        row.amounts[month] = (row.amounts[month] || 0) + expense.baseMonthlyAmount;
      }
      rows.set(key, row);
    });
    expenseReceipts.forEach(receipt => {
      const expense = filteredAllExpenses.find(item => item.id === receipt.expenseId);
      if (!expense) return;
      const key = `${expense.supplierName.trim().toLocaleLowerCase('es')}|${expense.category.toLocaleLowerCase('es')}`;
      const row = rows.get(key);
      if (!row) return;
      const month = (receipt.dueDate || receipt.createdAt).slice(0, 7);
      row.amounts[month] = (row.amounts[month] || 0) + receipt.amount;
    });
    return [...rows.values()].sort((a, b) => {
      const comparison = `${a.category}|${a.supplierName}`.localeCompare(`${b.category}|${b.supplierName}`, 'es');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredAllExpenses, expenseReceipts, sortDirection]);

  const registeredReceipts = useMemo(() => expenseReceipts
    .filter(receipt => {
      const expense = filteredAllExpenses.find(item => item.id === receipt.expenseId);
      if (!expense) return false;
      return !receiptRowFilter || (
        expense.category.trim().toLocaleLowerCase('es') === receiptRowFilter.category.trim().toLocaleLowerCase('es') &&
        expense.supplierName.trim().toLocaleLowerCase('es') === receiptRowFilter.supplierName.trim().toLocaleLowerCase('es')
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [expenseReceipts, filteredAllExpenses, receiptRowFilter]);

  const loadAllExpenses = useCallback(async () => {
    setAllExpenses(await repository.getAllExpenses(1));
  }, [repository]);

  useEffect(() => {
    loadAllExpenses();
  }, [loadAllExpenses]);

  useEffect(() => {
    setExpenseReceipts(receiptRepository.list(1));
  }, [receiptRepository]);

  // KPIs desde resumen global calculado por el servidor RPC
  const activeExpensesCount = paginatedData?.summary.activeCount ?? 0;
  const totalExpensesCount = paginatedData?.summary.totalCount ?? 0;
  const totalDomesticMonthly = paginatedData?.summary.totalDomesticMonthly ?? 0;
  const totalBusinessMonthly = paginatedData?.summary.totalBusinessMonthly ?? 0;
  const totalMonthlyAll = paginatedData?.summary.totalMonthlyAll ?? 0;

  const tabCounts = paginatedData?.tabCounts ?? {
    todos: 0,
    domestico: 0,
    emprendimiento: 0,
    extraordinario: 0
  };

  const totalPages = tableView === 'comprobantes'
    ? Math.max(1, Math.ceil(registeredReceipts.length / pageSize))
    : paginatedData?.totalPages ?? 1;
  const totalCount = tableView === 'comprobantes'
    ? registeredReceipts.length
    : paginatedData?.totalCount ?? 0;

  const handleOpenNewReceipt = (expenseId = '') => {
    setEditingReceipt(null);
    setReceiptExpenseId(expenseId);
    setReceiptAmount(allExpenses.find(expense => expense.id === expenseId)?.baseMonthlyAmount || 0);
    setReceiptCondition('cuenta_corriente');
    setReceiptDueDate('');
    setReceiptNotes('');
    setIsReceiptModalOpen(true);
  };

  const handleShowRowReceipts = (category: string, supplierName: string) => {
    setReceiptRowFilter({ category, supplierName });
    setTableView('comprobantes');
    setCurrentPage(1);
  };

  const handleOpenEditReceipt = (receipt: DomExpenseReceipt) => {
    setEditingReceipt(receipt);
    setReceiptExpenseId(receipt.expenseId);
    setReceiptAmount(receipt.amount);
    setReceiptCondition(receipt.paymentCondition);
    setReceiptDueDate(receipt.dueDate || '');
    setReceiptNotes(receipt.notes || '');
    setIsReceiptModalOpen(true);
  };

  const handleSaveReceipt = (event: React.FormEvent) => {
    event.preventDefault();
    if (!allExpenses.some(expense => expense.id === receiptExpenseId)) {
      setFeedback({ text: 'Seleccione la fila de gasto a la que corresponde el comprobante.', type: 'error' });
      return;
    }
    if (!Number.isFinite(receiptAmount) || receiptAmount <= 0) {
      setFeedback({ text: 'Ingrese un importe mayor que cero.', type: 'error' });
      return;
    }
    if (receiptCondition === 'cuenta_corriente' && !receiptDueDate) {
      setFeedback({ text: 'Ingrese la fecha de vencimiento del comprobante.', type: 'error' });
      return;
    }
    try {
      receiptRepository.save({
        id: editingReceipt?.id,
        createdAt: editingReceipt?.createdAt,
        personaPadreId: 1,
        expenseId: receiptExpenseId,
        amount: receiptAmount,
        paymentCondition: receiptCondition,
        dueDate: receiptCondition === 'cuenta_corriente' ? receiptDueDate : undefined,
        notes: receiptNotes
      });
      setExpenseReceipts(receiptRepository.list(1));
      setCurrentPage(1);
      setIsReceiptModalOpen(false);
      setFeedback({ text: 'Comprobante guardado en esta instalación.', type: 'success' });
    } catch {
      setFeedback({ text: 'No se pudo guardar el comprobante localmente.', type: 'error' });
    }
  };

  const handleDeleteReceipt = (receipt: DomExpenseReceipt) => {
    if (!window.confirm('¿Está seguro de eliminar este comprobante?')) return;
    receiptRepository.delete(receipt.id, receipt.personaPadreId);
    setExpenseReceipts(receiptRepository.list(1));
    setCurrentPage(1);
    setFeedback({ text: 'Comprobante eliminado.', type: 'success' });
  };

  // Handlers Modal Form
  const handleOpenNewModal = () => {
    setModalMode('nuevo');
    setEditingExpense(null);
    setSupplierName('');
    setCounterpartyQuery('');
    setIsCounterpartyListOpen(false);
    setConcept('');
    setSourceType(activeSourceTab !== 'todos' ? activeSourceTab : 'domestico');
    setCategory('Servicios');
    setStatus('activo');
    setExpenseType('fijo');
    setBaseMonthlyAmount(50000);
    setDefaultPaymentMethod('card');
    setPaymentCondition('contado');
    setDueDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: DomExpenseDTO) => {
    setModalMode('editar');
    setEditingExpense(e);
    setSupplierName(e.supplierName);
    setCounterpartyQuery(e.supplierName);
    setIsCounterpartyListOpen(false);
    setConcept(e.concept);
    setSourceType(e.sourceType || 'domestico');
    setCategory(e.category);
    setStatus(e.status);
    setExpenseType(e.expenseType || 'fijo');
    setBaseMonthlyAmount(e.baseMonthlyAmount);
    setDefaultPaymentMethod(e.defaultPaymentMethod);
    setPaymentCondition(e.paymentCondition || 'contado');
    setDueDate(e.dueDate || '');
    setNotes(e.notes || '');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (e: DomExpenseDTO) => {
    setModalMode('ver');
    setEditingExpense(e);
    setSupplierName(e.supplierName);
    setCounterpartyQuery(e.supplierName);
    setIsCounterpartyListOpen(false);
    setConcept(e.concept);
    setSourceType(e.sourceType || 'domestico');
    setCategory(e.category);
    setStatus(e.status);
    setExpenseType(e.expenseType || 'fijo');
    setBaseMonthlyAmount(e.baseMonthlyAmount);
    setDefaultPaymentMethod(e.defaultPaymentMethod);
    setPaymentCondition(e.paymentCondition || 'contado');
    setDueDate(e.dueDate || '');
    setNotes(e.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      setFeedback({ text: 'Por favor complete el nombre del proveedor o beneficiario.', type: 'error' });
      return;
    }
    if (paymentCondition === 'cuenta_corriente' && (!dueDate || dueDate <= new Date().toISOString().slice(0, 10))) {
      setFeedback({ text: 'La fecha de vencimiento de una factura en Cta Cte debe ser futura.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const projections: Record<string, number> = paymentCondition === 'cuenta_corriente'
        ? {}
        : { ...editingExpense?.monthlyProjections };
      if (paymentCondition === 'contado') {
        INITIAL_MONTHS.forEach(m => {
          if (projections[m] === undefined) projections[m] = baseMonthlyAmount;
        });
      }

      const payload: Partial<DomExpenseDTO> = {
        id: editingExpense?.id,
        supplierName,
        concept: concept || 'Gasto / Servicio',
        category,
        sourceType,
        expenseType,
        status,
        baseMonthlyAmount,
        monthlyProjections: projections,
        defaultPaymentMethod,
        paymentCondition,
        dueDate: paymentCondition === 'cuenta_corriente' ? dueDate : undefined,
        notes
      };

      const savedExpense = await repository.saveExpense(payload, 1);
      setFeedback({
        text: `Egreso ${modalMode === 'nuevo' ? 'creado' : 'actualizado'} con éxito.`,
        type: 'success'
      });
      setIsModalOpen(false);
      await loadData();
      await loadAllExpenses();
      setAllExpenses(current => [savedExpense, ...current.filter(item => item.id !== savedExpense.id)]);
    } catch (err) {
      setFeedback({ text: 'Error al guardar el egreso.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (expenseReceipts.some(receipt => receipt.expenseId === id)) {
      setFeedback({ text: 'Este gasto tiene comprobantes asociados. Elimínelos primero.', type: 'error' });
      return;
    }
    if (!window.confirm(`¿Está seguro de eliminar el registro "${name}"?`)) return;

    try {
      await repository.deleteExpense(id, 1);
      setFeedback({ text: 'Registro eliminado correctamente.', type: 'success' });
      await loadData();
      await loadAllExpenses();
    } catch (err) {
      setFeedback({ text: 'Error al eliminar el registro.', type: 'error' });
    }
  };

  const handleToggleStatus = async (e: DomExpenseDTO) => {
    const nextStatus = e.status === 'activo' ? 'pausado' : 'activo';
    try {
      await repository.saveExpense({
        ...e,
        status: nextStatus
      }, 1);
      setFeedback({
        text: `Egreso "${e.supplierName}" ${nextStatus === 'activo' ? 'activado' : 'desactivado'} correctamente.`,
        type: 'success'
      });
      await loadData();
      await loadAllExpenses();
    } catch (err) {
      setFeedback({ text: 'Error al cambiar estado del egreso.', type: 'error' });
    }
  };

  // Badges
  const getSourceBadge = (type: ExpenseSourceType) => {
    switch (type) {
      case 'domestico':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Home className="w-3 h-3" /> Doméstico
          </span>
        );
      case 'extraordinario':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3 h-3" /> Extraordinario
          </span>
        );
      case 'emprendimiento':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Briefcase className="w-3 h-3" /> Emprendimiento
          </span>
        );
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'activo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Activo
          </span>
        );
      case 'en_negociacion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> En Revisión
          </span>
        );
      case 'pausado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <PauseCircle className="w-3 h-3" /> Pausado
          </span>
        );
      case 'finalizado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <XCircle className="w-3 h-3" /> Finalizado
          </span>
        );
      default:
        return null;
    }
  };

  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity ml-1.5 shrink-0 inline-block" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 ml-1.5 shrink-0 inline-block" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 ml-1.5 shrink-0 inline-block" />
    );
  };

  return (
    <div className="space-y-6">
      {/* FEEDBACK TOAST */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-rose-500 text-white shadow-rose-500/20'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/10 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Egresos Activos
            </span>
            <div className="p-2.5 bg-blue-500/10 text-[#0088FF] rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white table-cell-num">
              {activeExpensesCount}
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              de {totalExpensesCount} totales
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Egresos Domésticos
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Home className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 table-cell-num">
              {Money.fromAmount(totalDomesticMonthly).toFormattedString()}
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Gastos Emprendimiento
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 table-cell-num">
              {Money.fromAmount(totalBusinessMonthly).toFormattedString()}
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Egreso Total Actual
            </span>
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 table-cell-num">
              {Money.fromAmount(totalMonthlyAll).toFormattedString()}
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: BUSQUEDA, FILTROS Y TABLA */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* SEGMENTED TAB SELECTOR: TODOS / DOMÉSTICOS / EMPRENDIMIENTO / EXTRAORDINARIOS */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            <button
              onClick={() => { setActiveSourceTab('todos'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeSourceTab === 'todos'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todos los Egresos ({tabCounts.todos})
            </button>
            <button
              onClick={() => { setActiveSourceTab('domestico'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeSourceTab === 'domestico'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              Domésticos ({tabCounts.domestico})
            </button>
            <button
              onClick={() => { setActiveSourceTab('emprendimiento'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeSourceTab === 'emprendimiento'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              Emprendimiento ({tabCounts.emprendimiento})
            </button>
            <button
              onClick={() => { setActiveSourceTab('extraordinario'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeSourceTab === 'extraordinario'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Extraordinarios ({tabCounts.extraordinario})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewModal}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold cursor-pointer"
            >
              Nuevo gasto
            </button>
            <button
              onClick={() => handleOpenNewReceipt()}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo comprobante
            </button>
          </div>
        </div>

        {/* FILTROS SECUNDARIOS Y BUSCADOR */}
        <TableSearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Buscar por proveedor, concepto o categoría de egreso..."
          extraControls={
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Tipo Fijo/Proyectado */}
              <select
                value={selectedExpenseType}
                onChange={e => setSelectedExpenseType(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 outline-none cursor-pointer"
              >
                <option value="todos">Modalidad: Todas</option>
                <option value="fijo">Solo Fijos</option>
                <option value="proyectado">Solo Proyectados</option>
              </select>

              {/* Estado Filter */}
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 outline-none cursor-pointer"
              >
                <option value="activo">Solo Activos (Por defecto)</option>
                <option value="todos">Estado: Todos</option>
                <option value="pausado">Inactivos / Pausados</option>
                <option value="en_negociacion">En Revisión</option>
                <option value="finalizado">Finalizados</option>
              </select>
            </div>
          }
        />

        <div className="px-6 pt-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Vista de egresos</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {tableView === 'mensual'
                ? 'Comprobantes cargados por categoría y contraparte, agrupados por vencimiento. Sin proyecciones.'
                : 'Comprobantes ordenados desde el más reciente.'}
            </p>
            {tableView === 'comprobantes' && receiptRowFilter && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span>Filtrado: {receiptRowFilter.category} / {receiptRowFilter.supplierName}</span>
                <button type="button" onClick={() => { setReceiptRowFilter(null); setCurrentPage(1); }} className="font-bold text-rose-600 dark:text-rose-400 underline">Mostrar todos</button>
              </div>
            )}
          </div>
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => { setTableView('mensual'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${tableView === 'mensual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Vista mensual
            </button>
            <button
              type="button"
              onClick={() => { setReceiptRowFilter(null); setTableView('comprobantes'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${tableView === 'comprobantes' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Comprobantes
            </button>
          </div>
        </div>

        {/* TABLA DE EGRESOS */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <span className="text-xs font-bold text-gray-500">Cargando egresos...</span>
            </div>
          ) : (
            tableView === 'mensual' ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">TIPO</th>
                      <th onClick={() => handleSort('supplier_name')} className="py-3 px-4 cursor-pointer select-none group">CATEGORÍA / PROVEEDOR{renderSortIndicator('supplier_name')}</th>
                      {expenseMonths.map(month => <th key={month.key} className="py-3 px-4 text-right">{month.label}</th>)}
                      <th className="py-3 px-4 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {monthlyExpenseRows.map(row => (
                      <tr key={`${row.category.toLocaleLowerCase('es')}|${row.supplierName.toLocaleLowerCase('es')}`} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-3.5 px-4">{getSourceBadge(row.sourceType)}</td>
                        <td className="py-3.5 px-4">
                          <span className="block font-bold text-gray-900 dark:text-gray-100">{row.category}</span>
                          <span className="block mt-1 text-gray-500 dark:text-gray-400">{row.supplierName}</span>
                        </td>
                        {expenseMonths.map(month => (
                          <td key={month.key} className="py-3.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400 table-cell-num">
                            {row.amounts[month.key] ? Money.fromAmount(row.amounts[month.key]).toFormattedString() : '—'}
                          </td>
                        ))}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => handleShowRowReceipts(row.category, row.supplierName)} className="p-1.5 text-emerald-600 dark:text-emerald-400 rounded-lg" title={`Ver comprobantes de ${row.category} / ${row.supplierName}`} aria-label={`Ver comprobantes de ${row.category} / ${row.supplierName}`}><Eye className="w-4 h-4" /></button>
                            <button type="button" onClick={() => {
                              const expense = allExpenses.find(item => item.id === row.expenseId);
                              if (expense) handleOpenEditModal(expense);
                            }} className="p-1.5 text-blue-500 rounded-lg" title="Editar fila de gasto"><Pencil className="w-4 h-4" /></button>
                            <button type="button" onClick={() => {
                              const expense = allExpenses.find(item => item.id === row.expenseId);
                              if (expense) handleOpenViewModal(expense);
                            }} className="p-1.5 text-gray-500 rounded-lg" title="Ver fila de gasto"><Eye className="w-4 h-4" /></button>
                            <button type="button" onClick={() => {
                              const expense = allExpenses.find(item => item.id === row.expenseId);
                              if (expense) handleToggleStatus(expense);
                            }} className="p-1.5 rounded-lg" title="Cambiar estado">
                              {getStatusBadge(allExpenses.find(item => item.id === row.expenseId)?.status || '')}
                            </button>
                            <button type="button" onClick={() => {
                              const expense = allExpenses.find(item => item.id === row.expenseId);
                              if (expense) handleDelete(expense.id, expense.supplierName);
                            }} className="p-1.5 text-red-500 rounded-lg" title="Eliminar fila de gasto"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {monthlyExpenseRows.length === 0 && (
                      <tr><td colSpan={3 + expenseMonths.length} className="text-center py-12 text-gray-400 font-medium">No se encontraron gastos para estos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">FECHA DE ALTA</th>
                    <th className="py-3 px-4">PROVEEDOR / BENEFICIARIO</th>
                    <th className="py-3 px-4">CONCEPTO</th>
                    <th className="py-3 px-4">CONDICIÓN</th>
                    <th className="py-3 px-4">VENCIMIENTO</th>
                    <th className="py-3 px-4 text-right">IMPORTE</th>
                    <th className="py-3 px-4 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {registeredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(receipt => {
                    const expense = allExpenses.find(item => item.id === receipt.expenseId);
                    if (!expense) return null;
                    return (
                      <tr key={receipt.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">{new Date(receipt.createdAt).toLocaleDateString('es-AR')}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-gray-100">{expense.supplierName}</td>
                        <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">{expense.concept}</td>
                        <td className="py-3.5 px-4">{receipt.paymentCondition === 'cuenta_corriente' ? 'Cta Cte' : 'Contado'}</td>
                        <td className="py-3.5 px-4">{receipt.dueDate ? new Date(`${receipt.dueDate}T00:00:00`).toLocaleDateString('es-AR') : '—'}</td>
                        <td className="py-3.5 px-4 text-right font-black text-rose-600 dark:text-rose-400 table-cell-num">{Money.fromAmount(receipt.amount).toFormattedString()}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleOpenEditReceipt(receipt)} className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-[#0088FF] dark:text-blue-400 font-bold rounded-lg cursor-pointer flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /><span>Editar</span></button>
                            <button onClick={() => handleDeleteReceipt(receipt)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer" title="Eliminar comprobante"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {registeredReceipts.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron comprobantes para estos filtros.</td></tr>}
                </tbody>
              </table>
            </div>
            )
          )}

          {/* CARD FOOTER CON PAGINACION DE SERVIDOR */}
          {!loading && tableView === 'comprobantes' && registeredReceipts.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/40 text-xs text-gray-500 font-medium">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  Mostrando <strong className="text-gray-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</strong> a <strong className="text-gray-900 dark:text-white">{Math.min(totalCount, currentPage * pageSize)}</strong> de <strong className="text-gray-900 dark:text-white">{totalCount}</strong> registros
                </div>
                <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Mostrar:</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                  >
                    <option value={5}>5 por pág.</option>
                    <option value={10}>10 por pág.</option>
                    <option value={25}>25 por pág.</option>
                    <option value={50}>50 por pág.</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-900 dark:text-white flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-8 h-8 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        p === currentPage
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-900 dark:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0F172A] shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{editingReceipt ? 'Editar comprobante' : 'Nuevo comprobante'}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Asociá el importe con una fila de gasto existente.</p>
              </div>
              <button type="button" onClick={() => setIsReceiptModalOpen(false)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveReceipt} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label htmlFor="receipt-expense" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Gasto asociado *</label>
                <select
                  id="receipt-expense"
                  required
                  value={receiptExpenseId}
                  onChange={event => setReceiptExpenseId(event.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar categoría / proveedor / concepto</option>
                  {[...allExpenses].sort((a, b) => `${a.category}|${a.supplierName}`.localeCompare(`${b.category}|${b.supplierName}`, 'es')).map(expense => (
                    <option key={expense.id} value={expense.id}>{expense.category} / {expense.supplierName} / {expense.concept}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Importe (ARS) *</label>
                  <FormattedNumberInput
                    value={receiptAmount}
                    onChange={setReceiptAmount}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white text-right table-cell-num"
                  />
                </div>
                <div>
                  <label htmlFor="receipt-condition" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Condición *</label>
                  <select
                    id="receipt-condition"
                    value={receiptCondition}
                    onChange={event => {
                      const condition = event.target.value as ExpensePaymentCondition;
                      setReceiptCondition(condition);
                      if (condition === 'contado') setReceiptDueDate('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                  >
                    <option value="contado">Contado</option>
                    <option value="cuenta_corriente">Cta Cte</option>
                  </select>
                </div>
              </div>
              {receiptCondition === 'cuenta_corriente' && (
                <div>
                  <label htmlFor="receipt-due-date" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Fecha de vencimiento *</label>
                  <input id="receipt-due-date" type="date" required value={receiptDueDate} onChange={event => setReceiptDueDate(event.target.value)} className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white" />
                </div>
              )}
              <div>
                <label htmlFor="receipt-notes" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
                <textarea id="receipt-notes" rows={2} value={receiptNotes} onChange={event => setReceiptNotes(event.target.value)} className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button type="button" onClick={() => setIsReceiptModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">Guardar comprobante</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO / EDITAR EGRESO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92dvh] sm:max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden flex flex-col">
            {/* MODAL HEADER */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {modalMode === 'nuevo' && 'Nuevo Egreso'}
                    {modalMode === 'editar' && 'Editar Egreso'}
                    {modalMode === 'ver' && 'Detalle de Egreso'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registre o modifique gastos domésticos, de emprendimiento o extraordinarios
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY FORM */}
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 overflow-y-auto">
              {/* TIPO DE EGRESO */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipo de Egreso *
                </label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {EXPENSE_SOURCE_TYPES.map(st => {
                    const Icon = st.icon;
                    const isSelected = sourceType === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={modalMode === 'ver'}
                        onClick={() => {
                          setSourceType(st.id);
                          if (st.id === 'domestico') setCategory('Alimentación & Hogar');
                          if (st.id === 'emprendimiento') setCategory('Software & Infraestructura');
                        }}
                        className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MODALIDAD (FIJO / PROYECTADO) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Modalidad de Egreso *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <button
                    type="button"
                    disabled={modalMode === 'ver'}
                    onClick={() => setExpenseType('fijo')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      expenseType === 'fijo'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Fijo (Compromiso / Obligación)</span>
                  </button>
                  <button
                    type="button"
                    disabled={modalMode === 'ver'}
                    onClick={() => setExpenseType('proyectado')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      expenseType === 'proyectado'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Proyectado (Estimado / Variable)</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {expenseType === 'fijo'
                    ? 'Fijo: Gasto pactado, cuota o factura recurrente confirmada.'
                    : 'Proyectado: Estimación de consumo variable que se supone erogar.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Proveedor / Beneficiario */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Proveedor / Beneficiario *
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'ver'}
                    value={counterpartyQuery}
                    onChange={e => {
                      setCounterpartyQuery(e.target.value);
                      setSupplierName(e.target.value);
                      setIsCounterpartyListOpen(true);
                    }}
                    onFocus={() => setIsCounterpartyListOpen(true)}
                    onBlur={() => setIsCounterpartyListOpen(false)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && isCounterpartyListOpen && counterpartyQuery.trim()) {
                        e.preventDefault();
                        saveCounterparty(counterpartyQuery);
                      }
                    }}
                    placeholder="Buscar o escribir una contraparte"
                    role="combobox"
                    aria-expanded={modalMode !== 'ver' && isCounterpartyListOpen}
                    aria-autocomplete="list"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70"
                  />
                  {modalMode !== 'ver' && isCounterpartyListOpen && counterpartyQuery.trim() && (
                    <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                      {filteredCounterparties.map(name => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => saveCounterparty(name)}
                          className="block w-full px-3.5 py-2.5 text-left text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {name}
                        </button>
                      ))}
                      {!filteredCounterparties.some(name => name.localeCompare(counterpartyQuery.trim(), 'es', { sensitivity: 'base' }) === 0) && (
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => saveCounterparty(counterpartyQuery)}
                          className="block w-full px-3.5 py-2.5 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-gray-700"
                        >
                          + Crear “{counterpartyQuery.trim()}”
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Concepto / Servicio */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Concepto / Servicio *
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'ver'}
                    value={concept}
                    onChange={e => setConcept(e.target.value)}
                    placeholder="Ej: Servicio Eléctrico / Alimentos"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Categoría
                  </label>
                  <select
                    disabled={modalMode === 'ver'}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70 cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado: Botón Activar / Desactivar */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Estado del Egreso *
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <button
                      type="button"
                      disabled={modalMode === 'ver'}
                      onClick={() => setStatus('activo')}
                      className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        status === 'activo'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Activo</span>
                    </button>
                    <button
                      type="button"
                      disabled={modalMode === 'ver'}
                      onClick={() => setStatus('pausado')}
                      className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        status === 'pausado' || status === 'finalizado'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Desactivado</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Condición de pago *
                  </label>
                  <select
                    disabled={modalMode === 'ver'}
                    value={paymentCondition}
                    onChange={e => {
                      const condition = e.target.value as ExpensePaymentCondition;
                      setPaymentCondition(condition);
                      if (condition === 'contado') setDueDate('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70"
                  >
                    <option value="contado">Contado</option>
                    <option value="cuenta_corriente">Cta Cte</option>
                  </select>
                </div>
                {paymentCondition === 'cuenta_corriente' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      disabled={modalMode === 'ver'}
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monto Base Mensual */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Monto Mensual Base (ARS)
                  </label>
                  <FormattedNumberInput
                    value={baseMonthlyAmount}
                    onChange={setBaseMonthlyAmount}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none table-cell-num text-right"
                  />
                </div>

                {/* Medio de Pago Predeterminado */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Medio de Pago Predeterminado
                  </label>
                  <select
                    disabled={modalMode === 'ver'}
                    value={defaultPaymentMethod}
                    onChange={e => setDefaultPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-70 cursor-pointer"
                  >
                    <option value="card">Tarjeta de Crédito</option>
                    <option value="cash">Efectivo / Transferencia</option>
                    <option value="debit">Débito Automático</option>
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Notas / Observaciones
                </label>
                <textarea
                  disabled={modalMode === 'ver'}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles del gasto, vencimientos o acuerdos particulares..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none disabled:opacity-70"
                />
              </div>

              {/* FOOTER ACCIONES */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-center"
                >
                  {modalMode === 'ver' ? 'Cerrar' : 'Cancelar'}
                </button>
                {modalMode !== 'ver' && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{modalMode === 'nuevo' ? 'Crear Egreso' : 'Guardar Cambios'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
