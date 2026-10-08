import { supabase } from './supabaseClient';
import { IVentureRepository } from '../domain/repositories/IVentureRepository';
import { DomVentureDTO } from '../domain/ventures/DomVenture';
import { INITIAL_MONTHS } from '../domain/shared/initialSeedData';

const LOCAL_STORAGE_KEY = 'dom_ventures_data';

export class SupabaseDomVentureRepository implements IVentureRepository {
  private getLocalVentures(): DomVentureDTO[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalVentures(ventures: DomVentureDTO[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ventures));
  }

  public async getVentures(personaPadreId: number): Promise<DomVentureDTO[]> {
    try {
      // 1. Consultar la tabla dom_ventures
      const { data, error } = await supabase
        .from('dom_ventures')
        .select('*')
        .eq('persona_padre_id', personaPadreId)
        .order('id', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: DomVentureDTO[] = data.map(row => ({
          id: String(row.id),
          personaPadreId: row.persona_padre_id,
          clientName: row.client_name,
          projectName: row.project_name,
          category: row.category,
          sourceType: (row.source_type as 'emprendimiento' | 'alquiler' | 'extraordinario') || 'emprendimiento',
          status: row.status as 'activo' | 'en_negociacion' | 'finalizado' | 'pausado',
          incomeType: (row.income_type as 'fijo' | 'proyectado') || 'fijo',
          baseMonthlyAmount: Number(row.base_monthly_amount),
          monthlyProjections: typeof row.monthly_projections === 'object' && row.monthly_projections !== null
            ? row.monthly_projections
            : {},
          defaultPaymentMethod: row.default_payment_method as 'cash' | 'card' | 'debit',
          notes: row.notes || '',
          createdAt: row.created_at
        }));
        this.saveLocalVentures(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error al consultar dom_ventures en Supabase:', e);
    }

    // 2. Si dom_ventures estuviese vacía o fallase, intentar consultar proformas & personas de AgenorSuite
    try {
      const { data: proformasData, error: proformaErr } = await supabase
        .from('proformas')
        .select(`
          id,
          cliente_id,
          fecha,
          total,
          numero,
          observaciones,
          personas:cliente_id (
            id,
            razon_social,
            nombre,
            apellido
          )
        `)
        .gt('total', 0)
        .order('fecha', { ascending: false });

      if (!proformaErr && proformasData && proformasData.length > 0) {
        const clientMap = new Map<number, DomVentureDTO>();

        for (const item of proformasData) {
          const clientId = item.cliente_id;
          if (!clientId || clientMap.has(clientId)) continue;

          const persona: any = Array.isArray(item.personas) ? item.personas[0] : item.personas;
          const clientName = persona?.razon_social?.trim()
            || `${persona?.nombre || ''} ${persona?.apellido || ''}`.trim()
            || `Cliente #${clientId}`;

          const projName = item.observaciones?.trim() || `Cotización N° ${item.numero}`;
          const amount = Number(item.total) || 0;

          const projections = INITIAL_MONTHS.reduce((acc, month, i) => {
            acc[month] = Math.round(amount * Math.pow(1.01, i));
            return acc;
          }, {} as Record<string, number>);

          clientMap.set(clientId, {
            id: `prof-${item.id}`,
            personaPadreId,
            clientName,
            projectName: projName,
            category: 'Cotización',
            status: 'activo',
            baseMonthlyAmount: amount,
            monthlyProjections: projections,
            defaultPaymentMethod: 'cash',
            notes: `Última cotización N° ${item.numero} de fecha ${item.fecha}`,
            createdAt: item.fecha
          });
        }

        const mappedFromProformas = Array.from(clientMap.values());
        if (mappedFromProformas.length > 0) {
          this.saveLocalVentures(mappedFromProformas);
          return mappedFromProformas;
        }
      }
    } catch (err) {
      console.warn('Error intentando obtener proformas de AgenorSuite:', err);
    }

    return this.getLocalVentures().filter(v => v.personaPadreId === personaPadreId || !v.personaPadreId);
  }

  public async saveVenture(venture: Partial<DomVentureDTO>, personaPadreId: number): Promise<DomVentureDTO> {
    const isNew = !venture.id || venture.id.startsWith('vent-') || venture.id.startsWith('prof-');

    const dbPayload = {
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
      notes: venture.notes || null
    };

    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('dom_ventures')
          .insert([dbPayload])
          .select()
          .single();

        if (!error && data) {
          const saved: DomVentureDTO = {
            id: String(data.id),
            personaPadreId: data.persona_padre_id,
            clientName: data.client_name,
            projectName: data.project_name,
            category: data.category,
            sourceType: (data.source_type as any) || 'emprendimiento',
            status: data.status,
            incomeType: (data.income_type as 'fijo' | 'proyectado') || 'fijo',
            baseMonthlyAmount: Number(data.base_monthly_amount),
            monthlyProjections: data.monthly_projections || {},
            defaultPaymentMethod: data.default_payment_method,
            notes: data.notes || '',
            createdAt: data.created_at
          };

          const local = this.getLocalVentures().filter(v => v.id !== venture.id);
          local.unshift(saved);
          this.saveLocalVentures(local);
          return saved;
        }
      } else {
        const { data, error } = await supabase
          .from('dom_ventures')
          .update(dbPayload)
          .eq('id', venture.id)
          .select()
          .single();

        if (!error && data) {
          const saved: DomVentureDTO = {
            id: String(data.id),
            personaPadreId: data.persona_padre_id,
            clientName: data.client_name,
            projectName: data.project_name,
            category: data.category,
            sourceType: (data.source_type as any) || 'emprendimiento',
            status: data.status,
            incomeType: (data.income_type as 'fijo' | 'proyectado') || 'fijo',
            baseMonthlyAmount: Number(data.base_monthly_amount),
            monthlyProjections: data.monthly_projections || {},
            defaultPaymentMethod: data.default_payment_method,
            notes: data.notes || '',
            createdAt: data.created_at
          };

          const local = this.getLocalVentures().map(v => v.id === saved.id ? saved : v);
          this.saveLocalVentures(local);
          return saved;
        }
      }
    } catch (err) {
      console.warn('Error al guardar en Supabase dom_ventures, utilizando almacenamiento local:', err);
    }

    // Fallback local
    const local = this.getLocalVentures();
    const savedId = venture.id || `vent-${Date.now()}`;
    const savedDTO: DomVentureDTO = {
      id: savedId,
      personaPadreId,
      clientName: venture.clientName || 'Nuevo Cliente',
      projectName: venture.projectName || 'Nuevo Proyecto',
      category: venture.category || 'Servicios',
      status: venture.status || 'activo',
      baseMonthlyAmount: venture.baseMonthlyAmount || 0,
      monthlyProjections: venture.monthlyProjections || {},
      defaultPaymentMethod: venture.defaultPaymentMethod || 'cash',
      notes: venture.notes || '',
      createdAt: venture.createdAt || new Date().toISOString()
    };

    const existingIdx = local.findIndex(v => v.id === savedId);
    if (existingIdx >= 0) {
      local[existingIdx] = savedDTO;
    } else {
      local.unshift(savedDTO);
    }
    this.saveLocalVentures(local);
    return savedDTO;
  }

  public async deleteVenture(id: string, _personaPadreId: number): Promise<void> {
    try {
      await supabase
        .from('dom_ventures')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.warn('Error al eliminar en Supabase dom_ventures:', err);
    }

    const local = this.getLocalVentures().filter(v => v.id !== id);
    this.saveLocalVentures(local);
  }
}
