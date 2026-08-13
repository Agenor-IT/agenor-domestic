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
        status: tx.status
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
      status: data.status
    };
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
      status: item.status
    }));
  }
}
