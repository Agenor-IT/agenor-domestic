import { ITransactionRepository, TransactionDTO } from '../domain/repositories/ITransactionRepository';
import { supabase } from './supabaseClient';
import { Money } from '../domain/shared/Money';

export class SupabaseDomTransactionRepository implements ITransactionRepository {
  public async saveTransaction(
    tx: TransactionDTO,
    lines: { accountId: number; debit: number; credit: number; memo?: string }[],
    paymentMethodKind: 'cash' | 'bank' | 'card',
    paymentAccountId: number | null,
    expectedRevision: number
  ): Promise<TransactionDTO> {
    const id = tx.id || crypto.randomUUID();
    const { data, error } = await supabase.rpc('dom_post_transaction', {
      p_persona_padre_id: tx.personaPadreId,
      p_id: id,
      p_expected_revision: expectedRevision,
      p_transaction: {
        direction: tx.direction,
        amount: tx.amount.toAmount(),
        description: tx.description,
        occurred_on: tx.occurredOn,
        payment_method: tx.paymentMethod,
        payment_method_kind: paymentMethodKind,
        payment_account_id: paymentAccountId,
        op_number: tx.opNumber,
        counterparty: tx.counterparty,
        operation_type: tx.operationType,
        payment_condition: tx.paymentCondition || 'contado',
        settles_transaction_id: tx.settlesTransactionId || null,
        classification_account_id: tx.classificationAccountId || null
      },
      p_lines: lines.map(line => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo || ''
      }))
    });
    if (error || !data?.success) {
      throw new Error(error?.message || 'No se pudo registrar la operación y su asiento.');
    }
    return {
      ...tx,
      id,
      status: 'confirmed',
      revision: Number(data.revision),
      journalEntryId: Number(data.entry_id)
    };
  }

  public async voidTransaction(id: string, personaPadreId: number, expectedRevision: number): Promise<void> {
    const { data, error } = await supabase.rpc('dom_void_transaction', {
      p_persona_padre_id: personaPadreId,
      p_id: id,
      p_expected_revision: expectedRevision
    });
    if (error || !data?.success) {
      throw new Error(error?.message || 'No se pudo anular la operación.');
    }
  }

  public async getTransactionsByTenant(personaPadreId: number): Promise<TransactionDTO[]> {
    const rows: any[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('dom_transactions')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .neq('status', 'voided')
        .order('occurred_on', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error('No se pudieron cargar las operaciones: ' + error.message);
      rows.push(...(data || []));
      if ((data || []).length < pageSize) break;
    }
    return rows.map(item => ({
      id: item.id,
      personaPadreId: item.persona_padre_id,
      accountId: item.account_id,
      categoryId: item.category_id,
      direction: item.direction,
      amount: Money.fromAmount(item.amount),
      description: item.description,
      occurredOn: item.occurred_on,
      paymentMethod: item.payment_method,
      status: item.status,
      revision: Number(item.revision || 0),
      journalEntryId: item.journal_entry_id == null ? null : Number(item.journal_entry_id),
      opNumber: item.op_number,
      counterparty: item.counterparty,
      operationType: item.operation_type,
      paymentCondition: item.payment_condition,
      settlesTransactionId: item.settles_transaction_id,
      classificationAccountId: item.classification_account_id == null ? null : Number(item.classification_account_id)
    }));
  }
}
