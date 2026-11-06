export type ProductKind = 'consumable' | 'durable';
export interface PurchaseItemInput {
  productId?: string;
  rawName: string;
  name: string;
  presentation: string;
  unit: string;
  kind: ProductKind;
  quantity: number | null;
  lineTotal: number | null;
}
export interface ConsumptionProduct {
  id: string; name: string; presentation: string; unit: string; kind: ProductKind;
}
export interface PurchaseObservation extends PurchaseItemInput {
  id: string; transactionId: string; date: string; supplier: string; receiptNumber: string;
}
export interface ShoppingItem {
  id: string; productId: string; quantity: number | null; note: string; checked: boolean; revision: number;
}
export interface ConsumptionContract {
  version: 1; estimation: 'purchase_intervals_v1'; minimumPurchaseDays: number;
}
export interface ConsumptionSnapshot {
  contract: ConsumptionContract;
  products: ConsumptionProduct[];
  purchases: PurchaseObservation[];
  shopping: ShoppingItem[];
}

export function validatePurchaseItems(value: unknown): PurchaseItemInput[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('El comprobante admite hasta 100 productos.');
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Renglón de compra inválido.');
    const row = entry as Record<string, unknown>;
    const text = (key: string, max: number, required = false): string => {
      if (typeof row[key] !== 'string' || String(row[key]).trim().length > max || required && !String(row[key]).trim()) {
        throw new Error('Completá producto, presentación y unidad con valores válidos.');
      }
      return String(row[key]).trim();
    };
    const number = (key: string, decimals: number, allowZero: boolean): number | null => {
      const field = row[key];
      if (field === null) return null;
      if (typeof field !== 'number' || !Number.isFinite(field) || (allowZero ? field < 0 : field <= 0) || field > 999_999_999 ||
        Math.abs(field * 10 ** decimals - Math.round(field * 10 ** decimals)) > 0.00001) {
        throw new Error(key === 'quantity' ? 'La cantidad debe ser positiva, con hasta 3 decimales, o quedar vacía.' : 'El importe del producto debe tener hasta 2 decimales o quedar vacío.');
      }
      return field;
    };
    if (!['consumable', 'durable'].includes(String(row.kind))) throw new Error('Tipo de producto inválido.');
    if (row.productId !== undefined && (typeof row.productId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.productId))) throw new Error('Producto vinculado inválido.');
    return {
      ...(row.productId ? { productId: String(row.productId) } : {}),
      rawName: text('rawName', 300, true), name: text('name', 300, true), presentation: text('presentation', 120),
      unit: text('unit', 32, true), kind: row.kind as ProductKind,
      quantity: number('quantity', 3, false), lineTotal: number('lineTotal', 2, true)
    };
  });
}

const day = (date: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time / 86_400_000 : null;
};
export interface PurchaseEstimate {
  purchaseDays: number; intervalCount: number; excludedIntervals: number;
  lastPurchaseDate: string | null; averageIntervalDays: number | null;
  dailyQuantity: number | null; nextPurchaseDate: string | null; suggestedQuantity: number | null;
}

/** V1: quantity from the PREVIOUS purchase / elapsed days until the next purchase.
 * The most recent quantity has no observed end date and is excluded from the rate.
 * No remaining-stock, actual-consumption or medical-use inference is made.
 */
export function estimatePurchases(product: ConsumptionProduct, purchases: PurchaseObservation[], today: string,
  horizonDays: number, contract: ConsumptionContract): PurchaseEstimate {
  if (contract.version !== 1 || contract.estimation !== 'purchase_intervals_v1' || !Number.isInteger(contract.minimumPurchaseDays) || contract.minimumPurchaseDays < 2) {
    throw new Error('Versión de estimación no compatible.');
  }
  if (day(today) === null || !Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365) throw new Error('Período de lista inválido.');
  const dates = new Map<string, { quantity: number; complete: boolean }>();
  const seen = new Set<string>();
  for (const item of purchases) {
    if (item.productId !== product.id || item.unit !== product.unit || item.presentation !== product.presentation ||
        day(item.date) === null || item.date > today || seen.has(item.id)) continue;
    seen.add(item.id);
    const previous = dates.get(item.date) ?? { quantity: 0, complete: true };
    const valid = item.quantity !== null && Number.isFinite(item.quantity) && item.quantity > 0;
    dates.set(item.date, { quantity: previous.quantity + (valid ? item.quantity! : 0), complete: previous.complete && valid });
  }
  const sorted = [...dates.entries()].sort(([a], [b]) => a.localeCompare(b));
  const result: PurchaseEstimate = { purchaseDays: sorted.length, intervalCount: 0, excludedIntervals: 0,
    lastPurchaseDate: sorted.at(-1)?.[0] ?? null, averageIntervalDays: null,
    dailyQuantity: null, nextPurchaseDate: null, suggestedQuantity: null };
  if (product.kind === 'durable' || sorted.length < contract.minimumPurchaseDays) return result;
  let quantities = 0, elapsed = 0, allDays = 0;
  for (let index = 0; index < sorted.length - 1; index++) {
    const [date, purchase] = sorted[index];
    const interval = day(sorted[index + 1][0])! - day(date)!;
    allDays += interval;
    if (!purchase.complete || !product.unit.trim()) { result.excludedIntervals++; continue; }
    quantities += purchase.quantity; elapsed += interval; result.intervalCount++;
  }
  result.averageIntervalDays = allDays / (sorted.length - 1);
  if (!elapsed || !quantities) return result;
  result.dailyQuantity = quantities / elapsed;
  const last = sorted.at(-1)!;
  if (last[1].complete) {
    const estimatedDay = day(last[0])! + Math.max(1, Math.round(last[1].quantity / result.dailyQuantity));
    if (!Number.isFinite(estimatedDay) || estimatedDay > day('9999-12-31')!) return result;
    result.nextPurchaseDate = new Date(estimatedDay * 86_400_000).toISOString().slice(0, 10);
    result.suggestedQuantity = Math.ceil(result.dailyQuantity * horizonDays * 1000) / 1000;
  }
  return result;
}
