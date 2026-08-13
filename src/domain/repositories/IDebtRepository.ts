import { DebtAggregate, PaymentAllocationResult } from '../debt/DebtAggregate';
import { Money } from '../shared/Money';

export interface IDebtRepository {
  getDebtsByTenant(personaPadreId: number): Promise<DebtAggregate[]>;
  allocatePayment(personaPadreId: number, debtId: string, amount: Money): Promise<PaymentAllocationResult>;
}
