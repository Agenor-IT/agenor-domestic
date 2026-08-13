import { Money } from '../shared/Money';

export interface PaymentAllocationResult {
  allocatedToArrears: Money;
  allocatedToPrincipal: Money;
  remainingArrears: Money;
  remainingPrincipal: Money;
}

export class DebtAggregate {
  public readonly id: string;
  public readonly creditorName: string;
  public readonly debtType: string;
  private totalPrincipal: Money;
  private arrearsBalance: Money;
  public readonly monthlyInstallment: Money;
  public readonly interestRateMonthly: number;
  public readonly priority: number;

  constructor(
    id: string,
    creditorName: string,
    debtType: string,
    totalPrincipal: Money,
    arrearsBalance: Money,
    monthlyInstallment: Money,
    interestRateMonthly: number = 0,
    priority: number = 99
  ) {
    this.id = id;
    this.creditorName = creditorName;
    this.debtType = debtType;
    this.totalPrincipal = totalPrincipal;
    this.arrearsBalance = arrearsBalance;
    this.monthlyInstallment = monthlyInstallment;
    this.interestRateMonthly = interestRateMonthly;
    this.priority = priority;
  }

  public get ArrearsBalance(): Money {
    return this.arrearsBalance;
  }

  public get TotalPrincipal(): Money {
    return this.totalPrincipal;
  }

  /**
   * Asigna un pago a la deuda siguiendo la regla estricta:
   * 1. Reducir saldo en mora
   * 2. Remanente reduce el capital principal
   */
  public allocatePayment(paymentAmount: Money): PaymentAllocationResult {
    let remaining = paymentAmount;
    let allocatedArrears = Money.zero();
    let allocatedPrincipal = Money.zero();

    if (this.arrearsBalance.isPositive() && remaining.isPositive()) {
      if (remaining.toAmount() >= this.arrearsBalance.toAmount()) {
        allocatedArrears = this.arrearsBalance;
        remaining = remaining.subtract(this.arrearsBalance);
        this.arrearsBalance = Money.zero();
      } else {
        allocatedArrears = remaining;
        this.arrearsBalance = this.arrearsBalance.subtract(remaining);
        remaining = Money.zero();
      }
    }

    if (remaining.isPositive()) {
      allocatedPrincipal = remaining;
      this.totalPrincipal = this.totalPrincipal.subtract(remaining);
      if (this.totalPrincipal.isNegative()) {
        this.totalPrincipal = Money.zero();
      }
    }

    return {
      allocatedToArrears: allocatedArrears,
      allocatedToPrincipal: allocatedPrincipal,
      remainingArrears: this.arrearsBalance,
      remainingPrincipal: this.totalPrincipal
    };
  }
}
