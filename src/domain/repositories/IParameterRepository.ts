export interface IParameterRepository {
  getMonthlyParameters(personaPadreId: number): Promise<Record<string, number[]>>;
  saveMonthlyParameters(personaPadreId: number, params: Record<string, number[]>): Promise<void>;
}
