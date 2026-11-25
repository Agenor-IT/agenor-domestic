import { supabase } from './supabaseClient';
import type { IVentureRepository } from '../domain/repositories/IVentureRepository';
import type { DomVentureDTO } from '../domain/ventures/DomVenture';

interface VentureRow {
  id: number;
  persona_padre_id: number;
  client_name: string;
  project_name: string;
  category: string;
  source_type?: DomVentureDTO['sourceType'];
  status: DomVentureDTO['status'];
  income_type?: DomVentureDTO['incomeType'];
  base_monthly_amount: number | string;
  monthly_projections: Record<string, number> | null;
  default_payment_method: DomVentureDTO['defaultPaymentMethod'];
  notes: string | null;
  created_at: string;
}

function mapVenture(row: VentureRow): DomVentureDTO {
  return {
    id: String(row.id),
    personaPadreId: row.persona_padre_id,
    clientName: row.client_name,
    projectName: row.project_name,
    category: row.category,
    sourceType: row.source_type || 'emprendimiento',
    status: row.status,
    incomeType: row.income_type || 'fijo',
    baseMonthlyAmount: Number(row.base_monthly_amount),
    monthlyProjections: row.monthly_projections ?? {},
    defaultPaymentMethod: row.default_payment_method,
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

export class SupabaseDomVentureRepository implements IVentureRepository {
  public async getVentures(personaPadreId: number): Promise<DomVentureDTO[]> {
    const { data, error } = await supabase.from('dom_ventures').select('*')
      .eq('persona_padre_id', personaPadreId).order('id', { ascending: false })
      .overrideTypes<VentureRow[], { merge: false }>();
    if (error) throw error;
    return (data ?? []).map(mapVenture);
  }

  public async saveVenture(venture: Partial<DomVentureDTO>, personaPadreId: number): Promise<DomVentureDTO> {
    const payload = {
      persona_padre_id: personaPadreId,
      client_name: venture.clientName || 'Nuevo Cliente',
      project_name: venture.projectName || 'Nuevo Proyecto',
      category: venture.category || 'Servicios',
      status: venture.status || 'activo',
      income_type: venture.incomeType || 'fijo',
      source_type: venture.sourceType || 'emprendimiento',
      base_monthly_amount: venture.baseMonthlyAmount || 0,
      monthly_projections: venture.monthlyProjections || {},
      default_payment_method: venture.defaultPaymentMethod || 'cash',
      notes: venture.notes || null,
    };
    const table = supabase.from('dom_ventures');
    const query = venture.id
      ? table.update(payload).eq('id', venture.id).eq('persona_padre_id', personaPadreId)
      : table.insert(payload);
    const { data, error } = await query.select().single<VentureRow>();
    if (error) throw error;
    return mapVenture(data);
  }

  public async deleteVenture(id: string, personaPadreId: number): Promise<void> {
    const { error } = await supabase.from('dom_ventures').delete()
      .eq('id', id).eq('persona_padre_id', personaPadreId).select('id').single();
    if (error) throw error;
  }
}
