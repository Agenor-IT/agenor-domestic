import { supabase } from './supabaseClient';
import { IConsumptionRepository } from '../domain/repositories/IConsumptionRepository';
import { ConsumptionContract, ConsumptionProduct, ConsumptionSnapshot, PurchaseObservation, ShoppingItem } from '../domain/consumption/Consumption';

export class ConsumptionNotEnabledError extends Error {
  constructor() { super('Productos y consumo todavía no está habilitado en el backend.'); }
}
export function isConsumptionSchemaMissing(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202';
}
function check(error: { code?: string; message?: string } | null) {
  if (isConsumptionSchemaMissing(error)) throw new ConsumptionNotEnabledError();
  if (error) throw new Error(error.message || 'No se pudieron cargar productos y consumo.');
}
interface ProductRow { id: string; name: string; presentation: string; unit: string; kind: 'consumable' | 'durable'; }
interface PurchaseRow {
  id: string; product_id: string; raw_name: string; quantity: number | null; line_total: number | null;
  transaction_id: string; transaction_revision: number; line_number: number;
  product: ProductRow;
  transaction: { id: string; occurred_on: string; counterparty: string; op_number: string; status: string; revision: number; operation_type: string };
}

/** Paged reads, no bootstrap writes and no browser-local persistence. */
export async function fetchConsumptionProducts(personaPadreId: number): Promise<ConsumptionProduct[]> {
  const products: ConsumptionProduct[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('dom_consumption_products').select('id,name,presentation,unit,kind')
      .eq('persona_padre_id', personaPadreId).order('id').range(offset, offset + 499);
    check(error); products.push(...(data ?? []) as ConsumptionProduct[]);
    if ((data ?? []).length < 500) return products;
  }
}
export async function fetchPurchaseHistory(personaPadreId: number): Promise<PurchaseObservation[]> {
  const rows: PurchaseRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('dom_purchase_items')
      .select('id,product_id,raw_name,quantity,line_total,transaction_id,transaction_revision,line_number,product:dom_consumption_products!inner(id,name,presentation,unit,kind),transaction:dom_transactions!inner(id,occurred_on,counterparty,op_number,status,revision,operation_type)')
      .eq('persona_padre_id', personaPadreId).order('id').range(offset, offset + 499);
    check(error);
    const page = (data ?? []) as unknown as PurchaseRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows.filter(row => row.transaction.status === 'confirmed' && row.transaction.operation_type === 'compra' &&
    row.transaction.revision === row.transaction_revision)
    .sort((a, b) => a.transaction_id.localeCompare(b.transaction_id) || a.line_number - b.line_number)
    .map(row => ({ id: row.id, productId: row.product_id, rawName: row.raw_name,
      name: row.product.name, presentation: row.product.presentation, unit: row.product.unit, kind: row.product.kind,
      quantity: row.quantity === null ? null : Number(row.quantity), lineTotal: row.line_total === null ? null : Number(row.line_total),
      transactionId: row.transaction_id, date: row.transaction.occurred_on, supplier: row.transaction.counterparty,
      receiptNumber: row.transaction.op_number }));
}

export class SupabaseDomConsumptionRepository implements IConsumptionRepository {
  async getSnapshot(personaPadreId: number): Promise<ConsumptionSnapshot> {
    const { data: contract, error } = await supabase.rpc('dom_consumption_contract', { p_persona_padre_id: personaPadreId });
    check(error);
    if (!contract || contract.version !== 1 || contract.estimation !== 'purchase_intervals_v1' ||
      !Number.isInteger(contract.minimumPurchaseDays) || contract.minimumPurchaseDays < 2) throw new Error('Contrato de consumo no compatible.');
    const products = await fetchConsumptionProducts(personaPadreId), shopping: ShoppingItem[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('dom_shopping_items').select('id,product_id,quantity,note,checked,revision')
        .eq('persona_padre_id', personaPadreId).order('id').range(offset, offset + 499);
      check(error);
      for (const row of data ?? []) shopping.push({ id: row.id, productId: row.product_id,
        quantity: row.quantity === null ? null : Number(row.quantity), note: row.note, checked: row.checked, revision: row.revision });
      if ((data ?? []).length < 500) break;
    }
    return { contract: contract as ConsumptionContract, products, shopping, purchases: await fetchPurchaseHistory(personaPadreId) };
  }
  async createProduct(personaPadreId: number, product: Omit<ConsumptionProduct, 'id'>): Promise<void> {
    const { error } = await supabase.rpc('dom_create_consumption_product', { p_persona_padre_id: personaPadreId, p_product: product });
    check(error);
  }
  async saveShoppingItem(personaPadreId: number, item: ShoppingItem): Promise<void> {
    const { error } = await supabase.rpc('dom_save_shopping_item', { p_persona_padre_id: personaPadreId, p_item: item });
    check(error);
  }
  async deleteShoppingItem(personaPadreId: number, item: ShoppingItem): Promise<void> {
    const { error } = await supabase.rpc('dom_delete_shopping_item', { p_persona_padre_id: personaPadreId, p_id: item.id, p_expected_revision: item.revision });
    check(error);
  }
}
