import { PurchaseItemInput } from '../consumption/Consumption.ts';

export interface ReceiptProductLine {
  name: string; presentation: string | null; unit: string | null;
  quantity: number | null; lineTotal: number | null; kind: 'consumable' | 'durable';
}
/** Extraction only: never authorizes a payment or an accounting entry. */
export interface ReceiptDraft {
  supplier: string | null;
  date: string | null;
  number: string | null;
  currency: string | null;
  total: number | null;
  detail: string | null;
  items?: ReceiptProductLine[];
}

export function parseReceiptDraft(value: unknown): ReceiptDraft {
  if (!value || typeof value !== 'object') throw new Error('No se pudo leer el comprobante.');
  const record = value as Record<string, unknown>;
  const text = (key: string, limit: number): string | null => {
    const field = record[key];
    if (field === null) return null;
    if (typeof field !== 'string' || field.length > limit) throw new Error('Lectura de comprobante inválida.');
    return field.trim() || null;
  };
  const date = text('date', 10);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) {
    throw new Error('La fecha detectada no es válida. Volvé a fotografiar el comprobante.');
  }
  const total = record.total;
  if (total !== null && (typeof total !== 'number' || !Number.isFinite(total) || total <= 0 ||
      !Number.isSafeInteger(Math.round(total * 100)) || Math.abs(total * 100 - Math.round(total * 100)) > 0.000001)) {
    throw new Error('El importe detectado no es válido. Volvé a fotografiar el comprobante.');
  }
  const currency = text('currency', 3);
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error('Moneda del comprobante inválida.');
  const result = { supplier: text('supplier', 300), date, number: text('number', 100), currency,
    total: total as number | null, detail: text('detail', 5000) };
  if (!result.supplier && !result.detail && !result.total) throw new Error('No se encontró un comprobante legible. Sacá otra foto con buena luz.');
  if (record.items === undefined) return result; // Compatibility with older OCR responses.
  if (!Array.isArray(record.items) || record.items.length > 100) throw new Error('Detalle de productos inválido.');
  const items: ReceiptProductLine[] = record.items.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Producto ilegible.');
    const item = entry as Record<string, unknown>;
    const text = (key: string, max: number): string | null => {
      if (item[key] === null) return null;
      if (typeof item[key] !== 'string' || String(item[key]).length > max) throw new Error('Producto inválido.');
      return String(item[key]).trim() || null;
    };
    const number = (key: string, decimals: number) => {
      const n = item[key];
      if (n === null) return null;
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 999_999_999 || key === 'quantity' && n === 0 ||
        Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 0.00001) throw new Error('Cantidad o importe de producto inválidos.');
      return n;
    };
    const name = text('name', 300);
    if (!name || !['consumable', 'durable'].includes(String(item.kind))) throw new Error('Producto inválido.');
    return { name, presentation: text('presentation', 120), unit: text('unit', 32),
      quantity: number('quantity', 3), lineTotal: number('lineTotal', 2), kind: item.kind as ReceiptProductLine['kind'] };
  });
  return { ...result, items };
}

export function receiptTransactionFields(draft: ReceiptDraft) {
  return {
    description: draft.detail ?? '',
    // Domestic records amounts in pesos. A foreign or unknown currency needs manual review.
    amount: draft.currency === 'ARS' ? draft.total ?? 0 : 0,
    counterparty: draft.supplier ?? '', occurredOn: draft.date ?? '', opNumber: draft.number ?? '',
    direction: 'expense' as const, operationType: 'compra' as const,
    paymentMethod: '', paymentCondition: 'cta_cte' as const,
    ...(draft.items?.length ? { purchaseItems: draft.items.map<PurchaseItemInput>(item => ({
      rawName: item.name, name: item.name, presentation: item.presentation ?? '', unit: item.unit ?? '',
      kind: item.kind, quantity: item.quantity, lineTotal: draft.currency === 'ARS' ? item.lineTotal : null
    })) } : {})
  };
}
