export type AmortizationMethod = 'french' | 'german';

export const amortizationLabels: Record<AmortizationMethod, string> = {
  french: 'Francés · cuota fija',
  german: 'Alemán · capital fijo',
};

export interface DebtTerms {
  principal: number;
  months: number;
  monthlyRate: number;
  firstDueOn: string;
  method: AmortizationMethod;
}

export interface NewDebt extends DebtTerms {
  id: string;
  creditor: string;
  creditorId: string;
  type: string;
  openedOn: string;
  operationNumber: string;
  relationship: string;
  nominalAnnualRate: number;
}
export type DebtInput = DebtTerms & Pick<NewDebt, 'creditor' | 'type' | 'openedOn'>;

export interface Debt {
  id: string;
  creditor: string;
  type: string;
  openedOn: string;
  balance: number;
  terms: DebtTerms | null;
  operationNumber?: string;
  relationship?: string;
  nominalAnnualRate?: number;
}

export type InstallmentStatus = 'paid' | 'pending' | 'unknown';

export function installmentStatus(status: string | undefined): InstallmentStatus {
  if (status === 'paid') return 'paid';
  return status === 'pending' ? 'pending' : 'unknown';
}

export function nominalAnnualToMonthly(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1200 || value !== Number(value.toFixed(4))) return NaN;
  return Math.round(Math.round(value * 10_000) / 12) / 10_000;
}

export interface Installment {
  number: number;
  dueOn: string;
  principalCents: number;
  interestCents: number;
  paymentCents: number;
  balanceCents: number;
}

export function isDebtDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const RATE_SCALE = 1_000_000n;
const rateUnitsOf = (monthlyRate: number) => BigInt(Math.round(monthlyRate * 10_000));
const interestOf = (cents: number, units: bigint) => Number((BigInt(cents) * units + RATE_SCALE / 2n) / RATE_SCALE);

function frenchPayment(principal: number, months: number, units: bigint): number {
  const period = BigInt(months);
  const capital = BigInt(principal);
  if (units === 0n) return Number((2n * capital + period) / (2n * period));
  // La expresión racional evita perder los empates de medio centavo en coma flotante.
  const rateFactor = (RATE_SCALE + units) ** period;
  const numerator = capital * units * rateFactor;
  const denominator = RATE_SCALE * (rateFactor - RATE_SCALE ** period);
  return Number((2n * numerator + denominator) / (2n * denominator));
}

export function validTerms(terms: DebtTerms): boolean {
  const fieldsValid = Number.isFinite(terms.principal) && terms.principal >= 0.01 && terms.principal <= 999999999.99
    && Number(terms.principal.toFixed(2)) === terms.principal
    && Number.isInteger(terms.months) && terms.months >= 1 && terms.months <= 360
    && Number.isFinite(terms.monthlyRate) && terms.monthlyRate >= 0 && terms.monthlyRate <= 100
    && Number(terms.monthlyRate.toFixed(4)) === terms.monthlyRate
    && isDebtDate(terms.firstDueOn) && terms.firstDueOn <= '9969-12-31'
    && (terms.method === 'french' || terms.method === 'german');
  if (!fieldsValid) return false;
  const cents = Math.round(terms.principal * 100);
  const units = rateUnitsOf(terms.monthlyRate);
  return cents >= terms.months && (terms.method === 'german' || terms.months === 1
    || frenchPayment(cents, terms.months, units) > interestOf(cents, units));
}

export function validDebt(debt: DebtInput): boolean {
  return debt.creditor.trim().length > 0 && debt.creditor.length <= 120
    && debt.type.trim().length > 0 && debt.type.length <= 60 && isDebtDate(debt.openedOn)
    && debt.openedOn <= debt.firstDueOn && validTerms(debt);
}

function installmentDate(firstDueOn: string, offset: number): string {
  const [year, month, day] = firstDueOn.split('-').map(Number);
  const end = new Date(Date.UTC(year, month + offset, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + offset, Math.min(day, end))).toISOString().slice(0, 10);
}

export function projectInstallments(terms: DebtTerms): Installment[] {
  if (!validTerms(terms)) return [];
  const principal = Math.round(terms.principal * 100);
  const rateUnits = rateUnitsOf(terms.monthlyRate);
  const fixedPayment = frenchPayment(principal, terms.months, rateUnits);
  const fixedPrincipal = Math.floor(principal / terms.months);
  let balance = principal;

  return Array.from({ length: terms.months }, (_, index) => {
    const interestCents = interestOf(balance, rateUnits);
    const projectedPrincipal = terms.method === 'german' ? fixedPrincipal : Math.max(0, fixedPayment - interestCents);
    const principalCents = index === terms.months - 1
      ? balance
      : Math.min(balance - (terms.months - index - 1), projectedPrincipal);
    balance -= principalCents;
    return {
      number: index + 1,
      dueOn: installmentDate(terms.firstDueOn, index),
      principalCents,
      interestCents,
      paymentCents: principalCents + interestCents,
      balanceCents: balance,
    };
  });
}
