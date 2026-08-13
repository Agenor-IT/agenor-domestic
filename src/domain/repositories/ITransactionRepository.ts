import { Money } from '../shared/Money';
import { PaymentMethodType } from '../shared/PaymentMethod';

export interface TransactionDTO {
  id?: string;
  personaPadreId: number;
  accountId?: number;
  categoryId?: number;
  direction: 'income' | 'expense';
  amount: Money;
  description: string;
  occurredOn: string;
  paymentMethod: PaymentMethodType;
  status: string;
}

export interface ITransactionRepository {
  createTransaction(tx: TransactionDTO): Promise<TransactionDTO>;
  getTransactionsByTenant(personaPadreId: number): Promise<TransactionDTO[]>;
}
