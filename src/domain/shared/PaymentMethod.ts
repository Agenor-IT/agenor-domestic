export type PaymentMethodType = 'cash' | 'card' | 'debit';

export class PaymentMethod {
  private readonly type: PaymentMethodType;

  constructor(type: PaymentMethodType) {
    this.type = type;
  }

  public get value(): PaymentMethodType {
    return this.type;
  }

  public get isCard(): boolean {
    return this.type === 'card';
  }

  public get isCash(): boolean {
    return this.type === 'cash';
  }

  public get isDebit(): boolean {
    return this.type === 'debit';
  }

  public get label(): string {
    switch (this.type) {
      case 'cash':
        return 'Efectivo / transferencia';
      case 'card':
        return 'Tarjeta · +1 mes';
      case 'debit':
        return 'Débito automático';
    }
  }
}
