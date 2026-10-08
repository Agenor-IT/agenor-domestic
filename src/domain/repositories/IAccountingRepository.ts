export interface DomAccountDTO {
  id: number;
  personaPadreId: number;
  code: string;
  name: string;
  kind: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cash' | 'bank' | 'wallet' | 'card';
  nature: 'debit' | 'credit';
  subrubro?: string;
  openingBalance: number;
  currentBalance: number;
  color: string;
  isArchived: boolean;
}

export interface DomJournalLineDTO {
  id?: number;
  personaPadreId: number;
  journalEntryId?: number;
  accountId: number;
  accountName?: string;
  accountCode?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface DomJournalEntryDTO {
  id?: number;
  personaPadreId: number;
  entryNumber: number;
  entryDate: string;
  description: string;
  referenceId?: string;
  lines: DomJournalLineDTO[];
}

export interface DomFiscalYearDTO {
  id: number;
  personaPadreId: number;
  year: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  openingEntryId?: number | null;
  closingEntryId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IAccountingRepository {
  getAccounts(personaPadreId: number): Promise<DomAccountDTO[]>;
  createAccount(account: Omit<DomAccountDTO, 'id'>): Promise<DomAccountDTO>;
  getJournalEntries(personaPadreId: number): Promise<DomJournalEntryDTO[]>;
  recordJournalEntry(entry: Omit<DomJournalEntryDTO, 'entryNumber'>): Promise<{ success: boolean; entryNumber: number; message: string }>;
  getFiscalYears(personaPadreId: number): Promise<DomFiscalYearDTO[]>;
  createFiscalYear(fiscalYear: Omit<DomFiscalYearDTO, 'id'>): Promise<DomFiscalYearDTO>;
  recordOpeningEntry(personaPadreId: number, fiscalYearId: number, year: number): Promise<{ success: boolean; entryNumber: number; message: string }>;
  updateAccountOpeningBalances(personaPadreId: number, balances: { accountId: number; openingBalance: number }[]): Promise<void>;
  updateAccount(account: DomAccountDTO): Promise<DomAccountDTO>;
  deleteAccount(personaPadreId: number, accountId: number): Promise<void>;
  closeFiscalYear(personaPadreId: number, fiscalYearId: number, year: number): Promise<{ success: boolean; entryNumber: number; message: string }>;
}

