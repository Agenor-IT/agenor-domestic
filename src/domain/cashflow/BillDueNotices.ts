import { Money } from '../shared/Money';
import { PendingBill, pendingBillAmount, validPlanDate } from './MonthlyCashPlan';

export interface BillDueNotice {
  id: string; transactionId: string; title: string; dueDate: string; outstanding: Money;
}

/** The snapshot already excludes voided transactions and stale schedules.
 * A date is never inferred from the issue date or the description. */
export function billDueNotices(bills: PendingBill[]): BillDueNotice[] {
  const seen = new Set<string>();
  return bills.flatMap(bill => {
    if (seen.has(bill.id)) throw new Error('Factura duplicada en los vencimientos.');
    seen.add(bill.id);
    if (bill.dueDate === null) return [];
    if (!validPlanDate(bill.dueDate)) throw new Error('Vencimiento de factura inválido.');
    const outstanding = pendingBillAmount(bill);
    if (!outstanding.isPositive()) return [];
    return [{ id: `bill:${bill.id}:${bill.dueDate}`, transactionId: bill.id,
      title: bill.description.trim() || 'Factura pendiente', dueDate: bill.dueDate, outstanding }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
