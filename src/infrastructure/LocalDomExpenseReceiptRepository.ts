import { DomExpenseReceipt } from '../domain/expenses/DomExpenseReceipt';

const storageKey = (personaPadreId: number) => `dom_expense_receipts_${personaPadreId}`;

export class LocalDomExpenseReceiptRepository {
  list(personaPadreId: number): DomExpenseReceipt[] {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey(personaPadreId)) || '[]');
      return Array.isArray(stored)
        ? stored.filter((item): item is DomExpenseReceipt =>
            item && typeof item.id === 'string' && item.personaPadreId === personaPadreId &&
            typeof item.expenseId === 'string' && Number.isFinite(item.amount))
        : [];
    } catch {
      return [];
    }
  }

  save(receipt: Omit<DomExpenseReceipt, 'id' | 'createdAt'> & Partial<Pick<DomExpenseReceipt, 'id' | 'createdAt'>>): DomExpenseReceipt {
    const saved: DomExpenseReceipt = {
      ...receipt,
      id: receipt.id || crypto.randomUUID(),
      createdAt: receipt.createdAt || new Date().toISOString()
    };
    const records = this.list(saved.personaPadreId);
    const index = records.findIndex(item => item.id === saved.id);
    if (index >= 0) records[index] = saved;
    else records.unshift(saved);
    localStorage.setItem(storageKey(saved.personaPadreId), JSON.stringify(records));
    return saved;
  }

  delete(id: string, personaPadreId: number): void {
    const records = this.list(personaPadreId).filter(item => item.id !== id);
    localStorage.setItem(storageKey(personaPadreId), JSON.stringify(records));
  }
}
