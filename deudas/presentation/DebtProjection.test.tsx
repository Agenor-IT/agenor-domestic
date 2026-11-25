import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DebtTerms } from '../domain/debt';
import { DebtProjection } from './DebtProjection';

const terms: DebtTerms = { principal: 100, months: 2, monthlyRate: 0, firstDueOn: '2027-01-01', method: 'french' };

describe('Estado por cuota', () => {
  it('muestra el estado de cada número de cuota guardado', () => {
    const html = renderToStaticMarkup(<DebtProjection terms={terms} statuses={{ 1: 'paid', 2: 'pending' }} />);
    expect(html).toContain('Estado');
    expect(html).toMatch(/Pagada.*Pendiente/s);
  });

  it('distingue cuotas nuevas de las deudas históricas sin estado', () => {
    expect(renderToStaticMarkup(<DebtProjection terms={terms} projected />)).toContain('Pendiente');
    expect(renderToStaticMarkup(<DebtProjection terms={terms} statuses={{}} />)).toContain('Sin dato');
  });
});
