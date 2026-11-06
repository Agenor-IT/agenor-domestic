import { supabase } from './supabaseClient';
import { CardCashPlan, MONTHLY_CASH_PLAN_VERSION, MonthlyCashSnapshot, PlannedCard, validateCardCashPlan } from '../domain/cashflow/MonthlyCashPlan';
import { IMonthlyCashRepository } from '../domain/repositories/IMonthlyCashRepository';

export class MonthlyCashNotEnabledError extends Error {
  constructor() { super('El flujo mensual está preparado localmente y requiere publicar su contrato de backend.'); }
}
export class SupabaseDomMonthlyCashRepository implements IMonthlyCashRepository {
  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await supabase.rpc(name, args);
    if (error?.code === 'PGRST202') throw new MonthlyCashNotEnabledError();
    if (error) throw new Error(error.message || 'No se pudo actualizar el flujo mensual.');
    return data;
  }
  async getSnapshot(personaPadreId: number): Promise<MonthlyCashSnapshot> {
    const data = await this.call('dom_monthly_cash_snapshot', { p_persona_padre_id: personaPadreId }) as MonthlyCashSnapshot | null;
    if (!data || data.version !== MONTHLY_CASH_PLAN_VERSION ||
      !['cards', 'plans', 'payments', 'bills', 'expenses'].every(key => Array.isArray(data[key as keyof MonthlyCashSnapshot]))) {
      throw new Error('El contrato del flujo mensual no es compatible.');
    }
    data.plans.forEach(validateCardCashPlan);
    return data;
  }
  async saveCard(personaPadreId: number, card: PlannedCard, expected?: PlannedCard): Promise<void> {
    await this.call('dom_save_cash_card', { p_persona_padre_id: personaPadreId, p_card: { ...card, expected: expected || null } });
  }
  async savePlan(personaPadreId: number, plan: CardCashPlan): Promise<void> {
    validateCardCashPlan(plan);
    await this.call('dom_save_card_cash_plan', { p_persona_padre_id: personaPadreId, p_plan: plan });
  }
  async allocatePayment(personaPadreId: number, planId: string, transactionId: string, amount: number, expectedRevision: number): Promise<void> {
    await this.call('dom_allocate_card_cash_payment', { p_persona_padre_id: personaPadreId, p_plan_id: planId, p_transaction_id: transactionId, p_amount: amount, p_expected_revision: expectedRevision });
  }
  async scheduleBill(personaPadreId: number, transactionId: string, dueDate: string, expenseId: string | null, budgetMonth: string | null, expectedRevision: number): Promise<void> {
    await this.call('dom_schedule_cash_bill', { p_persona_padre_id: personaPadreId, p_transaction_id: transactionId,
      p_due_date: dueDate, p_expense_id: expenseId, p_budget_month: budgetMonth ? budgetMonth + '-01' : null, p_expected_revision: expectedRevision });
  }
}
