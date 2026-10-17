import { CashFlowProjectionService, FlowNode, ProjectionResult } from '../domain/cashflow/CashFlowProjectionService';
import { Money } from '../domain/shared/Money';
import { PaymentMethodType } from '../domain/shared/PaymentMethod';

export interface ProjectCashFlowInput {
  nodes: FlowNode[];
  selectedMethods: Record<string, PaymentMethodType>;
  openingBalance: number;
  periodCount: number;
}

export class ProjectCashFlowUseCase {
  public execute(input: ProjectCashFlowInput): {
    nodes: FlowNode[];
    projection: ProjectionResult;
  } {
    // Clonar nodos para no mutar original
    const nodes = JSON.parse(JSON.stringify(input.nodes)) as FlowNode[];

    const projection = CashFlowProjectionService.projectFullCashFlow(
      nodes,
      input.selectedMethods,
      Money.fromAmount(input.openingBalance),
      input.periodCount
    );

    const values: Record<string, Money[]> = {
      'flow-opening': projection.initial,
      'income-section': projection.income,
      'expense-section': projection.expense,
      'flow-net': projection.net,
      'flow-extra': projection.extraNeeded,
      'flow-final': projection.final
    };
    for (const node of nodes) {
      if (values[node.id]) node.origin = values[node.id].map(value => value.toAmount());
    }

    return {
      nodes,
      projection
    };
  }
}
