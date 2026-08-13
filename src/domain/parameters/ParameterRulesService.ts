import { Money } from '../shared/Money';

export class ParameterRulesService {
  /**
   * Ajuste de Alquiler: Base contractual $550.000 desde septiembre 2026.
   * Ajuste cada cuatro meses usando IPC acumulado (sin aumentos mensuales directos).
   */
  public static calculateRentAdjustments(
    baseRent: Money = Money.fromAmount(550000),
    ipcRates: number[], // IPC de cada mes
    periodCount: number
  ): Money[] {
    const rentValues: Money[] = [];

    // Ago-26 (mes 0): 450.000 (según datos reales del modelo)
    rentValues.push(Money.fromAmount(450000));

    // Sep-26 (mes 1) a Dic-26 (mes 4): Base contrato $550.000
    let currentRent = baseRent;
    for (let i = 1; i <= 4 && i < periodCount; i++) {
      rentValues.push(currentRent);
    }

    // A partir de Ene-27 (mes 5): Reajuste cuatrimestral por IPC acumulado de los 4 meses previos
    for (let i = 5; i < periodCount; i++) {
      if ((i - 1) % 4 === 0 && i > 4) {
        // Calcular IPC acumulado de los 4 meses anteriores (ej: i-4 a i-1)
        let accumulatedFactor = 1.0;
        for (let m = i - 4; m < i; m++) {
          accumulatedFactor *= 1 + (ipcRates[m] || 0.01);
        }
        currentRent = currentRent.multiplyByFactor(accumulatedFactor);
      }
      rentValues.push(currentRent);
    }

    return rentValues;
  }

  /**
   * Ajuste de Monotributo: Base actual $91.714,67.
   * Se mantiene fijo por semestre. Ajustes en enero y julio usando IPC acumulado del semestre anterior.
   */
  public static calculateMonotributoAdjustments(
    baseMonotributo: Money = Money.fromAmount(91714.67),
    ipcRates: number[],
    periodCount: number
  ): Money[] {
    const monotributoValues: Money[] = [];

    let currentFee = baseMonotributo;

    for (let i = 0; i < periodCount; i++) {
      // Meses 5 (Ene-27) y 11 (Jul-27) corresponden a ajustes semestrales
      if (i === 5 || i === 11) {
        // IPC acumulado de los 6 meses del semestre previo
        let accumulatedFactor = 1.0;
        const startMonth = i === 5 ? 0 : 5;
        for (let m = startMonth; m < i; m++) {
          accumulatedFactor *= 1 + (ipcRates[m] || 0.01);
        }
        currentFee = currentFee.multiplyByFactor(accumulatedFactor);
      }
      monotributoValues.push(currentFee);
    }

    return monotributoValues;
  }
}
