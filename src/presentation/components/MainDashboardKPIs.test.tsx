import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Money } from '../../domain/shared/Money';
import { MainDashboardKPIs } from './MainDashboardKPIs';

const render = (cardDebt: Money | null) => renderToStaticMarkup(<MainDashboardKPIs
  accountsReceivable={Money.zero()} accountsPayable={Money.zero()}
  cashAvailable={Money.zero()} bankAvailable={Money.zero()} cardDebt={cardDebt} />);

describe('Deuda de tarjeta en el resumen existente', () => {
  it('muestra el saldo registrado sin presentarlo como cupo ni vencimiento mensual', () => {
    const html = render(Money.fromAmount(123456.78));
    expect(html).toContain('Deuda de tarjeta');
    expect(html).toContain('123.456,78');
    expect(html).toContain('Sin distribución por vencimiento');
    expect(html).not.toContain('Disponible Tarjetas');
    expect(html).not.toContain('límite vigente');
  });
  it('no informa deuda cero cuando falta el saldo', () => {
    expect(render(null)).toContain('Saldo no disponible');
    expect(render(Money.zero())).not.toContain('Saldo no disponible');
  });
});
