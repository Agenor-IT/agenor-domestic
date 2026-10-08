export type ExpenseSourceType = 'domestico' | 'emprendimiento' | 'extraordinario';
export type ExpenseNatureType = 'fijo' | 'proyectado';
export type ExpensePaymentCondition = 'contado' | 'cuenta_corriente';

export interface DomExpenseDTO {
  id: string;
  personaPadreId: number;
  supplierName: string;
  concept: string;
  category: string;
  sourceType?: ExpenseSourceType;
  expenseType?: ExpenseNatureType;
  status: 'activo' | 'en_negociacion' | 'finalizado' | 'pausado';
  baseMonthlyAmount: number;
  monthlyProjections: Record<string, number>;
  defaultPaymentMethod: 'cash' | 'card' | 'debit';
  paymentCondition?: ExpensePaymentCondition;
  dueDate?: string;
  notes?: string;
  createdAt?: string;
}

export class DomExpense {
  constructor(public readonly dto: DomExpenseDTO) {}

  get id(): string {
    return this.dto.id;
  }

  get supplierName(): string {
    return this.dto.supplierName;
  }

  get concept(): string {
    return this.dto.concept;
  }

  get category(): string {
    return this.dto.category;
  }

  get sourceType(): ExpenseSourceType {
    return this.dto.sourceType || 'domestico';
  }

  get expenseType(): ExpenseNatureType {
    return this.dto.expenseType || 'fijo';
  }

  get status(): 'activo' | 'en_negociacion' | 'finalizado' | 'pausado' {
    return this.dto.status;
  }

  get baseMonthlyAmount(): number {
    return this.dto.baseMonthlyAmount;
  }

  get monthlyProjections(): Record<string, number> {
    return this.dto.monthlyProjections || {};
  }

  get defaultPaymentMethod(): 'cash' | 'card' | 'debit' {
    return this.dto.defaultPaymentMethod;
  }

  get paymentCondition(): ExpensePaymentCondition {
    return this.dto.paymentCondition || 'contado';
  }

  get dueDate(): string | undefined {
    return this.dto.dueDate;
  }

  get notes(): string {
    return this.dto.notes || '';
  }

  public getProjectionForMonth(monthLabel: string): number {
    if (this.monthlyProjections[monthLabel] !== undefined) {
      return this.monthlyProjections[monthLabel];
    }
    return this.baseMonthlyAmount;
  }

  public getTotalProjectedAmount(monthLabels: string[]): number {
    return monthLabels.reduce((sum, month) => sum + this.getProjectionForMonth(month), 0);
  }
}
