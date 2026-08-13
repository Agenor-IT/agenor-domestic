import { PaymentPriority } from './PaymentPriority';

export interface IPaymentPriorityRepository {
  getPrioritiesByTenant(personaPadreId: number): Promise<PaymentPriority[]>;
  savePriorities(personaPadreId: number, priorities: PaymentPriority[]): Promise<void>;
}
