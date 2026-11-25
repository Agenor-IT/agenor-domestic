import type { Creditor } from '../domain/creditor';

export interface CreditorRepository {
  list(): Promise<Creditor[]>;
  create(creditor: Creditor): Promise<void>;
}
