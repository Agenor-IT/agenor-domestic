import { supabase } from './supabaseClient';
import { IInventoryRepository } from '../domain/repositories/IInventoryRepository';
import { DomInventoryItemDTO, DomInventoryMovementDTO } from '../domain/inventory/DomInventoryItem';

const LOCAL_STORAGE_KEY = 'dom_inventory_items_data';

export class SupabaseDomInventoryRepository implements IInventoryRepository {

  private getLocalItems(): DomInventoryItemDTO[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    try {
      const parsed: DomInventoryItemDTO[] = JSON.parse(raw);
      const cleaned = parsed.filter(i => !['inv-1', 'inv-2', 'inv-3'].includes(i.id));
      if (cleaned.length !== parsed.length) {
        this.saveLocalItems(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  private saveLocalItems(items: DomInventoryItemDTO[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  }

  public async getInventoryItems(personaPadreId: number): Promise<DomInventoryItemDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_inventory_items')
        .select('*')
        .eq('persona_padre_id', personaPadreId);

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: String(row.id),
          personaPadreId: row.persona_padre_id,
          sku: row.sku,
          name: row.name,
          category: row.category,
          unitMeasure: row.unit_measure,
          currentStock: Number(row.current_stock),
          minimumStock: Number(row.minimum_stock),
          unitCost: Number(row.unit_cost),
          sellingPrice: Number(row.selling_price),
          inventoryAccountId: Number(row.inventory_account_id),
          cogsAccountId: Number(row.cogs_account_id),
          salesAccountId: Number(row.sales_account_id),
          movements: []
        }));
      }
    } catch (e) {
      console.warn('Tabla dom_inventory_items no disponible en Supabase, utilizando fallback local persistente.', e);
    }

    return this.getLocalItems().filter(i => i.personaPadreId === personaPadreId);
  }

  public async createInventoryItem(item: Omit<DomInventoryItemDTO, 'id'>): Promise<DomInventoryItemDTO> {
    const newId = `inv-${Date.now()}`;
    const fullItem: DomInventoryItemDTO = { ...item, id: newId, movements: [] };

    try {
      const { data, error } = await supabase
        .from('dom_inventory_items')
        .insert({
          persona_padre_id: item.personaPadreId,
          sku: item.sku,
          name: item.name,
          category: item.category,
          unit_measure: item.unitMeasure,
          current_stock: item.currentStock,
          minimum_stock: item.minimumStock,
          unit_cost: item.unitCost,
          selling_price: item.sellingPrice,
          inventory_account_id: item.inventoryAccountId,
          cogs_account_id: item.cogsAccountId,
          sales_account_id: item.salesAccountId
        })
        .select()
        .single();

      if (!error && data) {
        fullItem.id = String(data.id);
      }
    } catch (e) {
      console.warn('Falling back to local storage for createInventoryItem');
    }

    const current = this.getLocalItems();
    current.push(fullItem);
    this.saveLocalItems(current);
    return fullItem;
  }

  public async updateInventoryItem(id: string, updates: Partial<DomInventoryItemDTO>): Promise<DomInventoryItemDTO> {
    const items = this.getLocalItems();
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Artículo de inventario no encontrado');

    const updated = { ...items[idx], ...updates };
    items[idx] = updated;
    this.saveLocalItems(items);

    try {
      await supabase
        .from('dom_inventory_items')
        .update({
          sku: updated.sku,
          name: updated.name,
          category: updated.category,
          unit_measure: updated.unitMeasure,
          current_stock: updated.currentStock,
          minimum_stock: updated.minimumStock,
          unit_cost: updated.unitCost,
          selling_price: updated.sellingPrice,
          inventory_account_id: updated.inventoryAccountId,
          cogs_account_id: updated.cogsAccountId,
          sales_account_id: updated.salesAccountId
        })
        .eq('id', id);
    } catch (e) {
      // Supabase ignore if fallback
    }

    return updated;
  }

  public async deleteInventoryItem(id: string): Promise<boolean> {
    const items = this.getLocalItems();
    const filtered = items.filter(i => i.id !== id);
    this.saveLocalItems(filtered);

    try {
      await supabase
        .from('dom_inventory_items')
        .delete()
        .eq('id', id);
    } catch (e) {
      // Supabase ignore if fallback
    }

    return true;
  }

  public async recordStockMovement(
    personaPadreId: number,
    movement: Omit<DomInventoryMovementDTO, 'id'>,
    paymentAccountId: number
  ): Promise<{ success: boolean; entryNumber?: number; message: string }> {
    // Inventario local y Libro Diario remoto no comparten una transacción de base.
    void personaPadreId; void movement; void paymentAccountId;
    throw new Error('Compras y ventas de stock están pausadas hasta contar con un registro atómico de stock y asiento. El catálogo local se conserva.');
  }
}
