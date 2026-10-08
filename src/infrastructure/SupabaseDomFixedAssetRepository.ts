import { supabase } from './supabaseClient';
import { IFixedAssetRepository } from '../domain/repositories/IFixedAssetRepository';
import { DomFixedAssetDTO } from '../domain/assets/DomFixedAsset';
import { SupabaseDomAccountingRepository } from './SupabaseDomAccountingRepository';

const LOCAL_STORAGE_KEY = 'dom_fixed_assets_data';

export class SupabaseDomFixedAssetRepository implements IFixedAssetRepository {
  private accountingRepo = new SupabaseDomAccountingRepository();

  private getLocalAssets(): DomFixedAssetDTO[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    try {
      const parsed: DomFixedAssetDTO[] = JSON.parse(raw);
      let modified = false;
      const cleaned = parsed
        .filter(a => !['fa-1', 'fa-2', 'fa-3'].includes(a.id))
        .map(a => {
          if (!a.assetAccountId || a.assetAccountId < 30) {
            modified = true;
            if (a.category === 'vehiculos') {
              return { ...a, assetAccountId: 44, accumulatedDepreciationAccountId: 50, depreciationExpenseAccountId: 56 };
            } else if (a.category === 'inmuebles') {
              return { ...a, assetAccountId: 34, accumulatedDepreciationAccountId: 49, depreciationExpenseAccountId: 55 };
            } else {
              return { ...a, assetAccountId: 45, accumulatedDepreciationAccountId: 51, depreciationExpenseAccountId: 57 };
            }
          }
          return a;
        });

      if (cleaned.length !== parsed.length || modified) {
        this.saveLocalAssets(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  private saveLocalAssets(assets: DomFixedAssetDTO[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assets));
  }

  public async getFixedAssets(personaPadreId: number): Promise<DomFixedAssetDTO[]> {
    try {
      const { data, error } = await supabase
        .from('dom_fixed_assets')
        .select('*')
        .eq('persona_padre_id', personaPadreId);

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: String(row.id),
          personaPadreId: row.persona_padre_id,
          code: row.code,
          name: row.name,
          category: row.category,
          acquisitionDate: row.acquisition_date,
          acquisitionCost: Number(row.acquisition_cost),
          usefulLifeYears: Number(row.useful_life_years),
          residualValue: Number(row.residual_value || 0),
          accumulatedDepreciation: Number(row.accumulated_depreciation || 0),
          assetAccountId: Number(row.asset_account_id),
          accumulatedDepreciationAccountId: Number(row.accumulated_depreciation_account_id),
          depreciationExpenseAccountId: Number(row.depreciation_expense_account_id),
          location: row.location,
          notes: row.notes
        }));
      }
    } catch (e) {
      console.warn('Tabla dom_fixed_assets no disponible en Supabase, utilizando fallback local persistente.', e);
    }

    return this.getLocalAssets().filter(a => a.personaPadreId === personaPadreId);
  }

  public async createFixedAsset(asset: Omit<DomFixedAssetDTO, 'id'>): Promise<DomFixedAssetDTO> {
    const newId = `fa-${Date.now()}`;
    const fullAsset: DomFixedAssetDTO = { ...asset, id: newId };

    try {
      const { data, error } = await supabase
        .from('dom_fixed_assets')
        .insert({
          persona_padre_id: asset.personaPadreId,
          code: asset.code,
          name: asset.name,
          category: asset.category,
          acquisition_date: asset.acquisitionDate,
          acquisition_cost: asset.acquisitionCost,
          useful_life_years: asset.usefulLifeYears,
          residual_value: asset.residualValue,
          accumulated_depreciation: asset.accumulatedDepreciation,
          asset_account_id: asset.assetAccountId,
          accumulated_depreciation_account_id: asset.accumulatedDepreciationAccountId,
          depreciation_expense_account_id: asset.depreciationExpenseAccountId,
          location: asset.location,
          notes: asset.notes
        })
        .select()
        .single();

      if (!error && data) {
        fullAsset.id = String(data.id);
      }
    } catch (e) {
      console.warn('Falling back to local storage for createFixedAsset');
    }

    const current = this.getLocalAssets();
    current.push(fullAsset);
    this.saveLocalAssets(current);
    return fullAsset;
  }

  public async updateFixedAsset(id: string, updates: Partial<DomFixedAssetDTO>): Promise<DomFixedAssetDTO> {
    const assets = this.getLocalAssets();
    const idx = assets.findIndex(a => a.id === id);
    if (idx < 0) throw new Error('Bien de uso no encontrado');

    const updated = { ...assets[idx], ...updates };
    assets[idx] = updated;
    this.saveLocalAssets(assets);

    try {
      await supabase
        .from('dom_fixed_assets')
        .update({
          code: updated.code,
          name: updated.name,
          category: updated.category,
          acquisition_date: updated.acquisitionDate,
          acquisition_cost: updated.acquisitionCost,
          useful_life_years: updated.usefulLifeYears,
          residual_value: updated.residualValue,
          accumulated_depreciation: updated.accumulatedDepreciation,
          asset_account_id: updated.assetAccountId,
          accumulated_depreciation_account_id: updated.accumulatedDepreciationAccountId,
          depreciation_expense_account_id: updated.depreciationExpenseAccountId,
          location: updated.location,
          notes: updated.notes
        })
        .eq('id', id);
    } catch (e) {
      // Supabase ignore if fallback
    }

    return updated;
  }

  public async deleteFixedAsset(id: string): Promise<boolean> {
    const assets = this.getLocalAssets();
    const filtered = assets.filter(a => a.id !== id);
    this.saveLocalAssets(filtered);

    try {
      await supabase
        .from('dom_fixed_assets')
        .delete()
        .eq('id', id);
    } catch (e) {
      // Supabase ignore if fallback
    }

    return true;
  }

  public async recordDepreciationEntry(
    personaPadreId: number,
    assetId: string,
    amount: number,
    date: string,
    periodDescription: string
  ): Promise<{ success: boolean; entryNumber: number; message: string }> {
    const assets = await this.getFixedAssets(personaPadreId);
    const asset = assets.find(a => a.id === assetId);

    if (!asset) {
      throw new Error('No se encontró el bien de uso especificado.');
    }

    if (amount <= 0) {
      throw new Error('El monto de amortización debe ser mayor a cero.');
    }

    // Generar Asiento Contable
    // DEBE: Cuenta de Egreso (Amortizaciones del Ejercicio)
    // HABER: Cuenta Regularizadora (Amortización Acumulada)
    const result = await this.accountingRepo.recordJournalEntry({
      personaPadreId,
      entryDate: date,
      description: `Amortización ${periodDescription} - ${asset.code} ${asset.name}`,
      referenceId: `AMORT-${asset.code}-${date}`,
      lines: [
        {
          personaPadreId,
          accountId: asset.depreciationExpenseAccountId,
          debit: amount,
          credit: 0,
          memo: `Cargo Egreso Amortización ${asset.name}`
        },
        {
          personaPadreId,
          accountId: asset.accumulatedDepreciationAccountId,
          debit: 0,
          credit: amount,
          memo: `Amortización Acumulada ${asset.name}`
        }
      ]
    });

    if (result.success) {
      // Actualizar amortización acumulada del bien
      const nextAcc = asset.accumulatedDepreciation + amount;
      await this.updateFixedAsset(assetId, { accumulatedDepreciation: nextAcc });
    }

    return result;
  }
}
