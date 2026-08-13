import { CashFlowProjectionService, FlowNode, ProjectionResult } from '../domain/cashflow/CashFlowProjectionService';
import { Money } from '../domain/shared/Money';
import { PaymentMethodType } from '../domain/shared/PaymentMethod';
import { ParameterRulesService } from '../domain/parameters/ParameterRulesService';

export interface ProjectCashFlowInput {
  nodes: FlowNode[];
  selectedMethods: Record<string, PaymentMethodType>;
  openingBalance: number;
  ipcRates: number[];
  periodCount: number;
}

export class ProjectCashFlowUseCase {
  public execute(input: ProjectCashFlowInput): {
    nodes: FlowNode[];
    projection: ProjectionResult;
  } {
    // Clonar nodos para no mutar original
    const nodes = JSON.parse(JSON.stringify(input.nodes)) as FlowNode[];

    // Recalcular Alquiler por IPC acumulado cuatrimestral
    const rentNode = this.findNodeById(nodes, 'income-rent');
    if (rentNode) {
      const calculatedRent = ParameterRulesService.calculateRentAdjustments(
        Money.fromAmount(550000),
        input.ipcRates,
        input.periodCount
      );
      rentNode.origin = calculatedRent.map(m => m.toAmount());
    }

    // Recalcular Monotributo por IPC acumulado semestral
    const monotributoCardNode = this.findNodeById(nodes, 'expense-tax-card');
    if (monotributoCardNode) {
      const calculatedTax = ParameterRulesService.calculateMonotributoAdjustments(
        Money.fromAmount(91714.67),
        input.ipcRates,
        input.periodCount
      );
      monotributoCardNode.origin = calculatedTax.map(m => m.toAmount());
    }

    const projection = CashFlowProjectionService.projectFullCashFlow(
      nodes,
      input.selectedMethods,
      Money.fromAmount(input.openingBalance),
      input.periodCount
    );

    return {
      nodes,
      projection
    };
  }

  private findNodeById(nodes: FlowNode[], id: string): FlowNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = this.findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }
}
