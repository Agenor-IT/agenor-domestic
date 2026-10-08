import { DomVentureDTO } from '../ventures/DomVenture';

export interface IVentureRepository {
  getVentures(personaPadreId: number): Promise<DomVentureDTO[]>;
  saveVenture(venture: Partial<DomVentureDTO>, personaPadreId: number): Promise<DomVentureDTO>;
  deleteVenture(id: string, personaPadreId: number): Promise<void>;
}
