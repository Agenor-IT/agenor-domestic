export type InventoryMovementType = 'purchase' | 'sale' | 'adjustment_positive' | 'adjustment_negative';

export interface DomInventoryMovementDTO {
  id: string;
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  journalEntryId?: number;
}

export interface DomInventoryItemDTO {
  id: string;
  personaPadreId: number;
  sku: string;
  name: string;
  category: string;
  unitMeasure: string; // p.ej. 'Unidades', 'Kg', 'Lts', 'Cajas'
  currentStock: number;
  minimumStock: number;
  unitCost: number; // Costo unitario de reposición/compra ($)
  sellingPrice: number; // Precio de venta unitario ($)
  inventoryAccountId: number; // Cuenta Activo Corriente (ej. 1.1.03.01 Mercaderías de Reventa)
  cogsAccountId: number; // Cuenta Egreso CMV (ej. 5.1.01.01 Costo Mercaderías Vendidas)
  salesAccountId: number; // Cuenta Ingreso Venta (ej. 4.1.01.01 Ventas de Mercaderías)
  movements?: DomInventoryMovementDTO[];
}

export class DomInventoryItem {
  constructor(public readonly data: DomInventoryItemDTO) {}

  /**
   * Valor total del inventario a costo ($)
   */
  public get totalValuation(): number {
    return Math.max(0, this.data.currentStock * this.data.unitCost);
  }

  /**
   * Indicador de alerta de stock bajo
   */
  public get isLowStock(): boolean {
    return this.data.currentStock <= this.data.minimumStock;
  }
}
