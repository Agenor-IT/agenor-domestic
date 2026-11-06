import { CardCashPlan, MonthlyCashSnapshot, PlannedCard } from '../cashflow/MonthlyCashPlan';
export interface IMonthlyCashRepository {
  getSnapshot(personaPadreId: number): Promise<MonthlyCashSnapshot>;
  saveCard(personaPadreId: number, card: PlannedCard, expected?: PlannedCard): Promise<void>;
  savePlan(personaPadreId: number, plan: CardCashPlan): Promise<void>;
  allocatePayment(personaPadreId: number, planId: string, transactionId: string, amount: number, expectedRevision: number): Promise<void>;
  scheduleBill(personaPadreId: number, transactionId: string, dueDate: string, expenseId: string | null, budgetMonth: string | null, expectedRevision: number): Promise<void>;
}
