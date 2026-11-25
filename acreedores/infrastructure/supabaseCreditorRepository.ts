import { supabase } from '../../src/infrastructure/supabaseClient';
import type { CreditorRepository } from '../application/creditorRepository';
import type { Creditor } from '../domain/creditor';

export function supabaseCreditorRepository(tenant: number): CreditorRepository {
  return {
    async list() {
      const result: Creditor[] = [];
      let cursor: string | undefined;
      while (true) {
        let query = supabase.from('dom_creditors').select('id,name,kind,document,contact')
          .eq('persona_padre_id', tenant).order('id').limit(200);
        if (cursor) query = query.gt('id', cursor);
        const { data, error } = await query.overrideTypes<Creditor[], { merge: false }>();
        if (error) throw new Error(error.code === 'PGRST205'
          ? 'El catálogo requiere aplicar la migración de acreedores en esta base.'
          : 'No se pudo cargar el catálogo de acreedores.');
        const page = data ?? [];
        result.push(...page);
        if (page.length < 200) break;
        cursor = page[page.length - 1].id;
      }
      return result.sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));
    },
    async create(creditor) {
      const { error } = await supabase.from('dom_creditors').upsert({
        id: creditor.id, persona_padre_id: tenant, name: creditor.name, kind: creditor.kind,
        document: creditor.document, contact: creditor.contact,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (error?.code === '23505') throw new Error('Ya existe un acreedor con ese documento.');
      if (error?.code === 'PGRST205') throw new Error('El guardado requiere aplicar la migración de acreedores en esta base.');
      if (error) throw new Error('No se pudo guardar el acreedor. Reintentá sin cambiar los datos.');
      const { data, error: readError } = await supabase.from('dom_creditors').select('id,name,kind,document,contact')
        .eq('persona_padre_id', tenant).eq('id', creditor.id).maybeSingle().overrideTypes<Creditor, { merge: false }>();
      if (readError || !data || data.name !== creditor.name || data.kind !== creditor.kind
        || data.document !== creditor.document || data.contact !== creditor.contact) {
        throw new Error('No se pudo confirmar el alta del acreedor.');
      }
    },
  };
}
