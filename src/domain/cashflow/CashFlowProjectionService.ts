import { Money } from '../shared/Money';
import { PaymentMethodType } from '../shared/PaymentMethod';

export interface FlowNode {
  id: string;
  label: string;
  flowType: 'income' | 'expense' | 'group' | 'initialBalance' | 'net' | 'extraNeeded' | 'finalBalance' | 'info' | 'derivedCardImpact';
  defaultMethod?: PaymentMethodType;
  allowedMethods?: PaymentMethodType[];
  cardConsumption?: boolean;
  origin?: number[];
  infoValues?: number[];
  status?: 'current' | 'arrears' | '';
  note?: string;
  children?: FlowNode[];
}

export interface ProjectionResult {
  initial: Money[];
  income: Money[];
  expense: Money[];
  net: Money[];
  extraNeeded: Money[];
  final: Money[];
}

export class CashFlowProjectionService {
  /**
   * Calcula el traslado de consumo con tarjeta (+1 mes)
   */
  public static shiftNextMonth(values: Money[]): Money[] {
    const result: Money[] = [Money.zero()];
    for (let i = 0; i < values.length - 1; i++) {
      result.push(values[i]);
    }
    return result;
  }

  /**
   * Calcula el impacto automático de consumos con tarjeta desde los egresos que usan tarjeta
   */
  public static calculateCardImpactFromNodes(
    nodes: FlowNode[],
    selectedMethods: Record<string, PaymentMethodType>,
    periodCount: number
  ): Money[] {
    let cardImpact = Array.from({ length: periodCount }, () => Money.zero());

    const traverse = (node: FlowNode) => {
      if (node.flowType === 'expense' && node.cardConsumption && node.origin) {
        const method = selectedMethods[node.id] || node.defaultMethod || 'cash';
        if (method === 'card') {
          const originMoney = node.origin.map(v => Money.fromAmount(v));
          const shifted = this.shiftNextMonth(originMoney);
          cardImpact = cardImpact.map((val, idx) => val.add(shifted[idx] || Money.zero()));
        }
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return cardImpact;
  }

  /**
   * Calcula los valores de un nodo de flujo individual considerando su medio de pago seleccionado
   */
  public static calculateNodeValues(
    node: FlowNode,
    selectedMethods: Record<string, PaymentMethodType>,
    cardImpactValues: Money[],
    periodCount: number
  ): Money[] {
    if (node.flowType === 'income' || node.flowType === 'expense') {
      const originMoney = (node.origin || []).map(v => Money.fromAmount(v));
      const method = selectedMethods[node.id] || node.defaultMethod || 'cash';
      return method === 'card' ? this.shiftNextMonth(originMoney) : originMoney;
    }

    if (node.flowType === 'info') {
      return (node.infoValues || []).map(v => Money.fromAmount(v));
    }

    if (node.flowType === 'derivedCardImpact') {
      return cardImpactValues;
    }

    if (node.flowType === 'group' && node.children) {
      let groupSum = Array.from({ length: periodCount }, () => Money.zero());
      node.children.forEach(child => {
        if (child.flowType !== 'info' && child.flowType !== 'derivedCardImpact') {
          const childValues = this.calculateNodeValues(child, selectedMethods, cardImpactValues, periodCount);
          groupSum = groupSum.map((val, idx) => val.add(childValues[idx] || Money.zero()));
        }
      });
      return groupSum;
    }

    return Array.from({ length: periodCount }, () => Money.zero());
  }

  /**
   * Genera el estado financiero proyectado completo (Saldo Inicial -> Neto -> Extra -> Final)
   */
  public static projectFullCashFlow(
    nodes: FlowNode[],
    selectedMethods: Record<string, PaymentMethodType>,
    openingBalance: Money,
    periodCount: number
  ): ProjectionResult {
    const cardImpact = this.calculateCardImpactFromNodes(nodes, selectedMethods, periodCount);

    const incomeNode = nodes.find(n => n.id === 'income-section');
    const expenseNode = nodes.find(n => n.id === 'expense-section');

    const incomeMoney = incomeNode
      ? this.calculateNodeValues(incomeNode, selectedMethods, cardImpact, periodCount)
      : Array.from({ length: periodCount }, () => Money.zero());

    const expenseMoney = expenseNode
      ? this.calculateNodeValues(expenseNode, selectedMethods, cardImpact, periodCount)
      : Array.from({ length: periodCount }, () => Money.zero());

    const initial: Money[] = [];
    const net: Money[] = [];
    const extraNeeded: Money[] = [];
    const final: Money[] = [];

    for (let i = 0; i < periodCount; i++) {
      const currentInitial = i === 0 ? openingBalance : final[i - 1];
      initial.push(currentInitial);

      const currentNet = currentInitial.add(incomeMoney[i]).subtract(expenseMoney[i]);
      net.push(currentNet);

      const currentExtra = currentNet.isNegative()
        ? Money.fromAmount(Math.abs(currentNet.toAmount()))
        : Money.zero();
      extraNeeded.push(currentExtra);

      const currentFinal = currentNet.add(currentExtra);
      final.push(currentFinal);
    }

    return {
      initial,
      income: incomeMoney,
      expense: expenseMoney,
      net,
      extraNeeded,
      final
    };
  }
}
