export type DueRuleMode = 'day' | 'range' | 'last';

export class DueDateRule {
  public readonly mode: DueRuleMode;
  public readonly day: number;
  public readonly endDay: number;

  constructor(mode: DueRuleMode = 'day', day: number = 10, endDay: number = 10) {
    this.mode = mode;
    this.day = Math.max(1, Math.min(31, day));
    this.endDay = Math.max(this.day, Math.min(31, endDay));
  }

  public get label(): string {
    if (this.mode === 'last') return 'Último día del mes';
    if (this.mode === 'range') return `Día ${this.day} a ${this.endDay}`;
    return `Día ${this.day}`;
  }
}
