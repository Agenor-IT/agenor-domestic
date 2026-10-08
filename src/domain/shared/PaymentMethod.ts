export type PaymentMethodType = 'cash' | 'card' | 'debit';

export interface CustomPaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card';
  active: boolean;
  accountId?: number;
  accountCode?: string;
  accountName?: string;
  creditLimit?: number;
  initialAvailable?: number;
  initialBalance?: number;
}

export const DEFAULT_CUSTOM_PAYMENT_METHODS: CustomPaymentMethod[] = [
  { id: 'efectivo', name: 'Efectivo', type: 'cash', active: true, accountCode: '1.1.01.01', accountName: 'Caja Efectivo', initialBalance: 0 },
  { id: 'ca_naranja', name: 'CA Naranja', type: 'bank', active: true, accountCode: '1.1.02.01', accountName: 'Cuentas Virtuales / Wallets', initialBalance: 0 },
  { id: 'tarjeta_naranja', name: 'Tarjeta Naranja', type: 'card', active: true, accountCode: '2.1.01.02', accountName: 'Tarjetas de Crédito', creditLimit: 750000, initialAvailable: 505647.70 },
];

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
