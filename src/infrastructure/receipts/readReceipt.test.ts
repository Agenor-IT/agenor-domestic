import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readReceipt } from './readReceipt';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke } } }));
const draft = { supplier: 'Proveedor sintético', date: null, number: null, total: 120.50, currency: 'ARS', detail: 'Servicio de prueba' };

describe('Cliente de lectura de comprobantes', () => {
  beforeEach(() => invoke.mockReset());
  it('pasa la cancelación y recibe sólo datos validados', async () => {
    invoke.mockResolvedValue({ data: { draft }, error: null });
    const controller = new AbortController();
    expect(await readReceipt('synthetic-image', controller.signal)).toEqual(draft);
    expect(invoke).toHaveBeenCalledWith('dom-receipt', { body: { image: 'synthetic-image' }, signal: controller.signal, timeout: 50_000 });
  });
  it('muestra un error legible de lectura y no filtra el error del proveedor', async () => {
    invoke.mockResolvedValue({ error: { message: 'private diagnostics', context: new Response('{"code":"DOM_RECEIPT_UNREADABLE"}', { status: 422 }) } });
    await expect(readReceipt('synthetic-image')).rejects.toThrow('Sacá otra foto');
  });
  it('rechaza respuestas incompletas aunque el servidor responda éxito', async () => {
    invoke.mockResolvedValue({ data: { draft: {} }, error: null });
    await expect(readReceipt('synthetic-image')).rejects.toThrow();
  });
  it('traduce fallas de transporte sin incluir datos técnicos', async () => {
    invoke.mockResolvedValue({ error: { message: 'private diagnostics' } });
    await expect(readReceipt('synthetic-image')).rejects.toThrow('No se pudo conectar');
  });
});
