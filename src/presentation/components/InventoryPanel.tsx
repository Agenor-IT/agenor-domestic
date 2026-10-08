import React, { useState, useEffect, useMemo } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  Boxes,
  Pencil,
  Trash2
} from 'lucide-react';
import { SupabaseDomInventoryRepository } from '../../infrastructure/SupabaseDomInventoryRepository';
import { SupabaseDomAccountingRepository } from '../../infrastructure/SupabaseDomAccountingRepository';
import { DomInventoryItemDTO, DomInventoryItem } from '../../domain/inventory/DomInventoryItem';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { Money } from '../../domain/shared/Money';

export const InventoryPanel: React.FC = () => {
  const [items, setItems] = useState<DomInventoryItemDTO[]>([]);
  const [accounts, setAccounts] = useState<DomAccountDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modales
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState<boolean>(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);
  const [movementType, setMovementType] = useState<'purchase' | 'sale'>('purchase');
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<DomInventoryItemDTO | null>(null);
  const [editingItem, setEditingItem] = useState<DomInventoryItemDTO | null>(null);

  // Formulario Nuevo / Editar Item
  const [sku, setSku] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Mercaderías de Reventa');
  const [unitMeasure, setUnitMeasure] = useState<string>('Unidades');
  const [initialStock, setInitialStock] = useState<string>('10');
  const [minimumStock, setMinimumStock] = useState<string>('5');
  const [unitCost, setUnitCost] = useState<string>('10000');
  const [sellingPrice, setSellingPrice] = useState<string>('18000');
  const [inventoryAccountId, setInventoryAccountId] = useState<number>(0);
  const [cogsAccountId, setCogsAccountId] = useState<number>(0);
  const [salesAccountId, setSalesAccountId] = useState<number>(0);

  // Formulario Movimiento
  const [movQuantity, setMovQuantity] = useState<string>('1');
  const [movUnitPrice, setMovUnitPrice] = useState<string>('0');
  const [movDate, setMovDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAccountId, setPaymentAccountId] = useState<number>(0);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const inventoryRepo = useMemo(() => new SupabaseDomInventoryRepository(), []);
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedAccounts] = await Promise.all([
        inventoryRepo.getInventoryItems(1),
        accountingRepo.getAccounts(1)
      ]);
      setItems(fetchedItems);
      setAccounts(fetchedAccounts);

      const invAcc = fetchedAccounts.find(a => a.code === '1.1.03.01' || a.name.toLowerCase().includes('mercadería')) || fetchedAccounts[0];
      const cogsAcc = fetchedAccounts.find(a => a.code === '5.1.01.01' || a.name.toLowerCase().includes('cmv')) || fetchedAccounts[0];
      const salesAcc = fetchedAccounts.find(a => a.code === '4.1.01.01' || a.name.toLowerCase().includes('venta')) || fetchedAccounts[0];
      const payAcc = fetchedAccounts.find(a => a.kind === 'bank' || a.kind === 'cash') || fetchedAccounts[0];

      if (invAcc) setInventoryAccountId(invAcc.id);
      if (cogsAcc) setCogsAccountId(cogsAcc.id);
      if (salesAcc) setSalesAccountId(salesAcc.id);
      if (payAcc) setPaymentAccountId(payAcc.id);
    } catch (err) {
      console.error('Error al cargar Bienes de Cambio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [inventoryRepo, accountingRepo]);

  const domainItems = useMemo(() => items.map(i => new DomInventoryItem(i)), [items]);

  const totalInventoryValuation = useMemo(() => {
    return domainItems.reduce((sum, item) => sum + item.totalValuation, 0);
  }, [domainItems]);

  const lowStockCount = useMemo(() => {
    return domainItems.filter(i => i.isLowStock).length;
  }, [domainItems]);

  const totalStockUnits = useMemo(() => {
    return domainItems.reduce((sum, item) => sum + item.data.currentStock, 0);
  }, [domainItems]);

  const filteredItems = useMemo(() => {
    return domainItems.filter(item => {
      return (
        item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.data.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.data.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [domainItems, searchTerm]);

  // Mapping por categoría para Bienes de Cambio e Insumos
  const INVENTORY_CATEGORY_MAPPING: Record<
    string,
    { invAccountCode: string; cogsAccountCode: string; defaultUnitMeasure: string }
  > = useMemo(() => ({
    'Mercaderías de Reventa': { invAccountCode: '1.1.03.01', cogsAccountCode: '5.1.01.01', defaultUnitMeasure: 'Unidades' },
    'Alimentos y Bebidas': { invAccountCode: '1.1.03.02', cogsAccountCode: '5.1.01.04', defaultUnitMeasure: 'Unidades' },
    'Insumos y Limpieza': { invAccountCode: '1.1.03.02', cogsAccountCode: '5.1.01.05', defaultUnitMeasure: 'Packs' },
    'Insumos y Consumibles': { invAccountCode: '1.1.03.02', cogsAccountCode: '5.1.01.05', defaultUnitMeasure: 'Unidades' }
  }), []);

  const inventoryAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.kind === 'asset' && a.code.startsWith('1.1.03'));
    return matched.length > 0 ? matched : accounts.filter(a => a.kind === 'asset');
  }, [accounts]);

  const cogsAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.kind === 'expense' && a.code.startsWith('5.1.01'));
    return matched.length > 0 ? matched : accounts.filter(a => a.kind === 'expense');
  }, [accounts]);

  const salesAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.kind === 'income' && a.code.startsWith('4.1'));
    return matched.length > 0 ? matched : accounts.filter(a => a.kind === 'income');
  }, [accounts]);

  const applyCategoryMapping = (catName: string, overwriteAccounts: boolean = true) => {
    setCategory(catName);
    const mapping = INVENTORY_CATEGORY_MAPPING[catName] || INVENTORY_CATEGORY_MAPPING['Mercaderías de Reventa'];

    if (overwriteAccounts && accounts.length > 0) {
      const matchedInv = accounts.find(a => a.code === mapping.invAccountCode) || inventoryAccountOptions[0];
      const matchedCogs = accounts.find(a => a.code === mapping.cogsAccountCode) || cogsAccountOptions[0];
      const matchedSales = accounts.find(a => a.code.startsWith('4.1')) || salesAccountOptions[0];

      if (matchedInv) setInventoryAccountId(matchedInv.id);
      if (matchedCogs) setCogsAccountId(matchedCogs.id);
      if (matchedSales) setSalesAccountId(matchedSales.id);
    }
    setUnitMeasure(mapping.defaultUnitMeasure);
  };

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setSku('');
    setName('');
    setInitialStock('10');
    setMinimumStock('5');
    setUnitCost('10000');
    setSellingPrice('18000');
    applyCategoryMapping('Alimentos y Bebidas', true);
    setIsNewItemModalOpen(true);
  };

  const handleOpenEditModal = (item: DomInventoryItemDTO) => {
    setEditingItem(item);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setUnitMeasure(item.unitMeasure);
    setInitialStock(String(item.currentStock));
    setMinimumStock(String(item.minimumStock));
    setUnitCost(String(item.unitCost));
    setSellingPrice(String(item.sellingPrice));

    const mapping = INVENTORY_CATEGORY_MAPPING[item.category] || INVENTORY_CATEGORY_MAPPING['Mercaderías de Reventa'];
    const matchedInvAcc = accounts.find(a => a.id === item.inventoryAccountId) || accounts.find(a => a.code === mapping.invAccountCode) || inventoryAccountOptions[0];
    const matchedCogsAcc = accounts.find(a => a.id === item.cogsAccountId) || accounts.find(a => a.code === mapping.cogsAccountCode) || cogsAccountOptions[0];
    const matchedSalesAcc = accounts.find(a => a.id === item.salesAccountId) || salesAccountOptions[0];

    setInventoryAccountId(matchedInvAcc?.id || (inventoryAccountOptions[0]?.id || 0));
    setCogsAccountId(matchedCogsAcc?.id || (cogsAccountOptions[0]?.id || 0));
    setSalesAccountId(matchedSalesAcc?.id || (salesAccountOptions[0]?.id || 0));

    setIsNewItemModalOpen(true);
  };

  const handleDeleteItem = async (item: DomInventoryItemDTO) => {
    if (!window.confirm(`¿Está seguro de eliminar el artículo "${item.name}" (${item.sku})?`)) return;
    try {
      await inventoryRepo.deleteInventoryItem(item.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar producto de inventario.');
    }
  };

  const handleCreateOrUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name) {
      setFeedback({ text: 'Complete SKU y Nombre del artículo.', type: 'error' });
      return;
    }

    const finalInvAccId = inventoryAccountOptions.some(a => a.id === inventoryAccountId)
      ? inventoryAccountId
      : (inventoryAccountOptions[0]?.id || 1);

    const finalCogsAccId = cogsAccountOptions.some(a => a.id === cogsAccountId)
      ? cogsAccountId
      : (cogsAccountOptions[0]?.id || 1);

    const finalSalesAccId = salesAccountOptions.some(a => a.id === salesAccountId)
      ? salesAccountId
      : (salesAccountOptions[0]?.id || 1);

    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingItem) {
        await inventoryRepo.updateInventoryItem(editingItem.id, {
          sku,
          name,
          category,
          unitMeasure,
          currentStock: parseFloat(initialStock) || 0,
          minimumStock: parseFloat(minimumStock) || 0,
          unitCost: parseFloat(unitCost) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          inventoryAccountId: finalInvAccId,
          cogsAccountId: finalCogsAccId,
          salesAccountId: finalSalesAccId
        });
        setFeedback({ text: 'Artículo actualizado exitosamente.', type: 'success' });
      } else {
        await inventoryRepo.createInventoryItem({
          personaPadreId: 1,
          sku,
          name,
          category,
          unitMeasure,
          currentStock: parseFloat(initialStock) || 0,
          minimumStock: parseFloat(minimumStock) || 0,
          unitCost: parseFloat(unitCost) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          inventoryAccountId: finalInvAccId,
          cogsAccountId: finalCogsAccId,
          salesAccountId: finalSalesAccId
        });
        setFeedback({ text: 'Artículo registrado exitosamente en el catálogo.', type: 'success' });
      }

      setTimeout(() => {
        setIsNewItemModalOpen(false);
        setEditingItem(null);
        setFeedback(null);
        setSku('');
        setName('');
        loadData();
      }, 1200);
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error al guardar artículo.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMovementModal = (item: DomInventoryItemDTO, type: 'purchase' | 'sale') => {
    setSelectedItemForMovement(item);
    setMovementType(type);
    setMovQuantity('1');
    setMovUnitPrice(type === 'purchase' ? String(item.unitCost) : String(item.sellingPrice));
    setIsMovementModalOpen(true);
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForMovement) return;

    const qty = parseFloat(movQuantity) || 0;
    const price = parseFloat(movUnitPrice) || 0;

    if (qty <= 0) {
      setFeedback({ text: 'La cantidad debe ser mayor a 0.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await inventoryRepo.recordStockMovement(
        1,
        {
          itemId: selectedItemForMovement.id,
          type: movementType,
          quantity: qty,
          unitPrice: price,
          totalAmount: qty * price,
          date: movDate
        },
        paymentAccountId || accounts[0]?.id || 1
      );

      if (res.success) {
        setFeedback({
          text: `${movementType === 'purchase' ? 'Compra' : 'Venta con CMV'} registrada. ${res.message}`,
          type: 'success'
        });
        setTimeout(() => {
          setIsMovementModalOpen(false);
          setFeedback(null);
          loadData();
        }, 1500);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error al registrar movimiento.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER DEL MÓDULO BIENES DE CAMBIO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Gestión de Bienes de Cambio (Inventarios & Stock)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Control de Stock, Valuación a Costo de Reposición y Asientos Automáticos de Ventas y CMV
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuevo Producto / Mercadería</span>
        </button>
      </div>

      {/* CARDS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Valuación Total Inventario ($)
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
              {Money.fromAmount(totalInventoryValuation).toFormattedString()}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Total mercaderías a precio de costo
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Stock Total en Almacén
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
              {totalStockUnits.toLocaleString()} unidades
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Unidades físicas disponibles
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Alertas de Stock Mínimo
            </span>
            <span className={`text-2xl font-black mt-1 block ${lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {lowStockCount} artículos
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              {lowStockCount > 0 ? 'Requieren reposición de compra' : 'Niveles de stock óptimos'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, nombre o categoría..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100/70 dark:bg-[#1E293B]/70 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3.5 px-4">SKU / Producto</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-right">Costo Unit. ($)</th>
                <th className="py-3.5 px-4 text-right">Precio Venta ($)</th>
                <th className="py-3.5 px-4 text-right">Valuación Total ($)</th>
                <th className="py-3.5 px-4 text-center">Acciones Movimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-gray-800 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Cargando catálogo de Bienes de Cambio...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    No se encontraron mercaderías o productos.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const data = item.data;
                  return (
                    <tr key={data.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded">
                            {data.sku}
                          </span>
                          <span>{data.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {data.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-bold ${item.isLowStock ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
                          {data.currentStock} {data.unitMeasure}
                        </span>
                        {item.isLowStock && (
                          <span className="text-[10px] text-amber-500 font-medium block">⚠️ Stock bajo</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium">
                        {Money.fromAmount(data.unitCost).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Money.fromAmount(data.sellingPrice).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {Money.fromAmount(item.totalValuation).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenMovementModal(data, 'purchase')}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            title="Registrar Compra / Ingreso de Stock"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Comprar</span>
                          </button>

                          <button
                            onClick={() => handleOpenMovementModal(data, 'sale')}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            title="Registrar Venta / Egreso de Stock con Asiento CMV"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Vender</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(data)}
                            className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Editar Producto"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteItem(data)}
                            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Eliminar Producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVO / EDITAR PRODUCTO */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-xl w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingItem ? 'Editar Producto / Mercadería' : 'Alta de Producto / Mercadería'}
                </h3>
              </div>
              <button onClick={() => setIsNewItemModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="MER-004"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Categoría *</label>
                  <select
                    value={category}
                    onChange={e => applyCategoryMapping(e.target.value, true)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  >
                    <option value="Mercaderías de Reventa" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Mercaderías de Reventa</option>
                    <option value="Alimentos y Bebidas" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Alimentos y Bebidas</option>
                    <option value="Insumos y Limpieza" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Insumos y Limpieza</option>
                    <option value="Insumos y Consumibles" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Insumos y Consumibles</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Nombre Producto / Insumo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Pack Leche Entera 1L / Yerba Mate / Monitor 27''"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Unidad Medida</label>
                  <input
                    type="text"
                    value={unitMeasure}
                    onChange={e => setUnitMeasure(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Stock Inicial</label>
                  <FormattedNumberInput
                    value={parseFloat(initialStock) || 0}
                    onChange={val => setInitialStock(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Stock Mínimo</label>
                  <FormattedNumberInput
                    value={parseFloat(minimumStock) || 0}
                    onChange={val => setMinimumStock(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Costo Unitario ($)</label>
                  <FormattedNumberInput
                    value={parseFloat(unitCost) || 0}
                    onChange={val => setUnitCost(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Precio Venta ($)</label>
                  <FormattedNumberInput
                    value={parseFloat(sellingPrice) || 0}
                    onChange={val => setSellingPrice(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[#0088FF]/5 dark:bg-[#0088FF]/10 rounded-xl space-y-3 border border-[#0088FF]/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#0088FF] dark:text-blue-400 uppercase tracking-wider block">
                    Asignación Contable Automática (RT 17)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    ✨ Imputación por Categoría
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      1. Activo Inventario:
                    </label>
                    <select
                      value={inventoryAccountOptions.some(a => a.id === inventoryAccountId) ? inventoryAccountId : (inventoryAccountOptions[0]?.id || '')}
                      onChange={e => setInventoryAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {inventoryAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      2. Egreso / Consumo:
                    </label>
                    <select
                      value={cogsAccountOptions.some(a => a.id === cogsAccountId) ? cogsAccountId : (cogsAccountOptions[0]?.id || '')}
                      onChange={e => setCogsAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {cogsAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      3. Ingreso por Venta:
                    </label>
                    <select
                      value={salesAccountOptions.some(a => a.id === salesAccountId) ? salesAccountId : (salesAccountId || salesAccountOptions[0]?.id || '')}
                      onChange={e => setSalesAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {salesAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Guardar Cambios' : 'Guardar Producto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR MOVIMIENTO (COMPRA / VENTA) */}
      {isMovementModalOpen && selectedItemForMovement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                {movementType === 'purchase' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-indigo-600" />
                )}
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Registrar {movementType === 'purchase' ? 'Compra de Stock' : 'Venta & Devengamiento CMV'}
                </h3>
              </div>
              <button onClick={() => setIsMovementModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl text-xs space-y-1">
              <p className="font-bold text-gray-900 dark:text-white">
                {selectedItemForMovement.sku} - {selectedItemForMovement.name}
              </p>
              <p className="text-gray-500">
                Stock actual: {selectedItemForMovement.currentStock} {selectedItemForMovement.unitMeasure} | Costo Reposición: {Money.fromAmount(selectedItemForMovement.unitCost).toFormattedString()}
              </p>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Cantidad ({selectedItemForMovement.unitMeasure}) *
                  </label>
                  <FormattedNumberInput
                    value={parseFloat(movQuantity) || 0}
                    onChange={val => setMovQuantity(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Precio Unitario ($) *
                  </label>
                  <FormattedNumberInput
                    value={parseFloat(movUnitPrice) || 0}
                    onChange={val => setMovUnitPrice(val.toString())}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Cuenta de Cobro / Pago (Caja/Banco) *
                </label>
                <select
                  value={paymentAccountId}
                  onChange={e => setPaymentAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                >
                  {accounts.filter(a => a.kind === 'bank' || a.kind === 'cash' || a.kind === 'wallet').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({Money.fromAmount(a.currentBalance).toFormattedString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Fecha Movimiento *
                </label>
                <input
                  type="date"
                  required
                  value={movDate}
                  onChange={e => setMovDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 ${
                    movementType === 'purchase'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar Movimiento & Asiento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
