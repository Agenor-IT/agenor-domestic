import { DomInventoryItemDTO, DomInventoryMovementDTO } from '../inventory/DomInventoryItem';

export interface IInventoryRepository {
  getInventoryItems(personaPadreId: number): Promise<DomInventoryItemDTO[]>;
  createInventoryItem(item: Omit<DomInventoryItemDTO, 'id'>): Promise<DomInventoryItemDTO>;
  updateInventoryItem(id: string, updates: Partial<DomInventoryItemDTO>): Promise<DomInventoryItemDTO>;
  deleteInventoryItem(id: string): Promise<boolean>;
  recordStockMovement(
    personaPadreId: number,
    movement: Omit<DomInventoryMovementDTO, 'id'>,
    paymentAccountId: number // Cuenta de tesorería elegida explícitamente
  ): Promise<{ success: boolean; entryNumber?: number; message: string }>;
}
