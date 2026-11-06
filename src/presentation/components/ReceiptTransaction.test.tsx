import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TransactionModal } from './TransactionModal';
import { BottomNav } from './BottomNav';
import { receiptTransactionFields, ReceiptDraft } from '../../domain/receipts/ReceiptDraft';

vi.mock('../auth/DomesticAuthGate', () => ({ useDomesticAccess: () => ({ personaPadreId: 123 }) }));
vi.mock('../../infrastructure/SupabaseDomExpenseRepository', () => ({ SupabaseDomExpenseRepository: class {} }));
vi.mock('../../infrastructure/SupabaseDomVentureRepository', () => ({ SupabaseDomVentureRepository: class {} }));

const draft: ReceiptDraft = { supplier: 'Comercio sintético', date: '2026-10-20', number: '0001-00000001', total: 123.45, currency: 'ARS', detail: '2 unidades de prueba; IVA incluido' };
function renderDraft(receipt: ReceiptDraft) {
  return renderToStaticMarkup(<TransactionModal isOpen mode="nuevo" onClose={() => {}} onSubmit={async () => {}}
    paymentMethods={[]} accounts={[]} transactions={[]} initialData={receiptTransactionFields(receipt)} receiptDraft={receipt} />);
}
describe('Comprobante en el formulario existente', () => {
  it('presenta proveedor, fecha, número y detalle en una compra revisable', () => {
    const html = renderDraft(draft);
    for (const value of [draft.supplier!, draft.date!, draft.number!, draft.detail!, 'Datos leídos del comprobante', 'Seleccioná la condición de pago']) expect(html).toContain(value);
    expect(html).toContain('<textarea');
  });
  it('no inventa fecha ni número cuando no se pudieron leer', () => {
    const html = renderDraft({ ...draft, date: null, number: null });
    expect(/value="OP-[^"]*"/.test(html)).toBe(false);
    expect(html).toContain('type="date"');
    expect(html).not.toContain('value="2026-10-20"');
    expect(html).not.toContain('Imputa a Pasivo');
  });
  it('advierte moneda extranjera sin usar el total como pesos', () => {
    const html = renderDraft({ ...draft, currency: 'USD' });
    expect(html).toContain('USD'); expect(html).toContain('ingresá el valor en pesos');
    expect(html).not.toContain('value="123,45"');
  });
  it('presenta productos del OCR como renglones separados y editables', () => {
    const html = renderDraft({ ...draft, items: [
      { name: 'HUEVOS X12', presentation: '12 unidades', unit: 'paquete', quantity: 2, lineTotal: 1500, kind: 'consumable' },
      { name: 'LAVANDINA', presentation: '1 litro', unit: 'botella', quantity: null, lineTotal: null, kind: 'consumable' }
    ] });
    expect(html).toContain('Nombre producto 1'); expect(html).toContain('Nombre producto 2');
    expect(html).toContain('HUEVOS X12'); expect(html).toContain('LAVANDINA');
    expect(html).toContain('Cantidad producto 2'); expect(html).toContain('Agregar producto');
  });
  it('reemplaza el acceso móvil de revaluación por cámara y conserva voz', () => {
    const html = renderToStaticMarkup(<BottomNav currentTab="dashboard" onTabChange={() => {}} onNewAdjustment={() => {}}
      onOpenVoice={() => {}} voiceActive={false} voiceVisible={false} onOpenCamera={() => {}} onOpenMore={() => {}} moreOpen={false} />);
    expect(html).toContain('Fotografiar comprobante'); expect(html).toContain('Cámara'); expect(html).toContain('Voz');
    expect(html).not.toContain('Revaluación');
  });
});
