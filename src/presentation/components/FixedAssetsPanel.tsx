import { FormattedNumberInput } from './FormattedNumberInput';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Calculator,
  TrendingDown,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Pencil,
  Trash2
} from 'lucide-react';
import { SupabaseDomFixedAssetRepository } from '../../infrastructure/SupabaseDomFixedAssetRepository';
import { SupabaseDomAccountingRepository } from '../../infrastructure/SupabaseDomAccountingRepository';
import { DomFixedAssetDTO, DomFixedAsset } from '../../domain/assets/DomFixedAsset';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { Money } from '../../domain/shared/Money';

export const FixedAssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<DomFixedAssetDTO[]>([]);
  const [accounts, setAccounts] = useState<DomAccountDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modales
  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState<boolean>(false);
  const [isAmortizeModalOpen, setIsAmortizeModalOpen] = useState<boolean>(false);
  const [selectedAssetForAmort, setSelectedAssetForAmort] = useState<DomFixedAssetDTO | null>(null);
  const [editingAsset, setEditingAsset] = useState<DomFixedAssetDTO | null>(null);

  // Formulario Nuevo / Edición Bien
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('tecnologia');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [acquisitionCost, setAcquisitionCost] = useState<number>(1000000);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [residualValue, setResidualValue] = useState<number>(0);
  const [assetAccountId, setAssetAccountId] = useState<number>(0);
  const [accumulatedAccountId, setAccumulatedAccountId] = useState<number>(0);
  const [expenseAccountId, setExpenseAccountId] = useState<number>(0);
  const [location, setLocation] = useState<string>('');

  // Formulario Amortizar
  const [amortAmount, setAmortAmount] = useState<number>(0);
  const [amortPeriod, setAmortPeriod] = useState<string>('Ejercicio 2026');
  const [amortDate, setAmortDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const CATEGORY_ACCOUNT_MAPPING: Record<
    string,
    { assetCode: string; accAmortCode: string; expAmortCode: string; defaultUsefulLife: number }
  > = useMemo(() => ({
    inmuebles: { assetCode: '1.2.01.01', accAmortCode: '1.2.02.01', expAmortCode: '5.1.04.01', defaultUsefulLife: 50 },
    vehiculos: { assetCode: '1.2.01.02', accAmortCode: '1.2.02.02', expAmortCode: '5.1.04.02', defaultUsefulLife: 5 },
    tecnologia: { assetCode: '1.2.01.03', accAmortCode: '1.2.02.03', expAmortCode: '5.1.04.03', defaultUsefulLife: 3 },
    muebles: { assetCode: '1.2.01.04', accAmortCode: '1.2.02.04', expAmortCode: '5.1.04.04', defaultUsefulLife: 10 },
    maquinaria: { assetCode: '1.2.01.05', accAmortCode: '1.2.02.05', expAmortCode: '5.1.04.05', defaultUsefulLife: 10 },
    instalaciones: { assetCode: '1.2.01.06', accAmortCode: '1.2.02.06', expAmortCode: '5.1.04.06', defaultUsefulLife: 10 }
  }), []);

  const assetAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.kind === 'asset' && (a.code.startsWith('1.2.01') || a.subrubro === 'Activo No Corriente'));
    return matched.length > 0 ? matched : accounts.filter(a => a.kind === 'asset');
  }, [accounts]);

  const accAmortAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.code.startsWith('1.2.02') || a.name.toLowerCase().includes('amortiza'));
    return matched.length > 0 ? matched : accounts;
  }, [accounts]);

  const expAmortAccountOptions = useMemo(() => {
    const matched = accounts.filter(a => a.kind === 'expense' && (a.code.startsWith('5.1.04') || a.name.toLowerCase().includes('amortiza')));
    return matched.length > 0 ? matched : accounts.filter(a => a.kind === 'expense');
  }, [accounts]);

  const applyCategoryMapping = (catName: string, overwriteAccounts: boolean = true) => {
    setCategory(catName);
    const mapping = CATEGORY_ACCOUNT_MAPPING[catName] || CATEGORY_ACCOUNT_MAPPING.tecnologia;

    if (overwriteAccounts && accounts.length > 0) {
      const matchedAsset = accounts.find(a => a.code === mapping.assetCode) || assetAccountOptions[0];
      const matchedAccAmort = accounts.find(a => a.code === mapping.accAmortCode) || accAmortAccountOptions[0];
      const matchedExpAmort = accounts.find(a => a.code === mapping.expAmortCode) || expAmortAccountOptions[0];

      if (matchedAsset) setAssetAccountId(matchedAsset.id);
      if (matchedAccAmort) setAccumulatedAccountId(matchedAccAmort.id);
      if (matchedExpAmort) setExpenseAccountId(matchedExpAmort.id);
    }
    setUsefulLifeYears(mapping.defaultUsefulLife);
  };

  const handleOpenNewModal = () => {
    setEditingAsset(null);
    setCode('');
    setName('');
    setAcquisitionDate(new Date().toISOString().split('T')[0]);
    setAcquisitionCost(1000000);
    setResidualValue(0);
    setLocation('');
    applyCategoryMapping('tecnologia', true);
    setIsNewAssetModalOpen(true);
  };

  const handleOpenEditModal = (asset: DomFixedAssetDTO) => {
    setEditingAsset(asset);
    setCode(asset.code);
    setName(asset.name);
    setCategory(asset.category);
    setAcquisitionDate(asset.acquisitionDate);
    setAcquisitionCost(asset.acquisitionCost);
    setUsefulLifeYears(asset.usefulLifeYears);
    setResidualValue(asset.residualValue);
    setLocation(asset.location || '');

    const mapping = CATEGORY_ACCOUNT_MAPPING[asset.category] || CATEGORY_ACCOUNT_MAPPING.vehiculos;
    const matchedAssetAcc = accounts.find(a => a.id === asset.assetAccountId) || accounts.find(a => a.code === mapping.assetCode) || assetAccountOptions[0];
    const matchedAccAmort = accounts.find(a => a.id === asset.accumulatedDepreciationAccountId) || accounts.find(a => a.code === mapping.accAmortCode) || accAmortAccountOptions[0];
    const matchedExpAmort = accounts.find(a => a.id === asset.depreciationExpenseAccountId) || accounts.find(a => a.code === mapping.expAmortCode) || expAmortAccountOptions[0];

    setAssetAccountId(matchedAssetAcc?.id || (assetAccountOptions[0]?.id || 0));
    setAccumulatedAccountId(matchedAccAmort?.id || (accAmortAccountOptions[0]?.id || 0));
    setExpenseAccountId(matchedExpAmort?.id || (expAmortAccountOptions[0]?.id || 0));

    setIsNewAssetModalOpen(true);
  };

  const handleDeleteAsset = async (asset: DomFixedAssetDTO) => {
    if (!window.confirm(`¿Está seguro de eliminar el Bien de Uso "${asset.name}" (${asset.code})?`)) return;
    try {
      await fixedAssetRepo.deleteFixedAsset(asset.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar Bien de Uso.');
    }
  };

  const fixedAssetRepo = useMemo(() => new SupabaseDomFixedAssetRepository(), []);
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedAssets, fetchedAccounts] = await Promise.all([
        fixedAssetRepo.getFixedAssets(1),
        accountingRepo.getAccounts(1)
      ]);
      setAssets(fetchedAssets);
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error('Error al cargar datos de Bienes de Uso:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fixedAssetRepo, accountingRepo]);

  // Cálculos consolidados KPI
  const domainAssets = useMemo(() => assets.map(a => new DomFixedAsset(a)), [assets]);

  const totalAcquisitionCost = useMemo(() => {
    return domainAssets.reduce((sum, a) => sum + a.data.acquisitionCost, 0);
  }, [domainAssets]);

  const totalAccumulatedDepreciation = useMemo(() => {
    return domainAssets.reduce((sum, a) => sum + a.data.accumulatedDepreciation, 0);
  }, [domainAssets]);

  const totalNetBookValue = useMemo(() => {
    return domainAssets.reduce((sum, a) => sum + a.netBookValue, 0);
  }, [domainAssets]);

  // Filtrado de bienes
  const filteredAssets = useMemo(() => {
    return domainAssets.filter(item => {
      const matchesSearch =
        item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.data.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.data.location && item.data.location.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = categoryFilter === 'all' || item.data.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [domainAssets, searchTerm, categoryFilter]);

  const handleCreateOrUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      setFeedback({ text: 'Por favor complete el código y nombre del bien.', type: 'error' });
      return;
    }

    const finalAssetAccId = assetAccountOptions.some(a => a.id === assetAccountId)
      ? assetAccountId
      : (assetAccountOptions[0]?.id || 1);

    const finalAccAmortId = accAmortAccountOptions.some(a => a.id === accumulatedAccountId)
      ? accumulatedAccountId
      : (accAmortAccountOptions[0]?.id || 1);

    const finalExpAmortId = expAmortAccountOptions.some(a => a.id === expenseAccountId)
      ? expenseAccountId
      : (expAmortAccountOptions[0]?.id || 1);

    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingAsset) {
        await fixedAssetRepo.updateFixedAsset(editingAsset.id, {
          code,
          name,
          category: category as any,
          acquisitionDate,
          acquisitionCost: acquisitionCost || 0,
          usefulLifeYears: usefulLifeYears || 1,
          residualValue: residualValue || 0,
          assetAccountId: finalAssetAccId,
          accumulatedDepreciationAccountId: finalAccAmortId,
          depreciationExpenseAccountId: finalExpAmortId,
          location
        });
        setFeedback({ text: 'Bien de Uso actualizado correctamente.', type: 'success' });
      } else {
        await fixedAssetRepo.createFixedAsset({
          personaPadreId: 1,
          code,
          name,
          category: category as any,
          acquisitionDate,
          acquisitionCost: acquisitionCost || 0,
          usefulLifeYears: usefulLifeYears || 1,
          residualValue: residualValue || 0,
          accumulatedDepreciation: 0,
          assetAccountId: finalAssetAccId,
          accumulatedDepreciationAccountId: finalAccAmortId,
          depreciationExpenseAccountId: finalExpAmortId,
          location
        });
        setFeedback({ text: 'Bien de Uso registrado correctamente.', type: 'success' });
      }

      setTimeout(() => {
        setIsNewAssetModalOpen(false);
        setEditingAsset(null);
        setFeedback(null);
        setCode('');
        setName('');
        loadData();
      }, 1200);
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error al guardar Bien de Uso.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAmortModal = (asset: DomFixedAssetDTO) => {
    setSelectedAssetForAmort(asset);
    const domain = new DomFixedAsset(asset);
    setAmortAmount(domain.annualDepreciation);
    setIsAmortizeModalOpen(true);
  };

  const handleApplyAmortization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForAmort) return;

    if (amortAmount <= 0) {
      setFeedback({ text: 'El monto de amortización debe ser mayor a 0.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fixedAssetRepo.recordDepreciationEntry(
        1,
        selectedAssetForAmort.id,
        amortAmount,
        amortDate,
        amortPeriod
      );

      if (res.success) {
        setFeedback({
          text: `Amortización registrada con exito. Asiento N° ${res.entryNumber} en Libro Diario.`,
          type: 'success'
        });
        setTimeout(() => {
          setIsAmortizeModalOpen(false);
          setFeedback(null);
          loadData();
        }, 1500);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error al registrar asiento de amortización.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER DEL MÓDULO BIENES DE USO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0F172A] p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Gestión de Bienes de Uso (Activos Fijos)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento de Bienes de Uso, Amortización Acumulada y Asientos al Diario
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuevo Bien de Uso</span>
        </button>
      </div>

      {/* CARDS DE RESUMEN KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        <div className="bg-white dark:bg-[#0F172A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block truncate">
              Valor de Origen Total ($)
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1 block truncate">
              {Money.fromAmount(totalAcquisitionCost).toFormattedString()}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block truncate">
              Costo de adquisición de activos
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0 ml-2">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block truncate">
              Amortización Acumulada ($)
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block truncate">
              {Money.fromAmount(totalAccumulatedDepreciation).toFormattedString()}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block truncate">
              Depreciación ordinaria
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 ml-2">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block truncate">
              Valor Neto en Libros ($)
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
              {Money.fromAmount(totalNetBookValue).toFormattedString()}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block truncate">
              Valor residual contable actual
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 ml-2">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SECCIÓN DE FILTROS Y TABLA DE BIENES */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar bien, código o ubicación..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 font-medium shrink-0">Categoría:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none cursor-pointer"
            >
              <option value="all">Todas las categorías</option>
              <option value="inmuebles">Inmuebles</option>
              <option value="vehiculos">Vehículos</option>
              <option value="tecnologia">Tecnología / IT</option>
              <option value="muebles">Muebles y Útiles</option>
              <option value="maquinaria">Maquinaria</option>
              <option value="instalaciones">Instalaciones</option>
            </select>
          </div>
        </div>

        {/* TABLA DE BIENES */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead className="bg-gray-100/70 dark:bg-[#1E293B]/70 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3.5 px-4 sticky left-0 bg-gray-100 dark:bg-[#1E293B] z-10">Código / Bien</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-center">Alta / Vida Útil</th>
                <th className="py-3.5 px-4 text-right">Valor Origen ($)</th>
                <th className="py-3.5 px-4 text-right">Amort. Acumulada ($)</th>
                <th className="py-3.5 px-4 text-right">Valor Neto Libros ($)</th>
                <th className="py-3.5 px-4 text-center font-bold">Cuentas Vinculadas</th>
                <th className="py-3.5 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-gray-800 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Cargando catálogo de Bienes de Uso...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400">
                    No se encontraron bienes de uso registrados.
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const data = asset.data;
                  const assetAcc = accounts.find(a => a.id === data.assetAccountId);
                  const expAcc = accounts.find(a => a.id === data.depreciationExpenseAccountId);
                  const pct = asset.depreciationPercentage;

                  return (
                    <tr key={data.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1E293B]/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded">
                            {data.code}
                          </span>
                          <span>{data.name}</span>
                        </div>
                        {data.location && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">📍 {data.location}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {data.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="text-[11px] font-medium">{data.acquisitionDate}</div>
                        <div className="text-[10px] text-gray-400">{data.usefulLifeYears} años vida útil</div>
                        {/* Barra de progreso de amortización */}
                        <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${pct}%` }}
                            title={`${pct.toFixed(1)}% amortizado`}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium">
                        {Money.fromAmount(data.acquisitionCost).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400 font-medium">
                        {Money.fromAmount(data.accumulatedDepreciation).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Money.fromAmount(asset.netBookValue).toFormattedString()}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="text-[10px] text-gray-500 font-mono">
                          Activo: <strong className="text-gray-700 dark:text-gray-300">{assetAcc?.code || '1.2.01'}</strong>
                          <br />
                          Egreso: <strong className="text-gray-700 dark:text-gray-300">{expAcc?.code || '5.1.04'}</strong>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenAmortModal(data)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            title="Calcular y Registrar Asiento de Amortización"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Amortizar</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(data)}
                            className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Editar Bien de Uso"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteAsset(data)}
                            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Eliminar Bien de Uso"
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

      {/* MODAL: NUEVO O EDITAR BIEN DE USO */}
      {isNewAssetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-[#0F172A] rounded-t-2xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                  {editingAsset ? 'Editar Bien de Uso' : 'Alta de Bien de Uso'}
                </h3>
              </div>
              <button
                onClick={() => setIsNewAssetModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
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

            <form onSubmit={handleCreateOrUpdateAsset} className="space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. BU-004"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Categoría *
                  </label>
                  <select
                    value={category}
                    onChange={e => applyCategoryMapping(e.target.value, true)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  >
                    <option value="inmuebles" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Inmuebles</option>
                    <option value="vehiculos" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Vehículos</option>
                    <option value="tecnologia" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Tecnología / IT</option>
                    <option value="muebles" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Muebles y Útiles</option>
                    <option value="maquinaria" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Maquinaria</option>
                    <option value="instalaciones" className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">Instalaciones</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Nombre o Descripción del Bien *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Camioneta Ford Ranger 4x4"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Fecha Alta *
                  </label>
                  <input
                    type="date"
                    required
                    value={acquisitionDate}
                    onChange={e => setAcquisitionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Valor Origen ($) *
                  </label>
                  <FormattedNumberInput
                    value={acquisitionCost}
                    onChange={val => setAcquisitionCost(val)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Vida Útil (Años) *
                  </label>
                  <FormattedNumberInput
                    decimals={0}
                    value={usefulLifeYears}
                    onChange={val => setUsefulLifeYears(val)}
                    placeholder="5"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Valor Rescate / Recuperable ($)
                  </label>
                  <FormattedNumberInput
                    value={residualValue}
                    onChange={val => setResidualValue(val)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Ubicación / Área
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Oficina Central, Cochera 2"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
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
                      1. Cuenta Activo:
                    </label>
                    <select
                      value={assetAccountOptions.some(a => a.id === assetAccountId) ? assetAccountId : (assetAccountOptions[0]?.id || '')}
                      onChange={e => setAssetAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {assetAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      2. Amort. Acumulada:
                    </label>
                    <select
                      value={accAmortAccountOptions.some(a => a.id === accumulatedAccountId) ? accumulatedAccountId : (accAmortAccountOptions[0]?.id || '')}
                      onChange={e => setAccumulatedAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {accAmortAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      3. Gasto Amortización:
                    </label>
                    <select
                      value={expAmortAccountOptions.some(a => a.id === expenseAccountId) ? expenseAccountId : (expenseAccountId || expAmortAccountOptions[0]?.id || '')}
                      onChange={e => setExpenseAccountId(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {expAmortAccountOptions.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white">
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewAssetModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer text-center"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2 text-center"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAsset ? 'Guardar Cambios' : 'Guardar Bien de Uso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR AMORTIZACIÓN */}
      {isAmortizeModalOpen && selectedAssetForAmort && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-[#0F172A] rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calculator className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                  Registrar Amortización
                </h3>
              </div>
              <button
                onClick={() => setIsAmortizeModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs space-y-1 text-amber-800 dark:text-amber-300 shrink-0">
              <p className="font-bold truncate">{selectedAssetForAmort.code} - {selectedAssetForAmort.name}</p>
              <p className="truncate">Valor Origen: {Money.fromAmount(selectedAssetForAmort.acquisitionCost).toFormattedString()} | Vida Útil: {selectedAssetForAmort.usefulLifeYears} años</p>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
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

            <form onSubmit={handleApplyAmortization} className="space-y-4 flex-1">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Monto de Amortización a Contabilizar ($) *
                </label>
                <FormattedNumberInput
                  value={amortAmount}
                  onChange={val => setAmortAmount(val)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none font-mono font-bold text-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Fecha del Asiento *
                  </label>
                  <input
                    type="date"
                    required
                    value={amortDate}
                    onChange={e => setAmortDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Período / Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={amortPeriod}
                    onChange={e => setAmortPeriod(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAmortizeModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer text-center"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 text-center"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar & Registrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
