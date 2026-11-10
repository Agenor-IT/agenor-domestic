import { describe, expect, it } from 'vitest';
import { parseReceiptDraft, receiptTransactionFields } from './ReceiptDraft';
const receipt={supplier:'Comercio sintético',date:'2026-10-26',number:'0001-01',currency:'ARS',total:100,detail:'Servicio'};
describe('Vencimiento leído del comprobante',()=>{
  it('separa emisión y vencimiento y lleva la fecha explícita al formulario',()=>{
    const fields=receiptTransactionFields(parseReceiptDraft({...receipt,dueDate:'2026-11-10'}));
    expect(fields.occurredOn).toBe('2026-10-26');expect(fields.billDueDate).toBe('2026-11-10');
  });
  it('mantiene compatibilidad con respuestas anteriores y no infiere una fecha',()=>{
    expect(parseReceiptDraft(receipt)).not.toHaveProperty('dueDate');
    expect(receiptTransactionFields(parseReceiptDraft({...receipt,detail:'Vence dentro de 10 días',dueDate:null})).billDueDate).toBeNull();
  });
  it.each(['2026-02-30','10/11/2026',123])('rechaza vencimiento inválido %s',dueDate=>{
    expect(()=>parseReceiptDraft({...receipt,dueDate})).toThrow();
  });
});
