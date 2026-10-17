import { supabase } from './supabaseClient';
import {
  IAccountingRepository,
  DomAccountDTO,
  DomJournalEntryDTO,
  DomFiscalYearDTO
} from '../domain/repositories/IAccountingRepository';

export class SupabaseDomAccountingRepository implements IAccountingRepository {
  public async getAccounts(personaPadreId: number, includeArchived = false): Promise<DomAccountDTO[]> {
    let query = supabase
      .from('dom_accounts')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('code', { ascending: true, nullsFirst: false });
    if (!includeArchived) query = query.eq('is_archived', false);
    const { data, error } = await query;
    if (error) {
      throw new Error('No se pudo cargar el plan de cuentas: ' + error.message);
    }
    return (data || []).map(row => ({
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
        color: account.color
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
    const entries: any[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('dom_journal_entries')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .order('entry_number', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(`Error al consultar Libro Diario: ${error.message}`);
      entries.push(...(data || []));
      if ((data || []).length < pageSize) break;
    }
    if (entries.length === 0) return [];

    const lines: any[] = [];
    for (let index = 0; index < entries.length; index += 100) {
      const entryIds = entries.slice(index, index + 100).map(e => e.id);
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('dom_journal_lines')
          .select('*, dom_accounts(code, name)')
          .eq('persona_padre_id', personaPadreId)
          .in('journal_entry_id', entryIds)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Error al cargar renglones de asientos: ${error.message}`);
        lines.push(...(data || []));
        if ((data || []).length < pageSize) break;
      }
    }

    const linesByEntry = new Map<number, any[]>();
    for (const line of lines) {
      const group = linesByEntry.get(line.journal_entry_id) || [];
      group.push(line);
      linesByEntry.set(line.journal_entry_id, group);
    }
    return entries.map(entry => {
      const entryLines = (linesByEntry.get(entry.id) || [])
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

  public async getFiscalYears(personaPadreId: number): Promise<DomFiscalYearDTO[]> {
    const { data, error } = await supabase
      .from('dom_fiscal_years')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('year', { ascending: false });
    if (error) throw new Error('No se pudieron cargar los ejercicios: ' + error.message);
    return (data || []).map(row => ({
      id: Number(row.id),
      personaPadreId: row.persona_padre_id,
      year: row.year,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status as 'open' | 'closed',
      openingEntryId: row.opening_entry_id == null ? null : Number(row.opening_entry_id),
      closingEntryId: row.closing_entry_id == null ? null : Number(row.closing_entry_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public async createFiscalYear(fiscalYear: Omit<DomFiscalYearDTO, 'id'>): Promise<DomFiscalYearDTO> {
    const { data, error } = await supabase
      .from('dom_fiscal_years')
      .insert({
        persona_padre_id: fiscalYear.personaPadreId,
        year: fiscalYear.year,
        start_date: fiscalYear.startDate,
        end_date: fiscalYear.endDate,
        status: 'open'
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error('No se pudo crear el ejercicio: ' + (error?.message || 'Sin confirmación de la base'));
    }
    return {
      id: Number(data.id),
      personaPadreId: data.persona_padre_id,
      year: data.year,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      openingEntryId: data.opening_entry_id == null ? null : Number(data.opening_entry_id),
      closingEntryId: data.closing_entry_id == null ? null : Number(data.closing_entry_id)
    };
  }

  public async recordOpeningEntry(
    personaPadreId: number,
    fiscalYearId: number,
    balances: { accountId: number; openingBalance: number }[]
  ): Promise<{ success: boolean; entryNumber: number | null; message: string }> {
    const { data, error } = await supabase.rpc('dom_open_fiscal_year', {
      p_persona_padre_id: personaPadreId,
      p_fiscal_year_id: fiscalYearId,
      p_balances: balances.map(balance => ({
        account_id: balance.accountId,
        opening_balance: balance.openingBalance
      }))
    });
    if (error || !data?.success) {
      throw new Error('No se pudo registrar la apertura: ' + (error?.message || data?.message || 'Sin confirmación'));
    }
    return {
      success: true,
      entryNumber: data.entry_number == null ? null : Number(data.entry_number),
      message: data.message || 'Apertura registrada'
    };
  }

  public async closeFiscalYear(
    personaPadreId: number,
    fiscalYearId: number
  ): Promise<{ success: boolean; entryNumber: number | null; message: string }> {
    const { data, error } = await supabase.rpc('dom_close_fiscal_year', {
      p_persona_padre_id: personaPadreId,
      p_fiscal_year_id: fiscalYearId
    });
    if (error || !data?.success) {
      throw new Error('No se pudo cerrar el ejercicio: ' + (error?.message || data?.message || 'Sin confirmación'));
    }
    return {
      success: true,
      entryNumber: data.entry_number == null ? null : Number(data.entry_number),
      message: data.message || 'Ejercicio cerrado'
    };
  }

}

