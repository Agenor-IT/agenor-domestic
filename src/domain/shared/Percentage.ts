export class Percentage {
  private readonly rate: number;

  constructor(rate: number) {
    if (isNaN(rate)) throw new Error('Invalid percentage rate');
    this.rate = rate;
  }

  public get decimalValue(): number {
    return this.rate;
  }

  public get percentageValue(): number {
    return this.rate * 100;
  }

  public toFormattedString(): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.rate);
  }
}
