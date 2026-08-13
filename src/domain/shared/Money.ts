/**
 * Value Object: Money
 * Representación inmutable y matemática exacta de montos de dinero en ARS.
 * Prohibido usar float directo en comparaciones o cálculos financieros.
 * Almacena el valor internamente en centavos (BigInt) para evitar imprecisiones IEEE 754.
 */

export class Money {
  private readonly cents: bigint;

  private constructor(cents: bigint) {
    this.cents = cents;
  }

  public static fromAmount(amount: number | string | Money): Money {
    if (amount instanceof Money) return amount;
    const numVal = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numVal)) {
      throw new Error(`Invalid money amount: ${amount}`);
    }
    // Convertir a centavos redondeando para evitar residuos de flotantes
    const cents = BigInt(Math.round(numVal * 100));
    return new Money(cents);
  }

  public static zero(): Money {
    return new Money(BigInt(0));
  }

  public add(other: Money | number): Money {
    const otherMoney = Money.fromAmount(other);
    return new Money(this.cents + otherMoney.cents);
  }

  public subtract(other: Money | number): Money {
    const otherMoney = Money.fromAmount(other);
    return new Money(this.cents - otherMoney.cents);
  }

  public multiplyByFactor(factor: number): Money {
    const num = this.toAmount() * factor;
    return Money.fromAmount(num);
  }

  public applyPercentage(rate: number): Money {
    return this.multiplyByFactor(1 + rate);
  }

  public isNegative(): boolean {
    return this.cents < BigInt(0);
  }

  public isPositive(): boolean {
    return this.cents > BigInt(0);
  }

  public isZero(): boolean {
    return this.cents === BigInt(0);
  }

  public equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  public toAmount(): number {
    return Number(this.cents) / 100;
  }

  public toFormattedString(): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(this.toAmount());
  }

  public toJSON(): number {
    return this.toAmount();
  }
}
