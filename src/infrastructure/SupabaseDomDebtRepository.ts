import { IDebtRepository } from '../domain/repositories/IDebtRepository';
import { DebtAggregate, PaymentAllocationResult } from '../domain/debt/DebtAggregate';
import { Money } from '../domain/shared/Money';
import { supabase } from './supabaseClient';

export class SupabaseDomDebtRepository implements IDebtRepository {
  public async getDebtsByTenant(personaPadreId: number): Promise<DebtAggregate[]> {
    const { data, error } = await supabase
      .from('dom_debts')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('priority', { ascending: true });

    if (error) {
      throw new Error(`Error al consultar dom_debts: ${error.message}`);
    }

    return (data || []).map(item => new DebtAggregate(
      item.id,
      item.creditor_name,
      item.debt_type,
      Money.fromAmount(item.total_principal),
      Money.fromAmount(item.arrears_balance),
      Money.fromAmount(item.monthly_installment),
      item.interest_rate_monthly,
      item.priority
    ));
  }

  public async allocatePayment(personaPadreId: number, debtId: string, amount: Money): Promise<PaymentAllocationResult> {
    const { data, error } = await supabase.rpc('dom_allocate_payment', {
      p_persona_padre_id: personaPadreId,
      p_debt_id: debtId,
      p_amount: amount.toAmount()
    });

    if (error) {
      throw new Error(`Error en RPC dom_allocate_payment: ${error.message}`);
    }

    return {
      allocatedToArrears: Money.fromAmount(data.allocated_arrears || 0),
      allocatedToPrincipal: Money.fromAmount(data.allocated_principal || 0),
      remainingArrears: Money.zero(),
      remainingPrincipal: Money.zero()
    };
  }
}
