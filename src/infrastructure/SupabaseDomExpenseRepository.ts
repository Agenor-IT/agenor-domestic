import { supabase } from './supabaseClient';
import { DomExpenseDTO } from '../domain/expenses/DomExpense';

const LOCAL_STORAGE_KEY = 'dom_expenses_data';
const PAYMENT_METADATA_KEY = 'dom_expense_payment_metadata';

type ExpensePaymentMetadata = {
  paymentCondition: 'contado' | 'cuenta_corriente';
  dueDate: string | null;
};

export interface PaginatedExpensesParams {
  personaPadreId: number;
  page?: number;
  pageSize?: number;
  search?: string;
  sourceType?: string;
  expenseType?: string;
  status?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface PaginatedExpensesResult {
  items: DomExpenseDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    activeCount: number;
    totalCount: number;
    totalDomesticMonthly: number;
    totalBusinessMonthly: number;
    totalMonthlyAll: number;
  };
  tabCounts: {
    todos: number;
    domestico: number;
    emprendimiento: number;
    extraordinario: number;
  };
}

export class SupabaseDomExpenseRepository {
  private getPaymentMetadata(personaPadreId: number): Record<string, ExpensePaymentMetadata> {
    try {
      const value = JSON.parse(localStorage.getItem(`${PAYMENT_METADATA_KEY}_${personaPadreId}`) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  private savePaymentMetadata(expense: DomExpenseDTO): void {
    const key = `${PAYMENT_METADATA_KEY}_${expense.personaPadreId}`;
    const metadata = this.getPaymentMetadata(expense.personaPadreId);
    metadata[expense.id] = {
      paymentCondition: expense.paymentCondition || 'contado',
      dueDate: expense.dueDate || null
    };
    localStorage.setItem(key, JSON.stringify(metadata));
  }

  private withPaymentMetadata(expense: DomExpenseDTO): DomExpenseDTO {
    const metadata = this.getPaymentMetadata(expense.personaPadreId)[expense.id];
    return metadata ? {
      ...expense,
      paymentCondition: metadata.paymentCondition,
      dueDate: metadata.dueDate || undefined
    } : expense;
  }

  private getLocalExpenses(): DomExpenseDTO[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalExpenses(expenses: DomExpenseDTO[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  }

  private mapRowToDTO(row: any): DomExpenseDTO {
    const cachedExpense = this.getLocalExpenses().find(expense => expense.id === String(row.id));
    const metadata = this.getPaymentMetadata(row.persona_padre_id)[String(row.id)];
    return {
      id: String(row.id),
      personaPadreId: row.persona_padre_id,
      supplierName: row.supplier_name,
      concept: row.concept,
      category: row.category,
      sourceType: (row.source_type as 'domestico' | 'emprendimiento' | 'extraordinario') || 'domestico',
      status: row.status as 'activo' | 'en_negociacion' | 'finalizado' | 'pausado',
      expenseType: (row.expense_type as 'fijo' | 'proyectado') || 'fijo',
      baseMonthlyAmount: Number(row.base_monthly_amount),
      monthlyProjections: typeof row.monthly_projections === 'object' && row.monthly_projections !== null
        ? (Array.isArray(row.monthly_projections)
            ? row.monthly_projections.reduce((acc: any, val: number, idx: number) => {
                const months = ["Ago-26","Sep-26","Oct-26","Nov-26","Dic-26","Ene-27","Feb-27","Mar-27","Abr-27","May-27","Jun-27","Jul-27","Ago-27","Sep-27","Oct-27","Nov-27","Dic-27"];
                if (months[idx]) acc[months[idx]] = val;
                return acc;
              }, {})
            : row.monthly_projections)
        : {},
      defaultPaymentMethod: row.default_payment_method as 'cash' | 'card' | 'debit',
      paymentCondition: metadata?.paymentCondition || cachedExpense?.paymentCondition || 'contado',
      dueDate: metadata ? metadata.dueDate || undefined : cachedExpense?.dueDate,
      notes: row.notes || '',
      createdAt: row.created_at
    };
  }

  public async getPaginatedExpenses(params: PaginatedExpensesParams): Promise<PaginatedExpensesResult> {
    const {
      personaPadreId,
      page = 1,
      pageSize = 10,
      search = '',
      sourceType = 'todos',
      expenseType = 'todos',
      status = 'activo',
      orderBy = 'id',
      orderDir = 'desc'
    } = params;

    try {
      const { data, error } = await supabase.rpc('dom_expenses_paginated_list', {
        p_persona_padre_id: personaPadreId,
        p_page: page,
        p_page_size: pageSize,
        p_search: search,
        p_source_type: sourceType,
        p_expense_type: expenseType,
        p_status: status,
        p_order_by: orderBy,
        p_order_dir: orderDir
      });

      if (!error && data) {
        const items: DomExpenseDTO[] = (data.items || []).map((row: any) => this.mapRowToDTO(row));
        return {
          items,
          totalCount: Number(data.total_count) || 0,
          page: Number(data.page) || page,
          pageSize: Number(data.page_size) || pageSize,
          totalPages: Number(data.total_pages) || 1,
          summary: {
            activeCount: Number(data.summary?.active_count) || 0,
            totalCount: Number(data.summary?.total_count) || 0,
            totalDomesticMonthly: Number(data.summary?.total_domestic_monthly) || 0,
            totalBusinessMonthly: Number(data.summary?.total_business_monthly) || 0,
            totalMonthlyAll: Number(data.summary?.total_monthly_all) || 0,
          },
          tabCounts: {
            todos: Number(data.tab_counts?.todos) || 0,
            domestico: Number(data.tab_counts?.domestico) || 0,
            emprendimiento: Number(data.tab_counts?.emprendimiento) || 0,
            extraordinario: Number(data.tab_counts?.extraordinario) || 0,
          }
        };
      }
      if (error) {
        console.error('Error RPC dom_expenses_paginated_list:', error);
      }
    } catch (err) {
      console.warn('Fallo llamada RPC dom_expenses_paginated_list:', err);
    }

    // Fallback: client-side simulation from local storage if offline
    const all = this.getLocalExpenses().filter(e => e.personaPadreId === personaPadreId || !e.personaPadreId);
    return this.fallbackPaginated(all, params);
  }

  private fallbackPaginated(all: DomExpenseDTO[], params: PaginatedExpensesParams): PaginatedExpensesResult {
    const {
      page = 1,
      pageSize = 10,
      search = '',
      sourceType = 'todos',
      expenseType = 'todos',
      status = 'activo',
      orderBy = 'id',
      orderDir = 'desc'
    } = params;

    const cleanSearch = search.toLowerCase().trim();
    const filtered = all.filter(e => {
      const matchSearch = !cleanSearch ||
        e.supplierName.toLowerCase().includes(cleanSearch) ||
        e.concept.toLowerCase().includes(cleanSearch) ||
        e.category.toLowerCase().includes(cleanSearch);
      const matchSource = sourceType === 'todos' || e.sourceType === sourceType;
      const matchType = expenseType === 'todos' || e.expenseType === expenseType;
      const matchStatus = status === 'todos' || e.status === status;
      return matchSearch && matchSource && matchType && matchStatus;
    });

    filtered.sort((a, b) => {
      let valA: any = a[orderBy as keyof DomExpenseDTO] ?? '';
      let valB: any = b[orderBy as keyof DomExpenseDTO] ?? '';
      if (orderBy === 'projection') {
        valA = a.monthlyProjections?.['Ago-26'] ?? a.baseMonthlyAmount;
        valB = b.monthlyProjections?.['Ago-26'] ?? b.baseMonthlyAmount;
      }
      if (valA < valB) return orderDir === 'asc' ? -1 : 1;
      if (valA > valB) return orderDir === 'asc' ? 1 : -1;
      return 0;
    });

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const active = all.filter(e => e.status === 'activo');
    return {
      items,
      totalCount: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      summary: {
        activeCount: active.length,
        totalCount: all.length,
        totalDomesticMonthly: active.filter(e => e.sourceType === 'domestico').reduce((s, e) => s + e.baseMonthlyAmount, 0),
        totalBusinessMonthly: active.filter(e => e.sourceType === 'emprendimiento').reduce((s, e) => s + e.baseMonthlyAmount, 0),
        totalMonthlyAll: active.reduce((s, e) => s + e.baseMonthlyAmount, 0)
      },
      tabCounts: {
        todos: all.length,
        domestico: all.filter(e => e.sourceType === 'domestico').length,
        emprendimiento: all.filter(e => e.sourceType === 'emprendimiento').length,
        extraordinario: all.filter(e => e.sourceType === 'extraordinario').length
      }
    };
  }

  public async getExpenses(personaPadreId: number): Promise<DomExpenseDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_expenses')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .order('id', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: DomExpenseDTO[] = data.map(row => this.mapRowToDTO(row));
        const cachedExpenses = this.getLocalExpenses();
        const localOnly = cachedExpenses.filter(expense =>
          (expense.personaPadreId === personaPadreId || !expense.personaPadreId) &&
          !mapped.some(remoteExpense => remoteExpense.id === expense.id)
        ).map(expense => this.withPaymentMetadata(expense));
        const combined = [...mapped, ...localOnly];
        const otherTenants = cachedExpenses.filter(expense =>
          expense.personaPadreId && expense.personaPadreId !== personaPadreId
        );
        this.saveLocalExpenses([...combined, ...otherTenants]);
        return combined;
      }
    } catch (err) {
      console.warn('Error al obtener gastos desde Supabase:', err);
    }

    return this.getLocalExpenses()
      .filter(e => e.personaPadreId === personaPadreId || !e.personaPadreId)
      .map(expense => this.withPaymentMetadata(expense));
  }

  public async getAllExpenses(personaPadreId: number): Promise<DomExpenseDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_expenses')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const cachedExpenses = this.getLocalExpenses();
        const remote = data.map(row => this.mapRowToDTO(row));
        const localOnly = cachedExpenses.filter(expense =>
          (expense.personaPadreId === personaPadreId || !expense.personaPadreId) &&
          !remote.some(remoteExpense => remoteExpense.id === expense.id)
        ).map(expense => this.withPaymentMetadata(expense));
        return [...remote, ...localOnly].sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        );
      }
    } catch (err) {
      console.warn('Error al obtener todos los egresos:', err);
    }

    return this.getLocalExpenses()
      .filter(expense => expense.personaPadreId === personaPadreId || !expense.personaPadreId)
      .map(expense => this.withPaymentMetadata(expense))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async saveExpense(expense: Partial<DomExpenseDTO>, personaPadreId: number): Promise<DomExpenseDTO> {
    const isNew = !expense.id || expense.id.startsWith('exp-');

    const dbPayload = {
      persona_padre_id: personaPadreId,
      supplier_name: expense.supplierName || 'Nuevo Proveedor',
      concept: expense.concept || 'Gasto / Servicio',
      category: expense.category || 'Servicios',
      status: expense.status || 'activo',
      expense_type: expense.expenseType || 'fijo',
      source_type: expense.sourceType || 'domestico',
      base_monthly_amount: expense.baseMonthlyAmount || 0,
      monthly_projections: expense.monthlyProjections || {},
      default_payment_method: expense.defaultPaymentMethod || 'cash',
      notes: expense.notes || null
    };

    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('dom_expenses')
          .insert([dbPayload])
          .select()
          .single();

        if (!error && data) {
          const saved: DomExpenseDTO = {
            id: String(data.id),
            personaPadreId: data.persona_padre_id,
            supplierName: data.supplier_name,
            concept: data.concept,
            category: data.category,
            sourceType: (data.source_type as any) || 'domestico',
            status: data.status,
            expenseType: (data.expense_type as 'fijo' | 'proyectado') || 'fijo',
            baseMonthlyAmount: Number(data.base_monthly_amount),
            monthlyProjections: data.monthly_projections || {},
            defaultPaymentMethod: data.default_payment_method,
            paymentCondition: expense.paymentCondition || 'contado',
            dueDate: expense.dueDate,
            notes: data.notes || '',
            createdAt: data.created_at
          };

          const local = this.getLocalExpenses().filter(e => e.id !== expense.id);
          local.unshift(saved);
          this.saveLocalExpenses(local);
          this.savePaymentMetadata(saved);
          return saved;
        }
      } else {
        const { data, error } = await supabase
          .from('dom_expenses')
          .update(dbPayload)
          .eq('id', expense.id)
          .select()
          .single();

        if (!error && data) {
          const saved: DomExpenseDTO = {
            id: String(data.id),
            personaPadreId: data.persona_padre_id,
            supplierName: data.supplier_name,
            concept: data.concept,
            category: data.category,
            sourceType: (data.source_type as any) || 'domestico',
            status: data.status,
            expenseType: (data.expense_type as 'fijo' | 'proyectado') || 'fijo',
            baseMonthlyAmount: Number(data.base_monthly_amount),
            monthlyProjections: data.monthly_projections || {},
            defaultPaymentMethod: data.default_payment_method,
            paymentCondition: expense.paymentCondition || 'contado',
            dueDate: expense.dueDate,
            notes: data.notes || '',
            createdAt: data.created_at
          };

          const local = this.getLocalExpenses().map(e => e.id === saved.id ? saved : e);
          this.saveLocalExpenses(local);
          this.savePaymentMetadata(saved);
          return saved;
        }
      }
    } catch (err) {
      console.warn('Error al guardar en Supabase dom_expenses, utilizando almacenamiento local:', err);
    }

    // Fallback local
    const local = this.getLocalExpenses();
    const savedId = expense.id || `exp-${Date.now()}`;
    const savedDTO: DomExpenseDTO = {
      id: savedId,
      personaPadreId,
      supplierName: expense.supplierName || 'Nuevo Proveedor',
      concept: expense.concept || 'Gasto / Servicio',
      category: expense.category || 'Servicios',
      sourceType: expense.sourceType || 'domestico',
      expenseType: expense.expenseType || 'fijo',
      status: expense.status || 'activo',
      baseMonthlyAmount: expense.baseMonthlyAmount || 0,
      monthlyProjections: expense.monthlyProjections || {},
      defaultPaymentMethod: expense.defaultPaymentMethod || 'cash',
      paymentCondition: expense.paymentCondition || 'contado',
      dueDate: expense.dueDate || undefined,
      notes: expense.notes || '',
      createdAt: expense.createdAt || new Date().toISOString()
    };

    const existingIdx = local.findIndex(e => e.id === savedId);
    if (existingIdx >= 0) {
      local[existingIdx] = savedDTO;
    } else {
      local.unshift(savedDTO);
    }
    this.saveLocalExpenses(local);
    this.savePaymentMetadata(savedDTO);
    return savedDTO;
  }

  public async deleteExpense(id: string, _personaPadreId: number): Promise<void> {
    try {
      await supabase
        .from('dom_expenses')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.warn('Error al eliminar en Supabase dom_expenses:', err);
    }

    const local = this.getLocalExpenses().filter(e => e.id !== id);
    this.saveLocalExpenses(local);
    const key = `${PAYMENT_METADATA_KEY}_${_personaPadreId}`;
    const metadata = this.getPaymentMetadata(_personaPadreId);
    delete metadata[id];
    localStorage.setItem(key, JSON.stringify(metadata));
  }
}
