import { describe, it, expect } from 'vitest';
import { Money } from '../shared/Money';
import { CashFlowProjectionService, FlowNode } from './CashFlowProjectionService';
import { ParameterRulesService } from '../parameters/ParameterRulesService';

describe('Clean Architecture Domain & DDD Tests', () => {
  it('Money Value Object no debe sufrir de imprecisiones de flotante', () => {
    const m1 = Money.fromAmount(0.1);
    const m2 = Money.fromAmount(0.2);
    const sum = m1.add(m2);
    expect(sum.toAmount()).toBe(0.3);
    expect(sum.toFormattedString()).toContain('0,30');
  });

  it('Transferencia/Consumo con tarjeta traslada el egreso al mes siguiente (+1 mes)', () => {
    const origin = [Money.fromAmount(100), Money.fromAmount(200), Money.fromAmount(300)];
    const shifted = CashFlowProjectionService.shiftNextMonth(origin);
    expect(shifted[0].toAmount()).toBe(0);
    expect(shifted[1].toAmount()).toBe(100);
    expect(shifted[2].toAmount()).toBe(200);
  });

  it('Alquiler cuatrimestral debe mantenerse fijo 4 meses y luego ajustarse por IPC acumulado', () => {
    const ipcRates = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
    const rentValues = ParameterRulesService.calculateRentAdjustments(
      Money.fromAmount(550000),
      ipcRates,
      7
    );
    
    // Mes 0 (Ago-26): 450000 (real)
    expect(rentValues[0].toAmount()).toBe(450000);
    // Meses 1 a 4 (Sep a Dic 26): Base contrato 550000
    expect(rentValues[1].toAmount()).toBe(550000);
    expect(rentValues[4].toAmount()).toBe(550000);
    // Mes 5 (Ene-27): Reajuste por IPC acumulado 4 meses (1.01^4 ~ 1.04060401)
    const expectedEne = 550000 * Math.pow(1.01, 4);
    expect(Math.round(rentValues[5].toAmount())).toBe(Math.round(expectedEne));
  });

  it('Proyección completa de flujo propaga saldo final a inicial del mes siguiente', () => {
    const nodes: FlowNode[] = [
      {
        id: 'income-section',
        label: 'Ingresos',
        flowType: 'group',
        children: [
          {
            id: 'inc-1',
            label: 'Sueldo',
            flowType: 'income',
            defaultMethod: 'cash',
            origin: [1000, 1000]
          }
        ]
      },
      {
        id: 'expense-section',
        label: 'Egresos',
        flowType: 'group',
        children: [
          {
            id: 'exp-1',
            label: 'Gastos',
            flowType: 'expense',
            defaultMethod: 'cash',
            origin: [400, 1500]
          }
        ]
      }
    ];

    const result = CashFlowProjectionService.projectFullCashFlow(
      nodes,
      {},
      Money.fromAmount(500),
      2
    );

    // Mes 0: Inicial 500 + Ingreso 1000 - Egreso 400 = Neto 1100 (Final 1100, Extra 0)
    expect(result.initial[0].toAmount()).toBe(500);
    expect(result.final[0].toAmount()).toBe(1100);

    // Mes 1: Inicial 1100 + Ingreso 1000 - Egreso 1500 = Neto 600 (Final 600, Extra 0)
    expect(result.initial[1].toAmount()).toBe(1100);
    expect(result.final[1].toAmount()).toBe(600);
  });
});
