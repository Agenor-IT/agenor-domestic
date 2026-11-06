import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyCashNotEnabledError, SupabaseDomMonthlyCashRepository } from './SupabaseDomMonthlyCashRepository';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));
const repo = new SupabaseDomMonthlyCashRepository();
describe('Contrato de planificación mensual sin efectos contables', () => {
  beforeEach(() => rpc.mockReset());
  it('lee únicamente el snapshot autorizado y distingue contrato ausente de permisos', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(repo.getSnapshot(42)).rejects.toBeInstanceOf(MonthlyCashNotEnabledError);
    expect(rpc).toHaveBeenCalledWith('dom_monthly_cash_snapshot', { p_persona_padre_id: 42 });
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Acceso denegado' } });
    await expect(repo.getSnapshot(42)).rejects.toThrow('Acceso denegado');
  });
  it('no inventa un contrato cuando falta su versión o una colección', async () => {
    rpc.mockResolvedValue({ data: { version: 'other' }, error: null });
    await expect(repo.getSnapshot(42)).rejects.toThrow('contrato');
  });
  it('vincular o quitar un pago no invoca el RPC que registra asientos', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await repo.allocatePayment(42, 'plan', 'tx', 50, 0);
    await repo.allocatePayment(42, 'plan', 'tx', 0, 1);
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['dom_allocate_card_cash_payment', 'dom_allocate_card_cash_payment']);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_amount: 0, p_expected_revision: 1, p_persona_padre_id: 42 });
  });
  it('envía el mes del presupuesto explícito al asignar una factura', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await repo.scheduleBill(42, 'tx', '2026-11-05', '123', '2026-10', 2);
    expect(rpc).toHaveBeenCalledWith('dom_schedule_cash_bill', { p_persona_padre_id: 42, p_transaction_id: 'tx',
      p_due_date: '2026-11-05', p_expense_id: '123', p_budget_month: '2026-10-01', p_expected_revision: 2 });
  });
});
