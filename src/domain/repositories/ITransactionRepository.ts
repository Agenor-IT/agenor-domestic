import { Money } from '../shared/Money';
import { PurchaseItemInput } from '../consumption/Consumption';

export const PURCHASE_DUE_DATE_CONTRACT = 'purchase_due_date_v1';

export interface TransactionDTO {
  id?: string;
  personaPadreId: number;
  accountId?: number;
  categoryId?: number;
  direction: 'income' | 'expense';
  amount: Money;
  description: string;
  occurredOn: string;
  paymentMethod: string;
  status: string;
  revision?: number;
  journalEntryId?: number | null;
  opNumber?: string;
  counterparty?: string;
  operationType?: string;
  paymentCondition?: 'contado' | 'cta_cte';
  settlesTransactionId?: string | null;
  classificationAccountId?: number | null;
  purchaseItems?: PurchaseItemInput[];
  billDueDate?: string | null;
  billScheduleRevision?: number;
}

export interface ITransactionRepository {
  saveTransaction(
    tx: TransactionDTO,
    lines: { accountId: number; debit: number; credit: number; memo?: string }[],
    paymentMethodKind: 'cash' | 'bank' | 'card',
    paymentAccountId: number | null,
    expectedRevision: number
  ): Promise<TransactionDTO>;
  voidTransaction(id: string, personaPadreId: number, expectedRevision: number): Promise<void>;
  getTransactionsByTenant(personaPadreId: number): Promise<TransactionDTO[]>;
}
