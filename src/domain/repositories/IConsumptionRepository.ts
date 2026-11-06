import { ConsumptionProduct, ConsumptionSnapshot, ShoppingItem } from '../consumption/Consumption';

export interface IConsumptionRepository {
  getSnapshot(personaPadreId: number): Promise<ConsumptionSnapshot>;
  createProduct(personaPadreId: number, product: Omit<ConsumptionProduct, 'id'>): Promise<void>;
  saveShoppingItem(personaPadreId: number, item: ShoppingItem): Promise<void>;
  deleteShoppingItem(personaPadreId: number, item: ShoppingItem): Promise<void>;
}
