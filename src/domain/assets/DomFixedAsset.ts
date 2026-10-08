export type FixedAssetCategory = 'inmuebles' | 'vehiculos' | 'tecnologia' | 'muebles' | 'maquinaria' | 'instalaciones';

export interface DomFixedAssetDTO {
  id: string;
  personaPadreId: number;
  code: string;
  name: string;
  category: FixedAssetCategory;
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionCost: number; // Valor de Origen ($)
  usefulLifeYears: number; // Vida útil estimada en años
  residualValue: number; // Valor de rescate ($)
  accumulatedDepreciation: number; // Amortización acumulada histórica ($)
  assetAccountId: number; // Cuenta Activo (ej. 1.2.01.03 Equipos Informáticos)
  accumulatedDepreciationAccountId: number; // Cuenta Regularizadora (ej. 1.2.02.01)
  depreciationExpenseAccountId: number; // Cuenta Egreso (ej. 5.1.04.01)
  location?: string;
  notes?: string;
}

export class DomFixedAsset {
  constructor(public readonly data: DomFixedAssetDTO) {}

  /**
   * Cuota de amortización anual lineal
   */
  public get annualDepreciation(): number {
    if (this.data.usefulLifeYears <= 0) return 0;
    const depreciableBase = Math.max(0, this.data.acquisitionCost - this.data.residualValue);
    return depreciableBase / this.data.usefulLifeYears;
  }

  /**
   * Valor Neto en Libros actual ($)
   */
  public get netBookValue(): number {
    return Math.max(0, this.data.acquisitionCost - this.data.accumulatedDepreciation);
  }

  /**
   * Porcentaje de amortización transcurrido (0% - 100%)
   */
  public get depreciationPercentage(): number {
    if (this.data.acquisitionCost <= 0) return 0;
    const pct = (this.data.accumulatedDepreciation / this.data.acquisitionCost) * 100;
    return Math.min(100, Math.max(0, pct));
  }
}
