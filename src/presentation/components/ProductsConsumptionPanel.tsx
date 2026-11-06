import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, Package, Plus, RefreshCw, ShoppingBasket, Trash2, Eye, Save, X } from 'lucide-react';
import { ConsumptionProduct, ConsumptionSnapshot, estimatePurchases, ShoppingItem } from '../../domain/consumption/Consumption';
import { IConsumptionRepository } from '../../domain/repositories/IConsumptionRepository';
import { argentinaDate } from '../../domain/shared/argentinaDate';
import { Money } from '../../domain/shared/Money';
import { PageHeader } from './PageHeader';
import { TableSearchFilter } from './TableSearchFilter';
import { SearchableSelect } from './SearchableSelect';

const control = 'w-full min-w-0 rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#0088FF] dark:border-gray-700 dark:bg-[#1E293B] dark:text-white';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';
const primaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0088FF] px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#0077EE] disabled:opacity-50';
const dateLabel = (date: string) => date.split('-').reverse().join('/');
const quantityLabel = (quantity: number | null) => quantity === null ? 'Sin cantidad' : quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 });
interface Props {
  personaPadreId: number; onPhoto(): void; onNewPurchase(): void; onOpenTransaction(id: string): void;
  repository: IConsumptionRepository;
}

function ShoppingRow({ item, product, busy, onSave, onDelete }: { item: ShoppingItem; product: ConsumptionProduct;
  busy: boolean; onSave(item: ShoppingItem): void; onDelete(): void }) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [note, setNote] = useState(item.note);
  useEffect(() => { setQuantity(item.quantity); setNote(item.note); }, [item.quantity, item.note, item.revision]);
  return <li className="min-w-0 space-y-3 p-4">
    <div className="flex items-start justify-between gap-2">
      <label className="flex min-w-0 items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={item.checked} disabled={busy}
        onChange={event => onSave({ ...item, quantity, note, checked: event.target.checked })} />
        <span className={`min-w-0 break-words ${item.checked ? 'text-gray-500 line-through' : 'font-bold'}`}>{product.name}<small className="block font-normal">{product.presentation} · {product.unit}</small></span>
      </label>
      <button type="button" disabled={busy} onClick={onDelete} aria-label={`Quitar ${product.name} de la lista`} className="p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_auto]">
      <label className="text-xs">Cantidad ({product.unit})<input aria-label={`Cantidad en lista de ${product.name}`} className={control} type="number" inputMode="decimal" step="0.001" min="0.001" value={quantity ?? ''} disabled={busy} onChange={event => setQuantity(event.target.value ? Number(event.target.value) : null)} /></label>
      <label className="text-xs">Nota<input aria-label={`Nota para ${product.name}`} className={control} maxLength={500} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      <button type="button" disabled={busy || quantity === item.quantity && note === item.note} className={`${button} self-end`} onClick={() => onSave({ ...item, quantity, note })}>Guardar</button>
    </div>
  </li>;
}

export function ProductsConsumptionPanel({ personaPadreId, onPhoto, onNewPurchase, onOpenTransaction, repository }: Props) {
  const repo = repository;
  const [snapshot, setSnapshot] = useState<ConsumptionSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [view, setView] = useState<'catalog' | 'suggestions' | 'list'>('catalog');
  const [search, setSearch] = useState(''), [page, setPage] = useState(0), [horizon, setHorizon] = useState(7);
  const [historyId, setHistoryId] = useState<string | null>(null), [historyLimit, setHistoryLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState<Omit<ConsumptionProduct, 'id'>>({ name: '', presentation: '', unit: '', kind: 'consumable' });
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setSnapshot(await repo.getSnapshot(personaPadreId)); }
    catch (reason) { setSnapshot(null); setError(reason instanceof Error ? reason.message : 'No se pudo cargar el módulo.'); }
    finally { setLoading(false); }
  }, [repo, personaPadreId]);
  useEffect(() => {
    let active = true;
    setSnapshot(null); setLoading(true); setError('');
    void repo.getSnapshot(personaPadreId).then(data => { if (active) setSnapshot(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el módulo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo, personaPadreId]);
  useEffect(() => setPage(0), [search, view, horizon]);
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el cambio. Actualizá antes de reintentar.'); }
    finally { setBusy(false); }
  };
  const today = argentinaDate();
  const dueLimit = new Date(Date.parse(`${today}T12:00:00Z`) + horizon * 86_400_000).toISOString().slice(0, 10);
  const estimates = useMemo(() => snapshot ? snapshot.products.map(product => ({ product,
    estimate: estimatePurchases(product, snapshot.purchases, today, horizon, snapshot.contract)
  })) : [], [snapshot, today, horizon]);
  const suggestions = estimates.filter(row => row.estimate.nextPurchaseDate && row.estimate.nextPurchaseDate <= dueLimit);
  const filtered = (view === 'suggestions' ? suggestions : estimates).filter(({ product }) =>
    `${product.name} ${product.presentation} ${product.unit}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((a, b) => view === 'suggestions' ? (a.estimate.nextPurchaseDate ?? '').localeCompare(b.estimate.nextPurchaseDate ?? '') : a.product.name.localeCompare(b.product.name, 'es'));
  const addToList = (product: ConsumptionProduct, quantity: number | null) => {
    const existing = snapshot?.shopping.find(item => item.productId === product.id);
    void mutate(() => repo.saveShoppingItem(personaPadreId, { id: existing?.id ?? crypto.randomUUID(), productId: product.id,
      quantity, note: existing?.note ?? '', checked: false, revision: existing?.revision ?? 0 }));
  };
  const productHistory = snapshot?.purchases.filter(item => item.productId === historyId).sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  const historyProduct = snapshot?.products.find(product => product.id === historyId);
  const visibleRows = filtered.slice(page * 12, page * 12 + 12);
  const rowActions = (product: ConsumptionProduct, estimate: ReturnType<typeof estimatePurchases>) => {
    const listed = snapshot?.shopping.some(item => item.productId === product.id && !item.checked);
    return <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
        onClick={() => { setHistoryId(product.id); setHistoryLimit(20); }} aria-label={'Ver historial de ' + product.name}><Eye className="h-4 w-4" />Historial</button>
      <button type="button" className={button} disabled={busy || listed} onClick={() => addToList(product, estimate.suggestedQuantity)}>
        {listed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{listed ? 'En la lista' : 'Agregar a lista'}
      </button>
    </div>;
  };
  const nextLabel = (product: ConsumptionProduct, estimate: ReturnType<typeof estimatePurchases>) =>
    estimate.nextPurchaseDate ? dateLabel(estimate.nextPurchaseDate) : product.kind === 'durable' ? 'Sin reposición periódica' : 'Historial insuficiente';
  const matchingShopping = snapshot?.shopping.filter(item => {
    const product = snapshot.products.find(product => product.id === item.productId);
    return product && (product.name + ' ' + product.presentation + ' ' + product.unit).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'));
  }).sort((a, b) => Number(a.checked) - Number(b.checked)) ?? [];
  return <div className="space-y-6">
    <PageHeader title="Productos y consumo" subtitle="Historial de productos comprados y planificación de compras"
      icon={ShoppingBasket} iconBgColor="bg-[#0088FF]" actionContainerClassName="flex justify-end"
      action={<>
        <button type="button" className={button} onClick={onPhoto}><Camera className="h-4 w-4" />Fotografiar ticket</button>
        <button type="button" className={button} onClick={onNewPurchase}><Plus className="h-4 w-4" />Cargar compra</button>
        <button type="button" className={primaryButton} disabled={busy || loading || !snapshot} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Producto</button>
        <button type="button" className={button} disabled={loading || busy} onClick={() => void reload()} aria-label="Actualizar productos"><RefreshCw className={'h-4 w-4' + (loading ? ' animate-spin' : '')} /></button>
      </>} />
    {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-600 dark:text-red-400">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0F172A]">
      <TableSearchFilter searchTerm={search} onSearchChange={setSearch} placeholder="Buscar por producto o presentación..."
        filterValue={view} onFilterChange={value => { setView(value as typeof view); setHistoryId(null); }}
        filterOptions={[
          { value: 'catalog', label: 'Productos (' + (snapshot?.products.length ?? 0) + ')' },
          { value: 'suggestions', label: 'Sugerencias (' + suggestions.length + ')' },
          { value: 'list', label: 'Mi lista (' + (snapshot?.shopping.filter(item => !item.checked).length ?? 0) + ')' }
        ]}
        extraControls={view === 'list' ? undefined : <SearchableSelect aria-label="Período de planificación" value={String(horizon)}
          onChange={event => setHorizon(Number(event.target.value))}
          className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {[7, 14, 30].map(days => <option key={days} value={days}>Planificar: {days} días</option>)}
        </SearchableSelect>} />
      {loading ? <p role="status" className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Cargando productos e historial…</p> : snapshot && <>
        {view === 'list' ? <>
          <p className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">Tildar un producto sólo modifica la lista. La frecuencia se actualiza al registrar una nueva compra.</p>
          {!matchingShopping.length ? <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{search ? 'Sin resultados' : 'Tu lista está vacía'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Agregá productos desde el catálogo o las sugerencias.</p></div> :
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">{matchingShopping.map(item => {
              const product = snapshot.products.find(product => product.id === item.productId)!;
              return <ShoppingRow key={item.id} product={product} item={item} busy={busy}
                onSave={next => void mutate(() => repo.saveShoppingItem(personaPadreId, next))}
                onDelete={() => void mutate(() => repo.deleteShoppingItem(personaPadreId, item))} />;
            })}</ul>}
        </> : <>
          <p className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">La frecuencia se estima entre compras del mismo producto, presentación y unidad, sin llevar stock.</p>
          <div className="lg:hidden">
            {!visibleRows.length ? <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{view === 'suggestions' ? 'Sin sugerencias para este período' : 'Todavía no hay productos'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{view === 'suggestions' ? 'Se necesitan compras en fechas distintas y cantidades conocidas.' : 'Cargá un ticket o agregá un producto para comenzar.'}</p></div> :
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">{visibleRows.map(({product,estimate}) => <li key={product.id} className="min-w-0 space-y-3 p-4">
                <div><p className="break-words text-sm font-bold text-gray-900 dark:text-white">{product.name}</p><p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{product.presentation || 'Sin presentación especificada'} · {product.unit} · {product.kind === 'durable' ? 'Bien durable' : 'Consumible'}</p></div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-gray-500 dark:text-gray-400">Última compra</dt><dd className="mt-1 font-semibold text-gray-700 dark:text-gray-300">{estimate.lastPurchaseDate ? dateLabel(estimate.lastPurchaseDate) : 'Sin compras'}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Próxima compra estimada</dt><dd className="mt-1 font-semibold text-gray-700 dark:text-gray-300">{nextLabel(product,estimate)}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Promedio semanal</dt><dd className="mt-1 font-semibold text-gray-700 dark:text-gray-300">{estimate.dailyQuantity === null ? 'Sin estimación' : quantityLabel(estimate.dailyQuantity * 7) + ' ' + product.unit}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Fechas con compras</dt><dd className="mt-1 font-semibold text-gray-700 dark:text-gray-300">{estimate.purchaseDays}</dd></div>
                </dl>
                {view === 'suggestions' && <p className="text-xs text-gray-700 dark:text-gray-300">Para {horizon} días: <strong>{quantityLabel(estimate.suggestedQuantity)} {product.unit}</strong></p>}
                <div className="border-t border-gray-100 pt-2 dark:border-gray-800">{rowActions(product,estimate)}</div>
              </li>)}</ul>}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead><tr className="border-b border-gray-200 bg-gray-100/70 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:border-gray-800 dark:bg-[#1E293B] dark:text-gray-300">
                <th className="px-4 py-3.5">Producto / presentación</th><th className="px-4 py-3.5">Unidad</th><th className="whitespace-nowrap px-4 py-3.5">Última compra</th>
                <th className="px-4 py-3.5">Promedio semanal</th><th className="px-4 py-3.5">Próxima compra estimada</th><th className="px-4 py-3.5 text-right">{view === 'suggestions' ? 'Cantidad sugerida' : 'Fechas con compras'}</th><th className="px-4 py-3.5 text-center">Acciones</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200 text-xs dark:divide-gray-800/80">
                {!visibleRows.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">{view === 'suggestions' ? 'Sin sugerencias. Se necesitan compras en fechas distintas y cantidades conocidas.' : 'Todavía no hay productos. Cargá un ticket o agregá un producto.'}</td></tr> :
                  visibleRows.map(({product,estimate}) => <tr key={product.id} className="record-row transition-colors hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/50">
                    <td className="px-4 py-3.5"><p className="font-bold text-gray-900 dark:text-white">{product.name}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{product.presentation || 'Sin presentación especificada'} · {product.kind === 'durable' ? 'Bien durable' : 'Consumible'}</p></td>
                    <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">{product.unit}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-gray-700 dark:text-gray-300">{estimate.lastPurchaseDate ? dateLabel(estimate.lastPurchaseDate) : 'Sin compras'}</td>
                    <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">{estimate.dailyQuantity === null ? 'Sin estimación' : quantityLabel(estimate.dailyQuantity * 7) + ' ' + product.unit}</td>
                    <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">{nextLabel(product,estimate)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white">{view === 'suggestions' ? quantityLabel(estimate.suggestedQuantity) + ' ' + product.unit : estimate.purchaseDays}</td>
                    <td className="px-4 py-3.5">{rowActions(product,estimate)}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          {filtered.length > 12 && <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-[#1E293B]/30">
            <span className="text-xs text-gray-500 dark:text-gray-400">Página {page + 1} de {Math.ceil(filtered.length / 12)}</span>
            <div className="flex gap-2"><button type="button" className={button} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" className={button} disabled={(page + 1) * 12 >= filtered.length} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div>
          </div>}
        </>}
      </>}
    </div>
    {creating && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="consumption-product-title" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#0F172A] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50/80 px-4 py-3.5 dark:border-gray-800 dark:bg-[#1E293B] sm:px-6">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#0088FF]/10 p-2.5 text-[#0088FF] dark:text-blue-400"><Package className="h-5 w-5" /></div><h2 id="consumption-product-title" className="text-sm font-bold text-[#172033] dark:text-white sm:text-base">Nuevo producto</h2></div>
          <button type="button" disabled={busy} onClick={() => setCreating(false)} aria-label="Cerrar nuevo producto" className="rounded-xl p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); void mutate(async () => { await repo.createProduct(personaPadreId,newProduct); setCreating(false); setNewProduct({name:'',presentation:'',unit:'',kind:'consumable'}); }); }}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 text-xs sm:grid-cols-2 sm:p-6">
            <label className="font-bold text-gray-700 dark:text-gray-300">Nombre *<input required maxLength={300} className={control} value={newProduct.name} onChange={event => setNewProduct({...newProduct,name:event.target.value})} /></label>
            <label className="font-bold text-gray-700 dark:text-gray-300">Presentación / concentración<input maxLength={120} className={control} value={newProduct.presentation} onChange={event => setNewProduct({...newProduct,presentation:event.target.value})} /></label>
            <label className="font-bold text-gray-700 dark:text-gray-300">Unidad *<input required maxLength={32} className={control} placeholder="Ej. unidad, kg, litro, paquete" value={newProduct.unit} onChange={event => setNewProduct({...newProduct,unit:event.target.value})} /></label>
            <label className="font-bold text-gray-700 dark:text-gray-300">Tipo<SearchableSelect aria-label="Tipo de producto" className={control} value={newProduct.kind} onChange={event => setNewProduct({...newProduct,kind:event.target.value as ConsumptionProduct['kind']})}><option value="consumable">Consumible</option><option value="durable">Bien durable</option></SearchableSelect></label>
            <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">La presentación y la unidad identifican productos distintos. Las sugerencias requieren historial de compras.</p>
          </div>
          <div className="flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-[#0F172A] sm:flex-row sm:px-6 sm:pb-4">
            <button type="button" className={button} disabled={busy} onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" disabled={busy} className={primaryButton}><Save className="h-4 w-4" />Guardar producto</button>
          </div>
        </form>
      </div>
    </div>}
    {historyProduct && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="consumption-history-title" className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#0F172A] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3.5 dark:border-gray-800 dark:bg-[#1E293B] sm:px-6">
          <div className="min-w-0"><h2 id="consumption-history-title" className="text-sm font-bold text-[#172033] dark:text-white sm:text-base">Historial de compras</h2><p className="break-words text-xs text-gray-500 dark:text-gray-400">{historyProduct.name} · {historyProduct.presentation} · {historyProduct.unit}</p></div>
          <button type="button" aria-label="Cerrar historial" onClick={() => setHistoryId(null)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!productHistory.length ? <p className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Todavía no hay compras de este producto.</p> :
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">{productHistory.slice(0,historyLimit).map(item => <li key={item.id} className="space-y-2 p-4 text-xs">
              <div className="flex flex-wrap justify-between gap-2"><strong className="text-gray-900 dark:text-white">{dateLabel(item.date)} · {item.supplier}</strong><span className="font-bold text-gray-900 dark:text-white">{quantityLabel(item.quantity)} {historyProduct.unit}</span></div>
              <p className="text-gray-500 dark:text-gray-400">{item.rawName} · {item.lineTotal === null ? 'Importe sin identificar' : Money.fromAmount(item.lineTotal).toFormattedString()}</p>
              <button type="button" className="font-semibold text-blue-600 dark:text-blue-400" onClick={() => { setHistoryId(null); onOpenTransaction(item.transactionId); }}>Ver comprobante {item.receiptNumber}</button>
            </li>)}</ul>}
          {productHistory.length > historyLimit && <div className="p-4"><button type="button" className={button} onClick={() => setHistoryLimit(historyLimit + 20)}>Ver más compras</button></div>}
        </div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-[#0F172A] sm:px-6 sm:pb-4"><button type="button" className={button} onClick={() => setHistoryId(null)}>Cerrar</button></div>
      </div>
    </div>}
  </div>;
}
