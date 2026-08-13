import { IPaymentPriorityRepository } from '../domain/priorities/IPaymentPriorityRepository';
import { PaymentPriority, PriorityEntityType } from '../domain/priorities/PaymentPriority';
import { supabase } from './supabaseClient';

export class SupabaseDomPaymentPriorityRepository implements IPaymentPriorityRepository {
  public async getPrioritiesByTenant(personaPadreId: number): Promise<PaymentPriority[]> {
    const { data, error } = await supabase
      .from('dom_payment_priorities')
      .select('*')
      .eq('persona_padre_id', personaPadreId)
      .order('priority_order', { ascending: true });

    if (error) {
      throw new Error(`Error al consultar dom_payment_priorities: ${error.message}`);
    }

    return (data || []).map(item => new PaymentPriority(
      item.persona_padre_id,
      item.entity_type as PriorityEntityType,
      item.entity_identifier,
      item.label,
      item.priority_order,
      item.id
    ));
  }

  public async savePriorities(personaPadreId: number, priorities: PaymentPriority[]): Promise<void> {
    const payload = priorities.map(p => ({
      persona_padre_id: personaPadreId,
      entity_type: p.entityType,
      entity_identifier: p.entityIdentifier,
      label: p.label,
      priority_order: p.priorityOrder,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('dom_payment_priorities')
      .upsert(payload, { onConflict: 'persona_padre_id,entity_identifier' });

    if (error) {
      throw new Error(`Error al actualizar dom_payment_priorities: ${error.message}`);
    }
  }
}
