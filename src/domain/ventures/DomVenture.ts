export type IncomeSourceType = 'emprendimiento' | 'alquiler' | 'extraordinario';
export type IncomeNatureType = 'fijo' | 'proyectado';

export interface DomVentureDTO {
  id: string;
  personaPadreId: number;
  clientName: string;
  projectName: string;
  category: string;
  sourceType?: IncomeSourceType;
  incomeType?: IncomeNatureType;
  status: 'activo' | 'en_negociacion' | 'finalizado' | 'pausado';
  baseMonthlyAmount: number;
  monthlyProjections: Record<string, number>;
  defaultPaymentMethod: 'cash' | 'card' | 'debit';
  notes?: string;
  createdAt?: string;
}

export class DomVenture {
  constructor(public readonly dto: DomVentureDTO) {}

  get id(): string {
    return this.dto.id;
  }

  get clientName(): string {
    return this.dto.clientName;
  }

  get projectName(): string {
    return this.dto.projectName;
  }

  get category(): string {
    return this.dto.category;
  }

  get sourceType(): IncomeSourceType {
    return this.dto.sourceType || 'emprendimiento';
  }

  get incomeType(): IncomeNatureType {
    return this.dto.incomeType || 'fijo';
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
