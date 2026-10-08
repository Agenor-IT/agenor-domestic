import { supabase } from './supabaseClient';
import {
  IAccountingRepository,
  DomAccountDTO,
  DomJournalEntryDTO,
  DomFiscalYearDTO
} from '../domain/repositories/IAccountingRepository';

export const DEFAULT_DOM_ACCOUNTS: DomAccountDTO[] = [
  // 1. ACTIVO
  { id: 9, personaPadreId: 1, code: '1.1.01.01', name: 'Caja Efectivo', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#10B981', isArchived: false },
  { id: 10, personaPadreId: 1, code: '1.1.02.01', name: 'Cuentas Virtuales / Wallets', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#3B82F6', isArchived: false },
  { id: 11, personaPadreId: 1, code: '1.1.02.02', name: 'Bancos / Cuentas Bancarias', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#3B82F6', isArchived: false },
  { id: 38, personaPadreId: 1, code: '1.1.03.01', name: 'Cuentas por Cobrar - Clientes Generales', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#6366F1', isArchived: false },
  { id: 64, personaPadreId: 1, code: '1.1.03.02', name: 'Cuentas por Cobrar - Cliente Particular / Personas', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#6366F1', isArchived: false },
  { id: 65, personaPadreId: 1, code: '1.1.03.03', name: 'Cuentas por Cobrar - Cliente Empresa / Comercial', kind: 'asset', nature: 'debit', subrubro: 'Activo Corriente', openingBalance: 0, currentBalance: 0, color: '#6366F1', isArchived: false },
  { id: 34, personaPadreId: 1, code: '1.2.01.01', name: 'Inmuebles', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  { id: 44, personaPadreId: 1, code: '1.2.01.02', name: 'Rodados y Vehículos', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  { id: 45, personaPadreId: 1, code: '1.2.01.03', name: 'Equipos Informáticos y Tecnología', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  { id: 46, personaPadreId: 1, code: '1.2.01.04', name: 'Muebles y Útiles', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  { id: 47, personaPadreId: 1, code: '1.2.01.05', name: 'Maquinaria y Equipamiento', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  { id: 48, personaPadreId: 1, code: '1.2.01.06', name: 'Instalaciones', kind: 'asset', nature: 'debit', subrubro: 'Activo No Corriente', openingBalance: 0, currentBalance: 0, color: '#8B5CF6', isArchived: false },
  
  // 2. PASIVO
  { id: 12, personaPadreId: 1, code: '2.1.01.01', name: 'Cuentas por Pagar - Proveedores Comerciales', kind: 'liability', nature: 'credit', subrubro: 'Pasivo Corriente', openingBalance: 0, currentBalance: 0, color: '#EF4444', isArchived: false },
  { id: 68, personaPadreId: 1, code: '2.1.01.02', name: 'Cuentas por Pagar - Proveedores de Servicios / Suministros', kind: 'liability', nature: 'credit', subrubro: 'Pasivo Corriente', openingBalance: 0, currentBalance: 0, color: '#EF4444', isArchived: false },
  { id: 67, personaPadreId: 1, code: '2.1.01.03', name: 'Cuentas por Pagar - Proveedores Varios / Honorarios', kind: 'liability', nature: 'credit', subrubro: 'Pasivo Corriente', openingBalance: 0, currentBalance: 0, color: '#EF4444', isArchived: false },
  { id: 13, personaPadreId: 1, code: '2.1.01.04', name: 'Tarjetas de Crédito / Consumos Pendientes', kind: 'liability', nature: 'credit', subrubro: 'Pasivo Corriente', openingBalance: 0, currentBalance: 0, color: '#EF4444', isArchived: false },
  
  // 3. PATRIMONIO NETO
  { id: 14, personaPadreId: 1, code: '3.1.01.01', name: 'Capital Neto del Hogar', kind: 'equity', nature: 'credit', subrubro: 'Patrimonio Neto', openingBalance: 0, currentBalance: 0, color: '#F59E0B', isArchived: false },

  // 4. INGRESOS
  { id: 16, personaPadreId: 1, code: '4.1.01.01', name: 'Ventas e Ingresos Comerciales', kind: 'income', nature: 'credit', subrubro: 'Ingresos Operativos', openingBalance: 0, currentBalance: 0, color: '#10B981', isArchived: false },
  { id: 17, personaPadreId: 1, code: '4.1.01.02', name: 'Alquileres Ganados', kind: 'income', nature: 'credit', subrubro: 'Ingresos Operativos', openingBalance: 0, currentBalance: 0, color: '#10B981', isArchived: false },
  { id: 18, personaPadreId: 1, code: '4.2.01.01', name: 'Ingresos por Canje / Permuta', kind: 'income', nature: 'credit', subrubro: 'Otros Ingresos', openingBalance: 0, currentBalance: 0, color: '#10B981', isArchived: false },

  // 5. EGRESOS
  { id: 19, personaPadreId: 1, code: '5.1.01.01', name: 'Alquiler Residencia / Inmuebles', kind: 'expense', nature: 'debit', subrubro: 'Gastos Operativos', openingBalance: 0, currentBalance: 0, color: '#F43F5E', isArchived: false },
  { id: 35, personaPadreId: 1, code: '5.1.01.02', name: 'Supermercado e Insumos', kind: 'expense', nature: 'debit', subrubro: 'Gastos Operativos', openingBalance: 0, currentBalance: 0, color: '#F43F5E', isArchived: false }
];

export class SupabaseDomAccountingRepository implements IAccountingRepository {
  public async getAccounts(personaPadreId: number): Promise<DomAccountDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_accounts')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .eq('is_archived', false)
        .order('code', { ascending: true, nullsFirst: false });

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          personaPadreId: row.persona_padre_id,
          code: row.code || 'SIN_CODIGO',
          name: row.name,
          kind: row.kind,
          nature: row.nature || 'debit',
          subrubro: row.subrubro || 'General',
          openingBalance: Number(row.opening_balance || 0),
          currentBalance: Number(row.current_balance || 0),
          color: row.color || '#3B82F6',
          isArchived: row.is_archived || false
        }));
      }
    } catch (err) {
      console.warn('Error al obtener dom_accounts de Supabase, usando catálogo por defecto:', err);
    }

    return DEFAULT_DOM_ACCOUNTS.map(a => ({ ...a, personaPadreId }));
  }

  public async createAccount(account: Omit<DomAccountDTO, 'id'>): Promise<DomAccountDTO> {
    const { data, error } = await supabase
      .from('dom_accounts')
      .insert({
        persona_padre_id: account.personaPadreId,
        code: account.code,
        name: account.name,
        kind: account.kind,
        nature: account.nature,
        subrubro: account.subrubro || 'General',
        opening_balance: account.openingBalance,
        current_balance: account.currentBalance,
        color: account.color,
        is_archived: account.isArchived
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear cuenta en dom_accounts:', error);
      throw new Error(`Error al crear cuenta contable: ${error.message}`);
    }

    return {
      id: data.id,
      personaPadreId: data.persona_padre_id,
      code: data.code,
      name: data.name,
      kind: data.kind,
      nature: data.nature,
      subrubro: data.subrubro || 'General',
      openingBalance: Number(data.opening_balance),
      currentBalance: Number(data.current_balance),
      color: data.color,
      isArchived: data.is_archived
    };
  }

  public async updateAccount(account: DomAccountDTO): Promise<DomAccountDTO> {
    const { data, error } = await supabase
      .from('dom_accounts')
      .update({
        code: account.code,
        name: account.name,
        kind: account.kind,
        nature: account.nature,
        subrubro: account.subrubro,
        color: account.color,
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id)
      .eq('persona_padre_id', account.personaPadreId)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar cuenta en dom_accounts:', error);
      throw new Error(`Error al actualizar cuenta contable: ${error.message}`);
    }

    return {
      id: data.id,
      personaPadreId: data.persona_padre_id,
      code: data.code,
      name: data.name,
      kind: data.kind,
      nature: data.nature,
      subrubro: data.subrubro || 'General',
      openingBalance: Number(data.opening_balance || 0),
      currentBalance: Number(data.current_balance || 0),
      color: data.color,
      isArchived: data.is_archived
    };
  }

  public async deleteAccount(personaPadreId: number, accountId: number): Promise<void> {
    const { error } = await supabase
      .from('dom_accounts')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .eq('persona_padre_id', personaPadreId);

    if (error) {
      console.error('Error al archivar/eliminar cuenta en dom_accounts:', error);
      throw new Error(`Error al eliminar cuenta contable: ${error.message}`);
    }
  }

  public async getJournalEntries(personaPadreId: number): Promise<DomJournalEntryDTO[]> {
    const { data: entries, error: entriesErr } = await supabase
      .from('dom_journal_entries')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('entry_number', { ascending: false });

    if (entriesErr) {
      console.error('Error al consultar dom_journal_entries:', entriesErr);
      throw new Error(`Error al consultar Libro Diario: ${entriesErr.message}`);
    }

    if (!entries || entries.length === 0) return [];

    const entryIds = entries.map(e => e.id);
    const { data: lines, error: linesErr } = await supabase
      .from('dom_journal_lines')
      .select(`
        *,
        dom_accounts (
          code,
          name
        )
      `)
      .in('journal_entry_id', entryIds);

    if (linesErr) {
      console.error('Error al consultar dom_journal_lines:', linesErr);
      throw new Error(`Error al cargar renglones de asientos: ${linesErr.message}`);
    }

    return entries.map(entry => {
      const entryLines = (lines || [])
        .filter(l => l.journal_entry_id === entry.id)
        .map(l => ({
          id: l.id,
          personaPadreId: l.persona_padre_id,
          journalEntryId: l.journal_entry_id,
          accountId: l.account_id,
          accountCode: l.dom_accounts?.code || '',
          accountName: l.dom_accounts?.name || 'Cuenta General',
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          memo: l.memo
        }));

      return {
        id: entry.id,
        personaPadreId: entry.persona_padre_id,
        entryNumber: entry.entry_number,
        entryDate: entry.entry_date,
        description: entry.description,
        referenceId: entry.reference_id,
        lines: entryLines
      };
    });
  }

  public async recordJournalEntry(entry: Omit<DomJournalEntryDTO, 'entryNumber'>): Promise<{ success: boolean; entryNumber: number; message: string }> {
    const { data, error } = await supabase.rpc('dom_fn_registrar_asiento', {
      p_persona_padre_id: entry.personaPadreId,
      p_fecha: entry.entryDate,
      p_concepto: entry.description,
      p_lineas: entry.lines.map(l => ({
        account_id: l.accountId,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo || ''
      })),
      p_referencia_id: entry.referenceId || null
    });

    if (error) {
      console.error('Error al invocar RPC dom_fn_registrar_asiento:', error);
      throw new Error(`Error al registrar asiento contable: ${error.message}`);
    }

    return {
      success: data.success,
      entryNumber: data.entry_number,
      message: data.message
    };
  }

  private getLocalFiscalYears(): DomFiscalYearDTO[] {
    const raw = localStorage.getItem('dom_fiscal_years_fallback');
    if (!raw) {
      const initial: DomFiscalYearDTO[] = [
        {
          id: 1,
          personaPadreId: 1,
          year: 2026,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: 'open',
          openingEntryId: null,
          closingEntryId: null
        }
      ];
      localStorage.setItem('dom_fiscal_years_fallback', JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalFiscalYears(years: DomFiscalYearDTO[]) {
    localStorage.setItem('dom_fiscal_years_fallback', JSON.stringify(years));
  }

  public async getFiscalYears(personaPadreId: number): Promise<DomFiscalYearDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_fiscal_years')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .order('year', { ascending: false });

      if (!error && data) {
        const mapped = data.map(row => ({
          id: Number(row.id),
          personaPadreId: row.persona_padre_id,
          year: row.year,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status as 'open' | 'closed',
          openingEntryId: row.opening_entry_id ? Number(row.opening_entry_id) : null,
          closingEntryId: row.closing_entry_id ? Number(row.closing_entry_id) : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
        this.saveLocalFiscalYears(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Fallback a almacenamiento local para getFiscalYears:', err);
    }

    return this.getLocalFiscalYears().filter(f => f.personaPadreId === personaPadreId);
  }

  public async createFiscalYear(fiscalYear: Omit<DomFiscalYearDTO, 'id'>): Promise<DomFiscalYearDTO> {
    try {
      const { data, error } = await supabase
        .from('dom_fiscal_years')
        .insert({
          persona_padre_id: fiscalYear.personaPadreId,
          year: fiscalYear.year,
          start_date: fiscalYear.startDate,
          end_date: fiscalYear.endDate,
          status: fiscalYear.status || 'open'
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: Number(data.id),
          personaPadreId: data.persona_padre_id,
          year: data.year,
          startDate: data.start_date,
          endDate: data.end_date,
          status: data.status,
          openingEntryId: data.opening_entry_id ? Number(data.opening_entry_id) : null,
          closingEntryId: data.closing_entry_id ? Number(data.closing_entry_id) : null
        };
      }
    } catch (err) {
      console.warn('Fallback local para createFiscalYear:', err);
    }

    const current = this.getLocalFiscalYears();
    const newObj: DomFiscalYearDTO = {
      ...fiscalYear,
      id: Date.now()
    };
    current.unshift(newObj);
    this.saveLocalFiscalYears(current);
    return newObj;
  }

  public async updateAccountOpeningBalances(personaPadreId: number, balances: { accountId: number; openingBalance: number }[]): Promise<void> {
    for (const b of balances) {
      const { error } = await supabase
        .from('dom_accounts')
        .update({ opening_balance: b.openingBalance })
        .eq('id', b.accountId)
        .eq('persona_padre_id', personaPadreId);

      if (error) {
        console.error(`Error al actualizar saldo inicial para cuenta ID ${b.accountId}:`, error);
        throw new Error(`Error al guardar saldos iniciales: ${error.message}`);
      }
    }
  }

  public async recordOpeningEntry(personaPadreId: number, fiscalYearId: number, year: number): Promise<{ success: boolean; entryNumber: number; message: string }> {
    const accounts = await this.getAccounts(personaPadreId);
    
    // Accounts with opening balance != 0
    const activeOpeningAccounts = accounts.filter(a => Math.abs(Number(a.openingBalance || 0)) > 0);
    
    let totalDebit = 0;
    let totalCredit = 0;

    const lines = activeOpeningAccounts.map(acc => {
      const balance = Math.abs(Number(acc.openingBalance));
      const isDebit = acc.kind === 'asset' || acc.nature === 'debit';
      if (isDebit) {
        totalDebit += balance;
        return {
          personaPadreId,
          accountId: acc.id,
          debit: balance,
          credit: 0,
          memo: `Saldo Inicial ${acc.code} ${acc.name}`
        };
      } else {
        totalCredit += balance;
        return {
          personaPadreId,
          accountId: acc.id,
          debit: 0,
          credit: balance,
          memo: `Saldo Inicial ${acc.code} ${acc.name}`
        };
      }
    });

    // If there is an imbalance, adjust against Capital Neto (3.1.01.01)
    const diff = totalDebit - totalCredit;
    if (Math.abs(diff) > 0.01) {
      const capitalAccount = accounts.find(a => a.code === '3.1.01.01') || accounts.find(a => a.kind === 'equity');
      if (capitalAccount) {
        const existingLine = lines.find(l => l.accountId === capitalAccount.id);
        if (existingLine) {
          if (diff > 0) {
            existingLine.credit += diff;
          } else {
            existingLine.debit += Math.abs(diff);
          }
        } else {
          lines.push({
            personaPadreId,
            accountId: capitalAccount.id,
            debit: diff < 0 ? Math.abs(diff) : 0,
            credit: diff > 0 ? diff : 0,
            memo: 'Saldo Inicial Ajuste Capital Neto'
          });
        }
      }
    }

    if (lines.length === 0) {
      throw new Error('No existen cuentas con saldos iniciales para generar el Asiento de Apertura.');
    }

    const res = await this.recordJournalEntry({
      personaPadreId,
      entryDate: `${year}-01-01`,
      description: `Asiento de Apertura del Ejercicio Económico ${year}`,
      referenceId: `APERTURA-${year}`,
      lines
    });

    if (res.success) {
      await supabase
        .from('dom_fiscal_years')
        .update({ opening_entry_id: res.entryNumber })
        .eq('id', fiscalYearId)
        .eq('persona_padre_id', personaPadreId);
    }

    return res;
  }

  public async closeFiscalYear(personaPadreId: number, fiscalYearId: number, year: number): Promise<{ success: boolean; entryNumber: number; message: string }> {
    const accounts = await this.getAccounts(personaPadreId);

    // Get current balances of income and expense accounts
    const resultAccounts = accounts.filter(a => (a.kind === 'income' || a.kind === 'expense') && Math.abs(Number(a.currentBalance || 0)) > 0);

    if (resultAccounts.length === 0) {
      throw new Error('No existen saldos de Ingresos ni Egresos para refundir en este ejercicio.');
    }

    let totalIncome = 0;
    let totalExpense = 0;

    const lines: Array<{ personaPadreId: number; accountId: number; debit: number; credit: number; memo: string }> = [];

    resultAccounts.forEach(acc => {
      const balance = Math.abs(Number(acc.currentBalance));
      if (acc.kind === 'income') {
        totalIncome += balance;
        // Income has credit balance -> Debit it to refund (zero out)
        lines.push({
          personaPadreId,
          accountId: acc.id,
          debit: balance,
          credit: 0,
          memo: `Refundición de cuenta de Ingreso ${acc.code} ${acc.name}`
        });
      } else if (acc.kind === 'expense') {
        totalExpense += balance;
        // Expense has debit balance -> Credit it to refund (zero out)
        lines.push({
          personaPadreId,
          accountId: acc.id,
          debit: 0,
          credit: balance,
          memo: `Refundición de cuenta de Egreso ${acc.code} ${acc.name}`
        });
      }
    });

    const netResult = totalIncome - totalExpense; // Positive = Profit, Negative = Loss
    const capitalAccount = accounts.find(a => a.code === '3.1.01.01') || accounts.find(a => a.kind === 'equity');

    if (capitalAccount) {
      if (netResult > 0) {
        // Superávit -> Credit Equity
        lines.push({
          personaPadreId,
          accountId: capitalAccount.id,
          debit: 0,
          credit: netResult,
          memo: `Superávit del Ejercicio Económico ${year}`
        });
      } else if (netResult < 0) {
        // Déficit -> Debit Equity
        lines.push({
          personaPadreId,
          accountId: capitalAccount.id,
          debit: Math.abs(netResult),
          credit: 0,
          memo: `Déficit del Ejercicio Económico ${year}`
        });
      }
    }

    const res = await this.recordJournalEntry({
      personaPadreId,
      entryDate: `${year}-12-31`,
      description: `Asiento de Refundición de Cuentas de Resultado - Cierre Ejercicio ${year}`,
      referenceId: `REFUNDICION-${year}`,
      lines
    });

    if (res.success) {
      await supabase
        .from('dom_fiscal_years')
        .update({
          status: 'closed',
          closing_entry_id: res.entryNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', fiscalYearId)
        .eq('persona_padre_id', personaPadreId);
    }

    return res;
  }
}

