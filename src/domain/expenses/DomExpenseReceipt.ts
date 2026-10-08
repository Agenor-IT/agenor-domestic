import { ExpensePaymentCondition } from './DomExpense';

export interface DomExpenseReceipt {
  id: string;
  personaPadreId: number;
  expenseId: string;
  amount: number;
  paymentCondition: ExpensePaymentCondition;
  dueDate?: string;
  notes?: string;
  createdAt: string;
}
