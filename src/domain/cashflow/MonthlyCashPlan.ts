import { Money } from '../shared/Money';
import { DomExpenseDTO } from '../expenses/DomExpense';

export const MONTHLY_CASH_PLAN_VERSION = 'monthly_cashflow_v1';
export interface PlannedCard { id: string; name: string; closingDay: number; dueDay: number; active?: boolean }
export interface CardCashPlan {
  id: string; cardId: string; month: string; dueDate: string; closingDate: string | null;
  source: 'statement' | 'estimate'; total: number; minimum: number | null;
  planned: number | null; plannedDate: string | null; revision: number;
}
export interface CardPayment {
  id: string; amount: number; date: string; description: string;
  allocations: { planId: string; amount: number; revision: number }[];
}
export interface PendingBill {
  id: string; description: string; amount: number; date: string;
  dueDate: string | null; expenseId: string | null; budgetMonth: string | null; scheduleRevision: number;
  payments: { amount: number; date: string }[];
}
export interface MonthlyCashSnapshot {
  version: typeof MONTHLY_CASH_PLAN_VERSION;
  cards: PlannedCard[]; plans: CardCashPlan[]; payments: CardPayment[];
  bills: PendingBill[]; expenses: DomExpenseDTO[]; legacyReceipts: number;
}
export interface CardPlanAmounts {
  paid: Money; outstanding: Money; plannedRemaining: Money | null;
  minimumRemaining: Money | null; financedAfterPlan: Money | null; belowMinimum: boolean; afterDueDate: boolean;
}
export interface MonthlyCashRow {
  month: string; fixed: Money; otherBudgets: Money; bills: Money; paid: Money;
  cards: Money; cardBudgets: Money; total: Money; incomplete: boolean;
}
const nonNegative = (value: Money) => value.isNegative() ? Money.zero() : value;
const sum = (values: number[]) => values.reduce((a, b) => a.add(b), Money.zero());
export function pendingBillAmount(bill: PendingBill): Money {
  return nonNegative(Money.fromAmount(bill.amount).subtract(sum(bill.payments.map(payment => payment.amount))));
}
export function validPlanDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateCardCashPlan(plan: CardCashPlan): void {
  const validAmount = (n: number) => Number.isFinite(n) && n >= 0 && n <= 999999999999.99 &&
    Math.abs(n * 100 - Math.round(n * 100)) < 0.001;
  if (!/^\d{4}-\d{2}$/.test(plan.month) || !validPlanDate(plan.month + '-01') ||
      !validPlanDate(plan.dueDate) || plan.dueDate.slice(0, 7) !== plan.month ||
      !['statement', 'estimate'].includes(plan.source) || !validAmount(plan.total) ||
      (plan.closingDate !== null && (!validPlanDate(plan.closingDate) || plan.closingDate > plan.dueDate)) ||
      (plan.source === 'statement' && plan.closingDate === null) ||
      (plan.minimum !== null && (!validAmount(plan.minimum) || plan.minimum > plan.total)) ||
      (plan.source === 'statement' && plan.minimum === null) ||
      (plan.planned !== null && (!validAmount(plan.planned) || plan.planned > plan.total ||
        !plan.plannedDate || !validPlanDate(plan.plannedDate) || (plan.closingDate !== null && plan.plannedDate < plan.closingDate))) ||
      (plan.planned === null && plan.plannedDate !== null) || !Number.isInteger(plan.revision) || plan.revision < 0) {
    throw new Error('Revisá mes, fechas e importes del resumen o estimación.');
  }
}
export function cardPlanAmounts(plan: CardCashPlan, payments: CardPayment[]): CardPlanAmounts {
  const paid = sum(payments.flatMap(payment => payment.allocations.filter(a => a.planId === plan.id).map(a => a.amount)));
  const outstanding = nonNegative(Money.fromAmount(plan.total).subtract(paid));
  const plannedRemaining = plan.planned === null ? null : nonNegative(Money.fromAmount(plan.planned).subtract(paid));
  const minimumRemaining = plan.minimum === null ? null : nonNegative(Money.fromAmount(plan.minimum).subtract(paid));
  return { paid, outstanding, plannedRemaining, minimumRemaining,
    financedAfterPlan: plannedRemaining === null ? null : nonNegative(outstanding.subtract(plannedRemaining)),
    belowMinimum: minimumRemaining !== null && plannedRemaining !== null && minimumRemaining.subtract(plannedRemaining).isPositive(),
    afterDueDate: plannedRemaining !== null && plannedRemaining.isPositive() && !!plan.plannedDate && plan.plannedDate > plan.dueDate };
}
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function budgetMonthLabel(month: string): string {
  return monthNames[Number(month.slice(5, 7)) - 1] + '-' + month.slice(2, 4);
}

/** Policy monthly_cashflow_v1 is published by the backend contract. No default payment,
 * card closing shift, minimum or interest is inferred. A saved plan is not a payment. */
export function projectMonthlyCash(snapshot: MonthlyCashSnapshot, months: string[]): MonthlyCashRow[] {
  if (snapshot.version !== MONTHLY_CASH_PLAN_VERSION) throw new Error('Actualizá el contrato del flujo mensual.');
  if (months.some(month => !validPlanDate(month + '-01'))) throw new Error('Período del flujo inválido.');
  snapshot.plans.forEach(validateCardCashPlan);
  const missingBillDate = snapshot.bills.some(bill => {
    const outstanding = Money.fromAmount(bill.amount).subtract(sum(bill.payments.map(p => p.amount)));
    return outstanding.isPositive() && !bill.dueDate;
  });
  const unallocatedPayment = snapshot.payments.some(payment =>
    Money.fromAmount(payment.amount).subtract(sum(payment.allocations.map(a => a.amount))).isPositive());
  return months.map(month => {
    let fixed = Money.zero(), otherBudgets = Money.zero(), cardBudgets = Money.zero();
    for (const expense of snapshot.expenses.filter(e => e.status === 'activo')) {
      // An explicitly linked invoice replaces this budget month, never adds to it.
      if (snapshot.bills.some(b => b.expenseId === expense.id && b.budgetMonth === month)) continue;
      const amount = Money.fromAmount(expense.monthlyProjections[budgetMonthLabel(month)] ?? expense.baseMonthlyAmount);
      if (expense.defaultPaymentMethod === 'card') cardBudgets = cardBudgets.add(amount);
      else if ((expense.expenseType || 'fijo') === 'fijo') fixed = fixed.add(amount);
      else otherBudgets = otherBudgets.add(amount);
    }
    let bills = Money.zero();
    let paid = sum(snapshot.payments.filter(payment => payment.date.slice(0, 7) === month).map(p => p.amount));
    for (const bill of snapshot.bills) {
      const paidAmount = sum(bill.payments.map(p => p.amount));
      paid = paid.add(sum(bill.payments.filter(p => p.date.slice(0, 7) === month).map(p => p.amount)));
      if (bill.dueDate?.slice(0, 7) === month) bills = bills.add(nonNegative(Money.fromAmount(bill.amount).subtract(paidAmount)));
    }
    let cards = Money.zero();
    let incomplete = missingBillDate || unallocatedPayment || snapshot.legacyReceipts > 0;
    for (const plan of snapshot.plans) {
      const values = cardPlanAmounts(plan, snapshot.payments);
      if (plan.plannedDate?.slice(0, 7) === month && values.plannedRemaining) cards = cards.add(values.plannedRemaining);
      if (plan.month === month && values.outstanding.isPositive() && plan.planned === null) incomplete = true;
    }
    // Expected card consumption is displayed separately. It is not a cash payment.
    // Every active card needs an explicit monthly plan, including an explicit zero.
    if (snapshot.cards.some(card => card.active !== false && !snapshot.plans.some(p => p.cardId === card.id && p.month === month))) incomplete = true;
    if (cardBudgets.isPositive() && !snapshot.cards.some(card => card.active !== false)) incomplete = true;
    const total = fixed.add(otherBudgets).add(bills).add(paid).add(cards);
    return { month, fixed, otherBudgets, bills, paid, cards, cardBudgets, total, incomplete };
  });
}
