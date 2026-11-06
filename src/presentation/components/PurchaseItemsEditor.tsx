import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConsumptionProduct, PurchaseItemInput } from '../../domain/consumption/Consumption';
import { fetchConsumptionProducts } from '../../infrastructure/SupabaseDomConsumptionRepository';
import { SearchableSelect } from './SearchableSelect';

const inputClass = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-[#1E293B] dark:text-white';
interface Props { personaPadreId: number; value: PurchaseItemInput[]; onChange(value: PurchaseItemInput[]): void; readOnly: boolean; }

export function PurchaseItemsEditor({ personaPadreId, value, onChange, readOnly }: Props) {
  const [products, setProducts] = useState<ConsumptionProduct[]>([]);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    let active = true;
    void fetchConsumptionProducts(personaPadreId).then(data => { if (active) { setProducts(data); setCatalogError(''); } })
      .catch(() => { if (active) setCatalogError('No se pudo consultar el catálogo. Podés revisar el detalle; su guardado requiere el módulo habilitado.'); });
    return () => { active = false; };
  }, [personaPadreId]);
  const update = (index: number, patch: Partial<PurchaseItemInput>) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <section aria-labelledby="purchase-items-title" className="space-y-3 rounded-xl border border-blue-200 p-3 dark:border-blue-900">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="purchase-items-title" className="font-bold text-gray-900 dark:text-white">Productos e insumos del comprobante ({value.length})</h3>
      {!readOnly && <button type="button" disabled={value.length >= 100} onClick={() => onChange([...value, {
        rawName: '', name: '', presentation: '', unit: '', kind: 'consumable', quantity: null, lineTotal: null
      }])} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200"><Plus className="h-4 w-4" />Agregar producto</button>}
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400">Revisá nombres, presentaciones y unidades. Elegí un producto existente para unificar nombres del ticket. Cantidades ilegibles pueden quedar vacías; no se usarán para estimar consumo. Los servicios permanecen en la descripción.</p>
    {catalogError && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{catalogError}</p>}
    {!value.length && <p className="text-xs text-gray-500">Sin productos detallados. Podés agregarlos manualmente o desde una foto.</p>}
    {value.map((item, index) => <fieldset key={index} disabled={readOnly} className="min-w-0 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
      <legend className="px-1 text-xs font-bold">Producto {index + 1}</legend>
      <div className="flex items-start gap-2">
        <label className="min-w-0 flex-1 text-xs">Vincular al catálogo
          <SearchableSelect aria-label={`Vincular producto ${index + 1}`} className={inputClass} value={item.productId ?? ''} onChange={event => {
            const found = products.find(product => product.id === event.target.value);
            if (found) update(index, { productId: found.id, name: found.name, presentation: found.presentation, unit: found.unit, kind: found.kind });
            else update(index, { productId: undefined });
          }}><option value="">Producto nuevo / corregir identificación</option>
            {products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.presentation || 'sin presentación'} · {product.unit}</option>)}
          </SearchableSelect>
        </label>
        {!readOnly && <button type="button" aria-label={`Quitar producto ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))} className="mt-4 rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>Producto *<input aria-label={`Nombre producto ${index + 1}`} className={inputClass} maxLength={300} value={item.name} onChange={event => update(index, {
          name: event.target.value, productId: undefined, rawName: !item.rawName || item.rawName === item.name ? event.target.value : item.rawName
        })} /></label>
        <label>Presentación / concentración<input aria-label={`Presentación producto ${index + 1}`} className={inputClass} maxLength={120} placeholder="Ej. botella 1 litro / 500 mg, 10 comprimidos" value={item.presentation} onChange={event => update(index, { presentation: event.target.value, productId: undefined })} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label>Cantidad<input aria-label={`Cantidad producto ${index + 1}`} className={inputClass} type="number" inputMode="decimal" step="0.001" min="0.001" value={item.quantity ?? ''} onChange={event => update(index, { quantity: event.target.value === '' ? null : Number(event.target.value) })} /></label>
        <label>Unidad *<input aria-label={`Unidad producto ${index + 1}`} className={inputClass} maxLength={32} placeholder="unidad, kg, litro, paquete" value={item.unit} onChange={event => update(index, { unit: event.target.value, productId: undefined })} /></label>
        <label>Importe del renglón ($)<input aria-label={`Importe producto ${index + 1}`} className={inputClass} type="number" inputMode="decimal" step="0.01" min="0" value={item.lineTotal ?? ''} onChange={event => update(index, { lineTotal: event.target.value === '' ? null : Number(event.target.value) })} /></label>
        <label>Tipo<SearchableSelect aria-label={`Tipo producto ${index + 1}`} className={inputClass} value={item.kind} onChange={event => update(index, { kind: event.target.value as PurchaseItemInput['kind'], productId: undefined })}><option value="consumable">Consumible</option><option value="durable">Bien durable</option></SearchableSelect></label>
      </div>
      <label className="block">Texto original del ticket<input aria-label={`Texto original producto ${index + 1}`} className={inputClass} maxLength={300} value={item.rawName} onChange={event => update(index, { rawName: event.target.value })} /></label>
    </fieldset>)}
  </section>;
}
