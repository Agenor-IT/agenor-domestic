import { DomExpenseReceipt } from '../domain/expenses/DomExpenseReceipt';
import { LocalDomExpenseReceiptRepository } from './LocalDomExpenseReceiptRepository';
import { supabase } from './supabaseClient';

type ReceiptInput = Omit<DomExpenseReceipt, 'id' | 'createdAt'> &
  Partial<Pick<DomExpenseReceipt, 'id' | 'createdAt'>>;

export interface ReceiptLoadResult {
  items: DomExpenseReceipt[];
  pendingSync: number;
}

const migratedKey = (personaPadreId: number) => `dom_expense_receipts_synced_${personaPadreId}`;
const isRemoteExpenseId = (id: string) => /^[1-9]\d*$/.test(id);

const toRow = (receipt: DomExpenseReceipt) => ({
  id: receipt.id,
  persona_padre_id: receipt.personaPadreId,
  expense_id: receipt.expenseId,
  amount: receipt.amount,
  payment_condition: receipt.paymentCondition,
  due_date: receipt.dueDate || null,
  notes: receipt.notes || null,
  created_at: receipt.createdAt,
});

const fromRow = (row: Record<string, unknown>): DomExpenseReceipt => ({
  id: String(row.id),
  personaPadreId: Number(row.persona_padre_id),
  expenseId: String(row.expense_id),
  amount: Number(row.amount),
  paymentCondition: row.payment_condition === 'cuenta_corriente' ? 'cuenta_corriente' : 'contado',
  dueDate: typeof row.due_date === 'string' ? row.due_date : undefined,
  notes: typeof row.notes === 'string' ? row.notes : undefined,
  createdAt: String(row.created_at),
});

export class SupabaseDomExpenseReceiptRepository {
  private readonly local = new LocalDomExpenseReceiptRepository();

  private readMigrated(personaPadreId: number): Set<string> {
    try {
      const stored = JSON.parse(localStorage.getItem(migratedKey(personaPadreId)) || '[]');
      return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private markMigrated(personaPadreId: number, id: string): void {
    try {
      const migrated = this.readMigrated(personaPadreId);
      migrated.add(id);
      localStorage.setItem(migratedKey(personaPadreId), JSON.stringify([...migrated]));
    } catch {
      // The server remains the source of truth; the local copy is kept as a backup.
    }
  }

  async list(personaPadreId: number): Promise<ReceiptLoadResult> {
    const local = this.local.list(personaPadreId);
    const migrated = this.readMigrated(personaPadreId);

    // Import once per browser origin. Ignore duplicates so stale local copies never overwrite server edits.
    for (const receipt of local) {
      if (migrated.has(receipt.id) || !isRemoteExpenseId(receipt.expenseId)) continue;
      const { error } = await supabase.from('dom_expense_receipts')
        .upsert(toRow(receipt), { onConflict: 'id', ignoreDuplicates: true });
      if (error) continue;
    }

    const { data, error } = await supabase.from('dom_expense_receipts')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('created_at', { ascending: false });

    if (error) return { items: local, pendingSync: local.length };

    const remote = (data || []).map(row => fromRow(row));
    const remoteIds = new Set(remote.map(receipt => receipt.id));
    local.forEach(receipt => {
      if (remoteIds.has(receipt.id)) this.markMigrated(personaPadreId, receipt.id);
    });
    const localOnly = local.filter(receipt => !remoteIds.has(receipt.id) && !migrated.has(receipt.id));
    return {
      items: [...remote, ...localOnly].sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
      pendingSync: localOnly.length,
    };
  }

  async save(input: ReceiptInput): Promise<{ receipt: DomExpenseReceipt; synced: boolean }> {
    const receipt: DomExpenseReceipt = {
      ...input,
      id: input.id || crypto.randomUUID(),
      createdAt: input.createdAt || new Date().toISOString(),
    };
    let localSaved = false;
    try {
      this.local.save(receipt);
      localSaved = true;
    } catch {
      // Continue with the account write when this browser has no local storage.
    }

    if (!isRemoteExpenseId(receipt.expenseId)) {
      if (!localSaved) throw new Error('No se pudo guardar el comprobante.');
      return { receipt, synced: false };
    }
    const { data, error } = await supabase.from('dom_expense_receipts')
      .upsert(toRow(receipt), { onConflict: 'id' })
      .select('*')
      .single();
    if (error || !data) {
      if (!localSaved) throw error || new Error('No se pudo guardar el comprobante.');
      return { receipt, synced: false };
    }
    this.markMigrated(receipt.personaPadreId, receipt.id);
    return { receipt: fromRow(data), synced: true };
  }

  async delete(id: string, personaPadreId: number): Promise<void> {
    const localOnly = this.local.list(personaPadreId).find(item => item.id === id && !isRemoteExpenseId(item.expenseId));
    if (localOnly) {
      this.local.delete(id, personaPadreId);
      return;
    }
    const { error } = await supabase.from('dom_expense_receipts')
      .delete()
      .eq('id', id)
      .eq('persona_padre_id', personaPadreId);
    if (error) throw error;
    this.markMigrated(personaPadreId, id);
    this.local.delete(id, personaPadreId);
  }
}
