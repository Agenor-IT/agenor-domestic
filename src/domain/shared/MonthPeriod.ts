export class MonthPeriod {
  public readonly period: string; // e.g. "Ago-26"
  public readonly index: number;

  public static readonly DEFAULT_MONTHS = [
    "Ago-26", "Sep-26", "Oct-26", "Nov-26", "Dic-26",
    "Ene-27", "Feb-27", "Mar-27", "Abr-27", "May-27",
    "Jun-27", "Jul-27", "Ago-27", "Sep-27", "Oct-27",
    "Nov-27", "Dic-27"
  ];

  constructor(period: string, index?: number) {
    this.period = period;
    this.index = index ?? MonthPeriod.DEFAULT_MONTHS.indexOf(period);
  }

  public get year(): number {
    const parts = this.period.split('-');
    return 2000 + parseInt(parts[1] || '26', 10);
  }

  public get monthIndex0(): number {
    const monthNames: Record<string, number> = {
      Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5,
      Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11
    };
    const parts = this.period.split('-');
    return monthNames[parts[0]] ?? 0;
  }
}
