import { describe, expect, it } from 'vitest';
import { installmentStatus, nominalAnnualToMonthly, projectInstallments, validDebt, type DebtTerms } from './debt';

const terms: DebtTerms = { principal: 1000, months: 2, monthlyRate: 10, firstDueOn: '2028-01-31', method: 'french' };

describe('Proyección mensual de deudas', () => {
  it('convierte TNA a tasa mensual y conserva los estados comprobados', () => {
    expect(nominalAnnualToMonthly(120)).toBe(10);
    expect(nominalAnnualToMonthly(100)).toBe(8.3333);
    expect(nominalAnnualToMonthly(0.0006)).toBe(0.0001);
    expect(nominalAnnualToMonthly(-1)).toBeNaN();
    expect(installmentStatus('paid')).toBe('paid');
    expect(installmentStatus('pending')).toBe('pending');
    expect(installmentStatus(undefined)).toBe('unknown');
  });
  it('calcula cuota francesa, interés y saldo con cierre exacto de capital', () => {
    const [first, second] = projectInstallments(terms);
    expect(first).toMatchObject({ paymentCents: 57619, interestCents: 10000, principalCents: 47619, balanceCents: 52381 });
    expect(second).toMatchObject({ paymentCents: 57619, interestCents: 5238, principalCents: 52381, balanceCents: 0 });
  });

  it('usa capital constante en alemán y conserva el día original en meses posteriores', () => {
    const rows = projectInstallments({ ...terms, method: 'german', months: 3 });
    expect(rows.map(row => row.principalCents)).toEqual([33333, 33333, 33334]);
    expect(rows.map(row => row.dueOn)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
    expect(rows[2].balanceCents).toBe(0);
  });

  it('redondea un empate exacto de medio centavo igual que PostgreSQL', () => {
    const rows = projectInstallments({ ...terms, principal: 4.10, monthlyRate: 5 });
    expect(rows.map(row => row.paymentCents)).toEqual([221, 221]);
  });

  it('liquida a tasa cero y rechaza condiciones inválidas', () => {
    expect(projectInstallments({ ...terms, monthlyRate: 0 }).map(row => row.paymentCents)).toEqual([50000, 50000]);
    expect(projectInstallments({ ...terms, firstDueOn: '2027-02-30' })).toEqual([]);
    expect(validDebt({ ...terms, creditor: 'Prueba', type: 'Préstamo', openedOn: '2028-02-01' })).toBe(false);
    expect(projectInstallments({ ...terms, monthlyRate: 100, months: 360 })).toEqual([]);
    expect(projectInstallments({ ...terms, principal: 0.04, months: 3, monthlyRate: 0 }).map(row => row.paymentCents)).toEqual([1, 1, 2]);
  });
});
