import { ITransactionRepository, TransactionDTO, PURCHASE_DUE_DATE_CONTRACT } from '../domain/repositories/ITransactionRepository';
import { supabase } from './supabaseClient';
import { Money } from '../domain/shared/Money';
import { ConsumptionNotEnabledError, fetchPurchaseHistory } from './SupabaseDomConsumptionRepository';
import { validatePurchaseItems, PurchaseObservation } from '../domain/consumption/Consumption';
import { validPlanDate } from '../domain/cashflow/MonthlyCashPlan';

export class SupabaseDomTransactionRepository implements ITransactionRepository {
  public async saveTransaction(
    tx: TransactionDTO,
    lines: { accountId: number; debit: number; credit: number; memo?: string }[],
    paymentMethodKind: 'cash' | 'bank' | 'card',
    paymentAccountId: number | null,
    expectedRevision: number
  ): Promise<TransactionDTO> {
    const id = tx.id || crypto.randomUUID();
    const purchaseItems = tx.purchaseItems === undefined ? undefined : validatePurchaseItems(tx.purchaseItems);
    const withDueDate = tx.billDueDate !== undefined;
    if (withDueDate && (tx.operationType !== 'compra' || tx.paymentCondition !== 'cta_cte' ||
        tx.billDueDate !== null && (typeof tx.billDueDate !== 'string' || !validPlanDate(tx.billDueDate)) ||
        !Number.isInteger(tx.billScheduleRevision ?? 0) || (tx.billScheduleRevision ?? 0) < 0)) {
      throw new Error('Revisá el vencimiento de la factura pendiente.');
    }
    if (purchaseItems !== undefined && tx.operationType !== 'compra') throw new Error('El detalle de productos sólo corresponde a compras.');
    const { data, error } = await supabase.rpc(withDueDate ? 'dom_post_purchase_with_due_date'
      : purchaseItems === undefined ? 'dom_post_transaction' : 'dom_post_purchase_transaction', {
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
      ...(purchaseItems === undefined && !withDueDate ? {} : { p_purchase_items: purchaseItems ?? [] }),
      ...(withDueDate ? { p_due_date: tx.billDueDate,
        p_expected_schedule_revision: tx.billScheduleRevision ?? 0 } : {}),
      p_lines: lines.map(line => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo || ''
      }))
    });
    if (error || !data?.success) {
      if (withDueDate && error?.code === 'PGRST202') {
        throw new Error('El backend todavía no permite guardar factura y vencimiento juntos. La operación no se guardó.');
      }
      if (purchaseItems !== undefined && error?.code === 'PGRST202') throw new ConsumptionNotEnabledError();
      throw new Error(error?.message || 'No se pudo registrar la operación y su asiento.');
    }
    if (withDueDate && (data.contract_version !== PURCHASE_DUE_DATE_CONTRACT ||
        data.bill_due_date !== tx.billDueDate || !Number.isInteger(data.bill_schedule_revision) || data.bill_schedule_revision < 0)) {
      throw new Error('El contrato de vencimientos no es compatible. Actualizá antes de reintentar.');
    }
    return {
      ...tx,
      id,
      status: 'confirmed',
      revision: Number(data.revision),
      journalEntryId: Number(data.entry_id),
      ...(withDueDate ? { billDueDate: data.bill_due_date, billScheduleRevision: data.bill_schedule_revision } : {})
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
    let history: PurchaseObservation[] | undefined;
    try { history = await fetchPurchaseHistory(personaPadreId); }
    catch (error) { if (!(error instanceof ConsumptionNotEnabledError)) throw error; }
    const schedules = new Map<string, { transaction_revision: number; due_date: string; revision: number }>();
    if (rows.some(row => row.operation_type === 'compra' && row.payment_condition === 'cta_cte')) {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('dom_cash_bill_schedule')
          .select('transaction_id,transaction_revision,due_date,revision').eq('persona_padre_id', personaPadreId)
          .order('transaction_id').range(offset, offset + pageSize - 1);
        if (error) throw new Error('No se pudieron cargar los vencimientos de las operaciones.');
        for (const schedule of data ?? []) schedules.set(schedule.transaction_id, schedule);
        if ((data ?? []).length < pageSize) break;
      }
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
      classificationAccountId: item.classification_account_id == null ? null : Number(item.classification_account_id),
      ...(item.operation_type === 'compra' && item.payment_condition === 'cta_cte' ? {
        billDueDate: schedules.get(item.id)?.transaction_revision === item.revision ? schedules.get(item.id)!.due_date : null,
        billScheduleRevision: schedules.get(item.id)?.transaction_revision === item.revision ? schedules.get(item.id)!.revision : 0
      } : {}),
      ...(history === undefined || item.operation_type !== 'compra' ? {} : {
        purchaseItems: history.filter(row => row.transactionId === item.id).map(row => ({
          productId: row.productId, rawName: row.rawName, name: row.name, presentation: row.presentation,
          unit: row.unit, kind: row.kind, quantity: row.quantity, lineTotal: row.lineTotal
        }))
      })
    }));
  }
}
