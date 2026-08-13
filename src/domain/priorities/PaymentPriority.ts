export type PriorityEntityType = 'card' | 'expense' | 'tax' | 'mortgage' | 'loan';

export class PaymentPriority {
  public readonly id?: string;
  public readonly personaPadreId: number;
  public readonly entityType: PriorityEntityType;
  public readonly entityIdentifier: string;
  public readonly label: string;
  public priorityOrder: number;

  constructor(
    personaPadreId: number,
    entityType: PriorityEntityType,
    entityIdentifier: string,
    label: string,
    priorityOrder: number,
    id?: string
  ) {
    this.personaPadreId = personaPadreId;
    this.entityType = entityType;
    this.entityIdentifier = entityIdentifier;
    this.label = label;
    this.priorityOrder = priorityOrder;
    this.id = id;
  }

  public updatePriority(newOrder: number): void {
    if (newOrder < 1) {
      throw new Error('Priority order must be a positive integer');
    }
    this.priorityOrder = newOrder;
  }
}
