import { supabase } from '../../src/infrastructure/supabaseClient';
import type { DebtRepository } from '../application/debtRepository';
import { installmentStatus, type AmortizationMethod, type Debt } from '../domain/debt';

const projectionColumns = 'id,creditor_name,debt_type,total_principal,interest_rate_monthly,created_at,opened_on,original_principal,term_months,first_due_on,amortization_method';
const columns = projectionColumns + ',operation_number,debt_relationship,nominal_annual_rate';
const legacyColumns = 'id,creditor_name,debt_type,total_principal,interest_rate_monthly,created_at';
const localDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

interface DebtRow {
  id: string;
  creditor_name: string;
  debt_type: string;
  total_principal: number;
  interest_rate_monthly: number;
  created_at: string;
  opened_on?: string | null;
  original_principal?: number | null;
  term_months?: number | null;
  first_due_on?: string | null;
  amortization_method?: AmortizationMethod | null;
  operation_number?: string | null;
  debt_relationship?: string | null;
  nominal_annual_rate?: number | null;
}

function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    creditor: row.creditor_name,
    type: row.debt_type,
    balance: Number(row.total_principal),
    openedOn: row.opened_on ?? localDate.format(new Date(row.created_at)),
    operationNumber: row.operation_number ?? undefined,
    relationship: row.debt_relationship ?? undefined,
    nominalAnnualRate: row.nominal_annual_rate == null ? undefined : Number(row.nominal_annual_rate),
    terms: row.original_principal != null && row.term_months && row.first_due_on && row.amortization_method ? {
      principal: Number(row.original_principal),
      months: row.term_months,
      monthlyRate: Number(row.interest_rate_monthly),
      firstDueOn: row.first_due_on,
      method: row.amortization_method,
    } : null,
  };
}

export function supabaseDebtRepository(personaPadreId: number): DebtRepository {
  return {
    async list() {
      const rows: DebtRow[] = [];
      const pageSize = 200;
      let selection = columns;
      let cursor: string | undefined;
      let page: DebtRow[];
      const load = () => {
        let query = supabase.from('dom_debts').select(selection)
          .eq('persona_padre_id', personaPadreId).order('id').limit(pageSize);
        if (cursor) query = query.gt('id', cursor);
        return query.overrideTypes<DebtRow[]>();
      };
      do {
        let result = await load();
        if (!cursor && result.error?.code === '42703') {
          selection = projectionColumns;
          result = await load();
        }
        if (!cursor && result.error?.code === '42703') {
          selection = legacyColumns;
          result = await load();
        }
        if (result.error) throw new Error('No se pudo cargar el listado de deudas.');
        page = result.data ?? [];
        rows.push(...page);
        cursor = page.at(-1)?.id;
      } while (page.length === pageSize);
      return rows.map(mapDebt).sort((left, right) => right.openedOn.localeCompare(left.openedOn));
    },
    async create(debt) {
      const { error } = await supabase.rpc('dom_create_debt_plan', {
        p_id: debt.id,
        p_persona_padre_id: personaPadreId,
        p_creditor_id: debt.creditorId,
        p_operation_number: debt.operationNumber,
        p_relationship: debt.relationship,
        p_type: debt.type,
        p_opened_on: debt.openedOn,
        p_principal: debt.principal,
        p_term_months: debt.months,
        p_nominal_annual_rate: debt.nominalAnnualRate,
        p_first_due_on: debt.firstDueOn,
        p_method: debt.method,
      });
      if (error?.code === 'PGRST202') {
        throw new Error('El guardado requiere aplicar la migración de acreedores y plan de cuotas en esta base.');
      }
      if (error?.code === '23505') throw new Error('El alta previa tiene otros datos. Revisá el listado antes de reintentar.');
      if (error) throw new Error('No se pudo guardar la deuda. Reintentá sin cambiar los datos.');
    },
    async installmentStatuses(debtId) {
      const { data, error } = await supabase.from('dom_debt_installments')
        .select('installment_number,status').eq('persona_padre_id', personaPadreId).eq('debt_id', debtId)
        .overrideTypes<{ installment_number: number; status: string }[], { merge: false }>();
      if (error) throw new Error('No se pudieron consultar los estados de las cuotas.');
      return Object.fromEntries((data ?? []).map(row => [row.installment_number, installmentStatus(row.status)]));
    },
  };
}
