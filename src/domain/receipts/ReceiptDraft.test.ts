import { describe, expect, it } from 'vitest';
import { parseReceiptDraft, receiptTransactionFields } from './ReceiptDraft';

const receipt = { supplier: 'Proveedor de prueba', date: '2026-10-20', number: '0001-00001234',
  currency: 'ARS', total: 12345.67, detail: 'Electricidad período 09/2026; consumo 150 kWh; total $12.345,67' };

describe('Comprobante a borrador de compra', () => {
  it('preserva número, fecha de emisión, total y detalle sin crear un pago', () => {
    const draft = parseReceiptDraft(receipt);
    expect(receiptTransactionFields(draft)).toEqual({ description: receipt.detail, amount: 12345.67,
      counterparty: receipt.supplier, occurredOn: receipt.date, opNumber: receipt.number,
      direction: 'expense', operationType: 'compra', paymentMethod: '', paymentCondition: 'cta_cte' });
  });
  it('deja vacíos los datos ilegibles, sin usar hoy ni generar un número de comprobante', () => {
    const draft = parseReceiptDraft({ ...receipt, date: null, number: null, total: null });
    expect(receiptTransactionFields(draft)).toMatchObject({ occurredOn: '', opNumber: '', amount: 0 });
  });
  it.each(['USD', null])('no convierte ni toma como pesos un total en %s', currency => {
    expect(receiptTransactionFields(parseReceiptDraft({ ...receipt, currency })).amount).toBe(0);
  });
  it.each([0, -1, 10.123, '12.345,67', Infinity, NaN])('rechaza importe inválido %s', total => {
    expect(() => parseReceiptDraft({ ...receipt, total })).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', '25/10/2026', '2026-02-29'])('rechaza fecha inexistente o ambigua %s', date => {
    expect(() => parseReceiptDraft({ ...receipt, date })).toThrow();
  });
  it('rechaza imagen sin datos y respuesta incompleta del proveedor', () => {
    expect(() => parseReceiptDraft({ supplier: null, date: null, number: null, currency: null, total: null, detail: null })).toThrow(/legible/);
    expect(() => parseReceiptDraft({})).toThrow();
  });
});
