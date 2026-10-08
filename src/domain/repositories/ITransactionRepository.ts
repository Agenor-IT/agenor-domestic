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
  opNumber?: string;
  counterparty?: string;
  operationType?: string;
  paymentCondition?: 'contado' | 'cta_cte';
}

export interface ITransactionRepository {
  createTransaction(tx: TransactionDTO): Promise<TransactionDTO>;
  updateTransaction(tx: TransactionDTO): Promise<TransactionDTO>;
  deleteTransaction(id: string): Promise<void>;
  getTransactionsByTenant(personaPadreId: number): Promise<TransactionDTO[]>;
}
