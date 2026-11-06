import { describe, expect, it } from 'vitest';
import { CardCashPlan, CardPayment, cardPlanAmounts, MONTHLY_CASH_PLAN_VERSION, MonthlyCashSnapshot, projectMonthlyCash, validateCardCashPlan } from './MonthlyCashPlan';
import { DomExpenseDTO } from '../expenses/DomExpense';

const expense = (id: string, amount: number, method: 'cash' | 'card' = 'cash'): DomExpenseDTO => ({
  id, personaPadreId: 42, supplierName: id, concept: 'Servicio', category: 'Servicios', status: 'activo',
  expenseType: 'fijo', baseMonthlyAmount: amount, monthlyProjections: {}, defaultPaymentMethod: method
});
const plan: CardCashPlan = { id: 'plan', cardId: 'card', month: '2026-11', dueDate: '2026-11-10', closingDate: '2026-10-25', source: 'statement',
  total: 1000, minimum: 100, planned: 200, plannedDate: '2026-11-09', revision: 0 };
const payment = (id: string, amount: number, date = '2026-11-05'): CardPayment => ({
  id, amount, date, description: 'Pago de tarjeta', allocations: [{ planId: plan.id, amount, revision: 0 }]
});
const snapshot = (changes: Partial<MonthlyCashSnapshot> = {}): MonthlyCashSnapshot => ({
  version: MONTHLY_CASH_PLAN_VERSION, cards: [{ id: 'card', name: 'Tarjeta sintética', closingDay: 25, dueDay: 10 }],
  plans: [plan], payments: [], bills: [], expenses: [], legacyReceipts: 0, ...changes
});
describe('Flujo mensual con pagos parciales y gastos fijos', () => {
  it('suma la salida prevista y deja el resto financiado sin inventar intereses ni pagar el resumen', () => {
    const data = snapshot({ expenses: [expense('alquiler', 200), expense('super', 80, 'card')], payments: [payment('p1', 50)] });
    const row = projectMonthlyCash(data, ['2026-11'])[0];
    expect(row.fixed.toAmount()).toBe(200);
    expect(row.paid.toAmount()).toBe(50); expect(row.cards.toAmount()).toBe(150);
    expect(row.cardBudgets.toAmount()).toBe(80); expect(row.total.toAmount()).toBe(400);
    const values = cardPlanAmounts(plan, data.payments);
    expect(values.outstanding.toAmount()).toBe(950); expect(values.financedAfterPlan?.toAmount()).toBe(800);
    expect(values.minimumRemaining?.toAmount()).toBe(50); expect(values.belowMinimum).toBe(false);
    expect(data.plans[0].total).toBe(1000); expect(data.payments).toHaveLength(1);
  });
  it('varios pagos parciales reducen el pendiente sin duplicarlos en el plan', () => {
    const data = snapshot({ plans: [{ ...plan, planned: 100 }], payments: [payment('p1', 30), payment('p2', 70)] });
    const row = projectMonthlyCash(data, ['2026-11'])[0];
    expect(row.total.toAmount()).toBe(100); expect(row.cards.isZero()).toBe(true);
    expect(cardPlanAmounts(data.plans[0], data.payments).financedAfterPlan?.toAmount()).toBe(900);
  });
  it('usa la fecha prevista real y descuenta pagos de meses anteriores', () => {
    const data = snapshot({ plans: [{ ...plan, plannedDate: '2026-12-02' }], payments: [payment('p1', 50, '2026-10-31')] });
    const rows = projectMonthlyCash(data, ['2026-11', '2026-12']);
    expect(cardPlanAmounts(data.plans[0], data.payments).afterDueDate).toBe(true);
    expect(rows[0].cards.isZero()).toBe(true); expect(rows[1].cards.toAmount()).toBe(150);
    expect(rows[1].paid.isZero()).toBe(true);
  });
  it('un pago inferior al mínimo queda visible y no se aumenta automáticamente', () => {
    const partial = { ...plan, planned: 70 };
    expect(cardPlanAmounts(partial, []).belowMinimum).toBe(true);
    expect(projectMonthlyCash(snapshot({ plans: [partial] }), ['2026-11'])[0].total.toAmount()).toBe(70);
    expect(cardPlanAmounts({ ...plan, planned: 0 }, []).financedAfterPlan?.toAmount()).toBe(1000);
  });
  it('no infiere el mínimo de una estimación ni transforma un pago sin decidir en cero confirmado', () => {
    const estimate = { ...plan, source: 'estimate' as const, minimum: null, planned: null, plannedDate: null };
    expect(cardPlanAmounts(estimate, []).minimumRemaining).toBeNull();
    expect(cardPlanAmounts(estimate, []).plannedRemaining).toBeNull();
    expect(projectMonthlyCash(snapshot({ plans: [estimate] }), ['2026-11'])[0].incomplete).toBe(true);
    expect(() => validateCardCashPlan({ ...plan, minimum: null })).toThrow();
  });
  it('reemplaza el presupuesto indicado por la factura y distribuye sus pagos por fecha', () => {
    const data = snapshot({ cards: [], plans: [], expenses: [expense('luz', 80)], bills: [{
      id: 'bill', description: 'Factura luz', amount: 100, date: '2026-10-20', dueDate: '2026-11-05',
      expenseId: 'luz', budgetMonth: '2026-10', scheduleRevision: 0, payments: [{ amount: 30, date: '2026-10-25' }]
    }] });
    const rows = projectMonthlyCash(data, ['2026-10', '2026-11']);
    expect(rows[0].fixed.isZero()).toBe(true); expect(rows[0].total.toAmount()).toBe(30);
    expect(rows[1].fixed.toAmount()).toBe(80); expect(rows[1].bills.toAmount()).toBe(70);
    expect(rows[1].total.toAmount()).toBe(150);
  });
  it('dos facturas del mismo gasto reemplazan una sola vez su estimación', () => {
    const bill = { description: 'Servicio', amount: 50, date: '2026-11-01', dueDate: '2026-11-10',
      expenseId: 'luz', budgetMonth: '2026-11', scheduleRevision: 0, payments: [] };
    const data = snapshot({ cards: [], plans: [], expenses: [expense('luz', 80)], bills: [{ ...bill, id: 'a' }, { ...bill, id: 'b' }] });
    expect(projectMonthlyCash(data, ['2026-11'])[0].total.toAmount()).toBe(100);
  });
  it('señala vencimientos, tarjetas y pagos sin asignar en lugar de prometer un total completo', () => {
    expect(projectMonthlyCash(snapshot({ plans: [] }), ['2026-11'])[0].incomplete).toBe(true);
    expect(projectMonthlyCash(snapshot({ payments: [{ ...payment('p', 50), allocations: [] }] }), ['2026-11'])[0].incomplete).toBe(true);
    expect(projectMonthlyCash(snapshot({ legacyReceipts: 1 }), ['2026-11'])[0].incomplete).toBe(true);
    expect(projectMonthlyCash(snapshot({ bills: [{ id: 'b', description: 'Gas', amount: 10, date: '2026-11-01',
      dueDate: null, expenseId: null, budgetMonth: null, scheduleRevision: 0, payments: [] }] }), ['2026-11'])[0].incomplete).toBe(true);
  });
  it('respeta proyecciones específicas, otros gastos y exclusión de presupuestos pausados', () => {
    const fixed = { ...expense('luz', 0.1), monthlyProjections: { 'Nov-26': 0.2 } };
    const other = { ...expense('otros', 0.1), expenseType: 'proyectado' as const };
    const paused = { ...expense('viejo', 100), status: 'pausado' as const };
    const row = projectMonthlyCash(snapshot({ cards: [], plans: [], expenses: [fixed, other, paused] }), ['2026-11'])[0];
    expect(row.total.toAmount()).toBe(0.3); expect(row.otherBudgets.toAmount()).toBe(0.1);
  });
  it('rechaza fechas, importes y contratos inválidos', () => {
    for (const invalid of [{ dueDate: '2026-11-31' }, { month: '2026-13' }, { total: Infinity }, { closingDate: null }, { closingDate: '2026-11-11' },
      { total: -1 }, { minimum: 1001 }, { planned: 1001 }, { planned: 20.001 }, { plannedDate: null }]) {
      expect(() => validateCardCashPlan({ ...plan, ...invalid })).toThrow();
    }
    expect(() => projectMonthlyCash({ ...snapshot(), version: 'future' } as unknown as MonthlyCashSnapshot, ['2026-11'])).toThrow();
  });
  it('desactivar una tarjeta conserva los pagos previstos y deja de exigir planes futuros nuevos', () => {
    const data = snapshot({ cards: [{ id: 'card', name: 'Tarjeta cerrada', closingDay: 25, dueDay: 10, active: false }] });
    const rows = projectMonthlyCash(data, ['2026-11', '2026-12']);
    expect(rows[0].cards.toAmount()).toBe(200);
    expect(rows[1].incomplete).toBe(false);
  });
});
