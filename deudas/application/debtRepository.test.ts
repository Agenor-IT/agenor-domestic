import { describe, expect, it } from 'vitest';
import type { Debt } from '../domain/debt';
import { filterDebts, sortDebts } from './debtRepository';

const rows: Debt[] = [
  { id: '1', creditor: 'Álamos', type: 'Préstamo', openedOn: '2026-11-16', balance: 300, terms: null },
  { id: '2', creditor: 'Bazar', type: 'Compra', openedOn: '2026-11-22', balance: 50, terms: null },
  { id: '3', creditor: 'Crédito', type: 'Tarjeta', openedOn: '2026-11-23', balance: 1000, terms: null },
  { id: '4', creditor: 'Distribuidor', type: 'Compra', openedOn: '2025-11-22', balance: 200, terms: null },
];

describe('Consulta del listado de deudas', () => {
  it('combina búsqueda normalizada con el intervalo elegido', () => {
    expect(filterDebts(rows, 'alamos', 'day', '2026-11-16').map(row => row.id)).toEqual(['1']);
    expect(filterDebts(rows, '', 'week', '2026-11-19').map(row => row.id)).toEqual(['1', '2']);
    expect(filterDebts(rows, '', 'month', '2026-11').map(row => row.id)).toEqual(['1', '2', '3']);
    expect(filterDebts(rows, 'compra', 'year', '2025').map(row => row.id)).toEqual(['4']);
  });

  it('ordena fechas y capital numérico sin modificar el listado original', () => {
    expect(sortDebts(rows, { key: 'balance', ascending: true }).map(row => row.id)).toEqual(['2', '4', '1', '3']);
    expect(sortDebts(rows, { key: 'openedOn', ascending: false }).map(row => row.id)).toEqual(['3', '2', '1', '4']);
    expect(rows.map(row => row.id)).toEqual(['1', '2', '3', '4']);
  });

  it('ordena por las etiquetas de amortización en español y deja el legado al final', () => {
    const terms = { principal: 1000, months: 2, monthlyRate: 1, firstDueOn: '2026-12-01' };
    const data: Debt[] = [
      { ...rows[0], terms: { ...terms, method: 'french' } },
      { ...rows[1], terms: { ...terms, method: 'german' } },
      rows[2],
    ];
    expect(sortDebts(data, { key: 'method', ascending: true }).map(row => row.id)).toEqual(['2', '1', '3']);
    expect(sortDebts(data, { key: 'method', ascending: false }).map(row => row.id)).toEqual(['1', '2', '3']);
  });
});
