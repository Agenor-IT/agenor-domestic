import { ITransactionRepository, TransactionDTO } from '../domain/repositories/ITransactionRepository';
import { supabase } from './supabaseClient';
import { Money } from '../domain/shared/Money';

export class SupabaseDomTransactionRepository implements ITransactionRepository {
  public async createTransaction(tx: TransactionDTO): Promise<TransactionDTO> {
    const { data, error } = await supabase
      .from('dom_transactions')
      .insert({
        persona_padre_id: tx.personaPadreId,
        account_id: tx.accountId,
        category_id: tx.categoryId,
        direction: tx.direction,
        amount: tx.amount.toAmount(),
        description: tx.description,
        occurred_on: tx.occurredOn,
        payment_method: tx.paymentMethod,
        status: tx.status,
        op_number: tx.opNumber,
        counterparty: tx.counterparty,
        operation_type: tx.operationType,
        payment_condition: tx.paymentCondition || 'contado'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error al insertar en dom_transactions: ${error.message}`);
    }

    return {
      id: data.id,
      personaPadreId: data.persona_padre_id,
      accountId: data.account_id,
      categoryId: data.category_id,
      direction: data.direction,
      amount: Money.fromAmount(data.amount),
      description: data.description,
      occurredOn: data.occurred_on,
      paymentMethod: data.payment_method,
      status: data.status,
      opNumber: data.op_number,
      counterparty: data.counterparty,
      operationType: data.operation_type,
      paymentCondition: data.payment_condition
    };
  }

  public async updateTransaction(tx: TransactionDTO): Promise<TransactionDTO> {
    if (!tx.id) throw new Error('ID requerido para actualizar transacción');

    const { data, error } = await supabase
      .from('dom_transactions')
      .update({
        direction: tx.direction,
        amount: tx.amount.toAmount(),
        description: tx.description,
        occurred_on: tx.occurredOn,
        payment_method: tx.paymentMethod,
        op_number: tx.opNumber,
        counterparty: tx.counterparty,
        operation_type: tx.operationType,
        payment_condition: tx.paymentCondition,
        updated_at: new Date().toISOString()
      })
      .eq('id', tx.id)
      .eq('persona_padre_id', tx.personaPadreId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar en dom_transactions: ${error.message}`);
    }

    return {
      id: data.id,
      personaPadreId: data.persona_padre_id,
      accountId: data.account_id,
      categoryId: data.category_id,
      direction: data.direction,
      amount: Money.fromAmount(data.amount),
      description: data.description,
      occurredOn: data.occurred_on,
      paymentMethod: data.payment_method,
      status: data.status,
      opNumber: data.op_number,
      counterparty: data.counterparty,
      operationType: data.operation_type,
      paymentCondition: data.payment_condition
    };
  }

  public async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('dom_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar en dom_transactions: ${error.message}`);
    }
  }

  public async getTransactionsByTenant(personaPadreId: number): Promise<TransactionDTO[]> {
    const { data, error } = await supabase
      .from('dom_transactions')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('occurred_on', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar dom_transactions: ${error.message}`);
    }

    return (data || []).map(item => ({
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
      opNumber: item.op_number,
      counterparty: item.counterparty,
      operationType: item.operation_type,
      paymentCondition: item.payment_condition
    }));
  }
}
