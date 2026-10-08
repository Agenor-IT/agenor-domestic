import { DomFixedAssetDTO } from '../assets/DomFixedAsset';

export interface IFixedAssetRepository {
  getFixedAssets(personaPadreId: number): Promise<DomFixedAssetDTO[]>;
  createFixedAsset(asset: Omit<DomFixedAssetDTO, 'id'>): Promise<DomFixedAssetDTO>;
  updateFixedAsset(id: string, updates: Partial<DomFixedAssetDTO>): Promise<DomFixedAssetDTO>;
  deleteFixedAsset(id: string): Promise<boolean>;
  recordDepreciationEntry(
    personaPadreId: number,
    assetId: string,
    amount: number,
    date: string,
    periodDescription: string
  ): Promise<{ success: boolean; entryNumber: number; message: string }>;
}
