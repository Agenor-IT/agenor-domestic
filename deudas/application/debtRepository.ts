import { amortizationLabels, type Debt, type InstallmentStatus, type NewDebt } from '../domain/debt';

export interface DebtRepository {
  list(): Promise<Debt[]>;
  create(debt: NewDebt): Promise<void>;
  installmentStatuses(debtId: string): Promise<Record<number, InstallmentStatus>>;
}

export type DebtPeriod = 'all' | 'day' | 'week' | 'month' | 'year';
export type DebtSortKey = 'creditor' | 'type' | 'openedOn' | 'balance' | 'months' | 'method';
export type DebtSort = { key: DebtSortKey; ascending: boolean };

const debtCollator = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true });

export function sortDebts(debts: Debt[], { key, ascending }: DebtSort): Debt[] {
  const value = (debt: Debt) => {
    if (key === 'months') return debt.terms?.months;
    if (key === 'method') return debt.terms && amortizationLabels[debt.terms.method];
    return debt[key];
  };
  return [...debts].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (a == null) return b == null ? left.id.localeCompare(right.id) : 1;
    if (b == null) return -1;
    const order = typeof a === 'number' && typeof b === 'number' ? a - b : debtCollator.compare(String(a), String(b));
    return order === 0 ? left.id.localeCompare(right.id) : ascending ? order : -order;
  });
}

export function filterDebts(debts: Debt[], text: string, period: DebtPeriod, value: string): Debt[] {
  const normalize = (input: string) => input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const query = normalize(text.trim());
  // El selector semanal es de una fecha dentro de la semana. El intervalo va de lunes a domingo.
  const selected = new Date(value + 'T00:00:00Z');
  const weekStart = new Date(selected);
  weekStart.setUTCDate(selected.getUTCDate() - (selected.getUTCDay() + 6) % 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  return debts.filter(debt => {
    if (!normalize(debt.creditor + ' ' + debt.type).includes(query)) return false;
    if (!value || period === 'all' || (period === 'year' && !/^[1-9]\d{3}$/.test(value))) return true;
    if (period === 'week') {
      const date = new Date(debt.openedOn + 'T00:00:00Z');
      return date >= weekStart && date < weekEnd;
    }
    return debt.openedOn.startsWith(value);
  });
}
