import React, { useState, useEffect, useMemo } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';
import { TableSearchFilter } from './TableSearchFilter';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Building2,
  Home,
  Sparkles,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  X,
  Loader2,
  Power,
  PowerOff
} from 'lucide-react';
import { SupabaseDomVentureRepository } from '../../infrastructure/SupabaseDomVentureRepository';
import { DomVentureDTO, DomVenture, IncomeSourceType, IncomeNatureType } from '../../domain/ventures/DomVenture';
import { Money } from '../../domain/shared/Money';
import { INITIAL_MONTHS } from '../../domain/shared/initialSeedData';

const SOURCE_TYPES: { id: IncomeSourceType; label: string; icon: any }[] = [
  { id: 'emprendimiento', label: 'Emprendimiento', icon: Briefcase },
  { id: 'alquiler', label: 'Alquiler', icon: Home },
  { id: 'extraordinario', label: 'Extraordinario', icon: Sparkles }
];

const CATEGORIES = [
  'Desarrollo Software',
  'Consultoría',
  'Diseño & Marketing',
  'Servicios Profesionales',
  'Mantenimiento & Soporte',
  'Alquileres',
  'Cotización',
  'Venta de Bienes',
  'Otro'
];

interface VenturesPanelProps {
  onVenturesChange?: () => void;
}

export const VenturesPanel: React.FC<VenturesPanelProps> = ({ onVenturesChange }) => {
  const [ventures, setVentures] = useState<DomVentureDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSourceTab, setActiveSourceTab] = useState<'todos' | IncomeSourceType>('todos');
  const [selectedIncomeType, setSelectedIncomeType] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('activo');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modales
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'nuevo' | 'editar' | 'ver'>('nuevo');
  const [editingVenture, setEditingVenture] = useState<DomVentureDTO | null>(null);

  const [isProjectionGridOpen, setIsProjectionGridOpen] = useState<boolean>(false);
  const [selectedVentureForGrid, setSelectedVentureForGrid] = useState<DomVentureDTO | null>(null);
  const [tempGridProjections, setTempGridProjections] = useState<Record<string, number>>({});

  // Form State
  const [clientName, setClientName] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [sourceType, setSourceType] = useState<IncomeSourceType>('emprendimiento');
  const [incomeType, setIncomeType] = useState<IncomeNatureType>('fijo');
  const [category, setCategory] = useState<string>('Desarrollo Software');
  const [status, setStatus] = useState<'activo' | 'en_negociacion' | 'finalizado' | 'pausado'>('activo');
  const [baseMonthlyAmount, setBaseMonthlyAmount] = useState<number>(500000);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'cash' | 'card' | 'debit'>('cash');
  const [notes, setNotes] = useState<string>('');
  const [ipcIncreasePercent, setIpcIncreasePercent] = useState<string>('1.5');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const repository = useMemo(() => new SupabaseDomVentureRepository(), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await repository.getVentures(1);
      setVentures(fetched);
      onVenturesChange?.();
    } catch (err) {
      console.error('Error al cargar fuentes de ingresos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [repository]);

  const domainVentures = useMemo(() => ventures.map(v => new DomVenture(v)), [ventures]);

  // KPIs
  const activeVenturesCount = useMemo(() => {
    return domainVentures.filter(v => v.status === 'activo').length;
  }, [domainVentures]);

  const totalBusinessMonthly = useMemo(() => {
    return domainVentures
      .filter(v => v.status === 'activo' && v.sourceType === 'emprendimiento')
      .reduce((sum, v) => sum + v.baseMonthlyAmount, 0);
  }, [domainVentures]);

  const totalRentMonthly = useMemo(() => {
    return domainVentures
      .filter(v => v.status === 'activo' && v.sourceType === 'alquiler')
      .reduce((sum, v) => sum + v.baseMonthlyAmount, 0);
  }, [domainVentures]);

  const totalExtraMonthly = useMemo(() => {
    return domainVentures
      .filter(v => v.status === 'activo' && v.sourceType === 'extraordinario')
      .reduce((sum, v) => sum + v.baseMonthlyAmount, 0);
  }, [domainVentures]);

  const totalMonthlyAll = useMemo(() => {
    return totalBusinessMonthly + totalRentMonthly + totalExtraMonthly;
  }, [totalBusinessMonthly, totalRentMonthly, totalExtraMonthly]);

  // Filtrado
  const filteredVentures = useMemo(() => {
    return domainVentures.filter(v => {
      const matchesSearch =
        v.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab = activeSourceTab === 'todos' || v.sourceType === activeSourceTab;
      const matchesType = selectedIncomeType === 'todos' || v.incomeType === selectedIncomeType;
      const matchesStat = selectedStatus === 'todos' || v.status === selectedStatus;

      return matchesSearch && matchesTab && matchesType && matchesStat;
    });
  }, [domainVentures, searchTerm, activeSourceTab, selectedIncomeType, selectedStatus]);

  const totalPages = useMemo(() => Math.ceil(filteredVentures.length / pageSize) || 1, [filteredVentures.length, pageSize]);
  const paginatedVentures = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVentures.slice(start, start + pageSize);
  }, [filteredVentures, currentPage, pageSize]);

  // Handlers Modal Form
  const handleOpenNewModal = () => {
    setModalMode('nuevo');
    setEditingVenture(null);
    setClientName('');
    setProjectName('');
    setSourceType(activeSourceTab !== 'todos' ? activeSourceTab : 'emprendimiento');
    setCategory(activeSourceTab === 'alquiler' ? 'Alquileres' : 'Desarrollo Software');
    setStatus('activo');
    setIncomeType('fijo'); // Fijo por defecto
    setBaseMonthlyAmount(500000);
    setDefaultPaymentMethod('cash');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: DomVentureDTO) => {
    setModalMode('editar');
    setEditingVenture(v);
    setClientName(v.clientName);
    setProjectName(v.projectName);
    setSourceType(v.sourceType || 'emprendimiento');
    setCategory(v.category);
    setStatus(v.status);
    setIncomeType(v.incomeType || 'fijo');
    setBaseMonthlyAmount(v.baseMonthlyAmount);
    setDefaultPaymentMethod(v.defaultPaymentMethod);
    setNotes(v.notes || '');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (v: DomVentureDTO) => {
    setModalMode('ver');
    setEditingVenture(v);
    setClientName(v.clientName);
    setProjectName(v.projectName);
    setSourceType(v.sourceType || 'emprendimiento');
    setCategory(v.category);
    setStatus(v.status);
    setIncomeType(v.incomeType || 'fijo');
    setBaseMonthlyAmount(v.baseMonthlyAmount);
    setDefaultPaymentMethod(v.defaultPaymentMethod);
    setNotes(v.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'ver') return;

    if (!clientName.trim() || !projectName.trim()) {
      setFeedback({ text: 'Por favor complete el nombre del cliente/pagador y del concepto/proyecto.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const baseVal = baseMonthlyAmount || 0;

    let projections = editingVenture?.monthlyProjections || {};
    if (modalMode === 'nuevo' || Object.keys(projections).length === 0) {
      projections = INITIAL_MONTHS.reduce((acc, month, i) => {
        const factor = Math.pow(1 + (parseFloat(ipcIncreasePercent) || 1) / 100, i);
        acc[month] = Math.round(baseVal * factor);
        return acc;
      }, {} as Record<string, number>);
    }

    const payload: Partial<DomVentureDTO> = {
      id: editingVenture?.id,
      personaPadreId: 1,
      clientName: clientName.trim(),
      projectName: projectName.trim(),
      category,
      sourceType,
      incomeType,
      status,
      baseMonthlyAmount: baseVal,
      monthlyProjections: projections,
      defaultPaymentMethod,
      notes: notes.trim()
    };

    try {
      await repository.saveVenture(payload, 1);
      setFeedback({ text: `Ingreso ${modalMode === 'nuevo' ? 'registrado' : 'actualizado'} correctamente.`, type: 'success' });
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setFeedback({ text: 'Error al guardar la fuente de ingreso.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro "${name}"?`)) return;

    try {
      await repository.deleteVenture(id, 1);
      setFeedback({ text: 'Registro eliminado correctamente.', type: 'success' });
      await loadData();
    } catch (err) {
      setFeedback({ text: 'Error al eliminar el registro.', type: 'error' });
    }
  };

  const handleToggleStatus = async (v: DomVentureDTO) => {
    const nextStatus = v.status === 'activo' ? 'pausado' : 'activo';
    try {
      await repository.saveVenture({
        ...v,
        status: nextStatus
      }, 1);
      setFeedback({
        text: `Fuente "${v.clientName}" ${nextStatus === 'activo' ? 'activada' : 'desactivada'} correctamente.`,
        type: 'success'
      });
      await loadData();
    } catch (err) {
      setFeedback({ text: 'Error al cambiar estado de la fuente.', type: 'error' });
    }
  };

  // Grid de Proyecciones Mensuales Detalladas
  const handleOpenProjectionGrid = (v: DomVentureDTO) => {
    setSelectedVentureForGrid(v);
    const existing = v.monthlyProjections || {};
    const fullGrid = INITIAL_MONTHS.reduce((acc, month) => {
      acc[month] = existing[month] !== undefined ? existing[month] : v.baseMonthlyAmount;
      return acc;
    }, {} as Record<string, number>);

    setTempGridProjections(fullGrid);
    setIsProjectionGridOpen(true);
  };

  const handleApplyGlobalIncrease = () => {
    const rate = (parseFloat(ipcIncreasePercent) || 0) / 100;
    if (!selectedVentureForGrid) return;
    const base = selectedVentureForGrid.baseMonthlyAmount;

    const newGrid = INITIAL_MONTHS.reduce((acc, month, idx) => {
      acc[month] = Math.round(base * Math.pow(1 + rate, idx));
      return acc;
    }, {} as Record<string, number>);

    setTempGridProjections(newGrid);
  };

  const handleSaveProjectionGrid = async () => {
    if (!selectedVentureForGrid) return;
    setSubmitting(true);
    try {
      await repository.saveVenture(
        {
          ...selectedVentureForGrid,
          monthlyProjections: tempGridProjections
        },
        1
      );
      setIsProjectionGridOpen(false);
      setFeedback({ text: 'Proyección mensual actualizada.', type: 'success' });
      await loadData();
    } catch (err) {
      setFeedback({ text: 'Error al actualizar proyecciones.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Badge Source Type
  const getSourceBadge = (type: IncomeSourceType) => {
    switch (type) {
      case 'alquiler':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Home className="w-3 h-3" /> Alquiler
          </span>
        );
      case 'extraordinario':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3 h-3" /> Extraordinario
          </span>
        );
      case 'emprendimiento':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Briefcase className="w-3 h-3" /> Emprendimiento
          </span>
        );
    }
  };

  // Badge Status Helper
  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'activo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Activo
          </span>
        );
      case 'en_negociacion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> En Negociación
          </span>
        );
      case 'pausado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <PauseCircle className="w-3 h-3" /> Pausado
          </span>
        );
      case 'finalizado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <XCircle className="w-3 h-3" /> Finalizado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between font-medium text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* METRIC KPIS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Fuentes Activas
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-[#0088FF] rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {activeVenturesCount}
            </span>
            <span className="text-xs font-medium text-gray-500">de {domainVentures.length} totales</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Emprendimientos (Base)
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 table-cell-num">
              {Money.fromAmount(totalBusinessMonthly).toFormattedString()}
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Alquileres (Base)
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Home className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 table-cell-num">
              {Money.fromAmount(totalRentMonthly).toFormattedString()}
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Ingreso Total Mensual
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 table-cell-num">
              {Money.fromAmount(totalMonthlyAll).toFormattedString()}
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: BUSQUEDA, FILTROS Y TABLA */}
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* SEGMENTED TAB SELECTOR: TODOS / EMPRENDIMIENTOS / ALQUILERES / EXTRAORDINARIOS */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => { setActiveSourceTab('todos'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeSourceTab === 'todos'
                  ? 'bg-[#0088FF] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todas las Fuentes ({domainVentures.length})
            </button>
            <button
              onClick={() => { setActiveSourceTab('emprendimiento'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSourceTab === 'emprendimiento'
                  ? 'bg-[#0088FF] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Emprendimientos ({domainVentures.filter(v => v.sourceType === 'emprendimiento').length})
            </button>
            <button
              onClick={() => { setActiveSourceTab('alquiler'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSourceTab === 'alquiler'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Alquileres ({domainVentures.filter(v => v.sourceType === 'alquiler').length})
            </button>
            <button
              onClick={() => { setActiveSourceTab('extraordinario'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSourceTab === 'extraordinario'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Extraordinarios ({domainVentures.filter(v => v.sourceType === 'extraordinario').length})
            </button>
          </div>

          <button
            onClick={handleOpenNewModal}
            className="bg-[#0088FF] hover:bg-[#0077EE] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Fuente de Ingreso
          </button>
        </div>

        {/* FILTROS SECUNDARIOS Y BUSCADOR */}
        <TableSearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Buscar por cliente, proyecto, propiedad o concepto..."
          extraControls={
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Tipo Fijo/Proyectado */}
              <select
                value={selectedIncomeType}
                onChange={e => setSelectedIncomeType(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 outline-none cursor-pointer"
              >
                <option value="todos">Modalidad: Todas</option>
                <option value="fijo">Solo Fijos</option>
                <option value="proyectado">Solo Proyectados</option>
              </select>

              {/* Estado Filter */}
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 outline-none cursor-pointer"
              >
                <option value="activo">Solo Activas (Por defecto)</option>
                <option value="todos">Estado: Todas</option>
                <option value="pausado">Inactivas / Pausadas</option>
                <option value="en_negociacion">En Negociación</option>
                <option value="finalizado">Finalizadas</option>
              </select>
            </div>
          }
        />

        {/* TABLA DE FUENTES DE INGRESOS */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-[#0088FF] animate-spin" />
              <p className="text-xs font-semibold text-gray-500">Cargando fuentes de ingresos...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3.5 px-4">Fuente</th>
                    <th className="py-3.5 px-4">Cliente / Inquilino / Pagador</th>
                    <th className="py-3.5 px-4">Proyecto / Inmueble / Concepto</th>
                    <th className="py-3.5 px-4">Modalidad</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4 text-right">Monto Base Mensual</th>
                    <th className="py-3.5 px-4 text-right">Proyección Ago-26</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {paginatedVentures.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                      <td className="py-3.5 px-4">{getSourceBadge(item.sourceType)}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-gray-100">
                        {item.clientName}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300 max-w-xs truncate" title={item.projectName}>
                        {item.projectName}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.incomeType === 'proyectado' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            Proyectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Fijo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.dto)}
                          className="cursor-pointer transition-transform hover:scale-105 active:scale-95 text-left outline-none"
                          title={item.status === 'activo' ? 'Click para pausar/desactivar' : 'Click para activar'}
                        >
                          {getStatusBadge(item.status)}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-gray-100 table-cell-num text-sm">
                        {Money.fromAmount(item.baseMonthlyAmount).toFormattedString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 table-cell-num text-sm">
                        {Money.fromAmount(item.getProjectionForMonth('Ago-26')).toFormattedString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(item.dto)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              item.status === 'activo'
                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={item.status === 'activo' ? 'Desactivar Fuente' : 'Activar Fuente'}
                          >
                            {item.status === 'activo' ? (
                              <Power className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenProjectionGrid(item.dto)}
                            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Ver / Ajustar Proyección Mensual Detallada"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenViewModal(item.dto)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item.dto)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.clientName)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVentures.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">
                        No se encontraron registros coincidentes con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD FOOTER CON PAGINACION */}
          {!loading && filteredVentures.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40 text-xs text-gray-500 font-medium">
              <div>
                Mostrando <span className="font-bold text-gray-900 dark:text-white">{paginatedVentures.length}</span> de <span className="font-bold text-gray-900 dark:text-white">{filteredVentures.length}</span> registros
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 cursor-pointer text-gray-900 dark:text-white"
                >
                  Anterior
                </button>

                <span className="font-bold text-gray-700 dark:text-gray-300 px-2">
                  Página {currentPage} de {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 cursor-pointer text-gray-900 dark:text-white"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVA / EDITAR FUENTE DE INGRESO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            {/* MODAL HEADER */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0088FF]/10 text-[#0088FF] rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {modalMode === 'nuevo' && 'Nueva Fuente de Ingreso'}
                    {modalMode === 'editar' && 'Editar Fuente de Ingreso'}
                    {modalMode === 'ver' && 'Detalle de Fuente de Ingreso'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registre o modifique ingresos por emprendimientos, alquileres o ingresos extraordinarios
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY FORM */}
            <form onSubmit={handleSaveVenture} className="p-6 space-y-4">
              {/* TIPO DE FUENTE (EMPRENDIMIENTO / ALQUILER / EXTRAORDINARIO) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipo de Fuente de Ingreso *
                </label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {SOURCE_TYPES.map(st => {
                    const Icon = st.icon;
                    const isSelected = sourceType === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={modalMode === 'ver'}
                        onClick={() => {
                          setSourceType(st.id);
                          if (st.id === 'alquiler') setCategory('Alquileres');
                        }}
                        className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0088FF] text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MODALIDAD FIJO / PROYECTADO */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Modalidad de Ingreso *
                </label>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <button
                    type="button"
                    disabled={modalMode === 'ver'}
                    onClick={() => setIncomeType('fijo')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      incomeType === 'fijo'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Fijo (Contrato / Canon Asegurado)
                  </button>
                  <button
                    type="button"
                    disabled={modalMode === 'ver'}
                    onClick={() => setIncomeType('proyectado')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      incomeType === 'proyectado'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Proyectado (Estimado / Supuesto)
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {incomeType === 'fijo'
                    ? 'Fijo: Ingreso pactado y confirmado recurrentemente.'
                    : 'Proyectado: Lo que se supone o estima que se va a generar.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente / Inquilino / Pagador */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {sourceType === 'alquiler'
                      ? 'Inquilino / Responsable *'
                      : sourceType === 'extraordinario'
                      ? 'Origen / Pagador *'
                      : 'Cliente / Razón Social *'}
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'ver'}
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder={
                      sourceType === 'alquiler'
                        ? 'Ej: Inquilino Juan Pérez'
                        : sourceType === 'extraordinario'
                        ? 'Ej: Venta de Rodado / Premio'
                        : 'Ej: Empresa ABC S.A.'
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70"
                  />
                </div>

                {/* Proyecto / Inmueble / Concepto */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {sourceType === 'alquiler'
                      ? 'Inmueble / Unidad *'
                      : sourceType === 'extraordinario'
                      ? 'Concepto / Motivo *'
                      : 'Proyecto / Servicio *'}
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'ver'}
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder={
                      sourceType === 'alquiler'
                        ? 'Ej: Depto 2 Ambientes Centro'
                        : sourceType === 'extraordinario'
                        ? 'Ej: Ingreso por Asesoría Excepcional'
                        : 'Ej: Desarrollo Sistema Web'
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Categoría
                  </label>
                  <select
                    disabled={modalMode === 'ver'}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70 cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado: Botón Activar / Desactivar */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Estado de la Fuente *
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <button
                      type="button"
                      disabled={modalMode === 'ver'}
                      onClick={() => setStatus('activo')}
                      className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        status === 'activo'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Activo</span>
                    </button>
                    <button
                      type="button"
                      disabled={modalMode === 'ver'}
                      onClick={() => setStatus('pausado')}
                      className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        status === 'pausado' || status === 'finalizado'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Desactivado</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monto Base Mensual */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Monto Mensual Base (ARS)
                  </label>
                  <FormattedNumberInput
                    value={baseMonthlyAmount}
                    onChange={setBaseMonthlyAmount}
                    placeholder="0,00"
                    disabled={modalMode === 'ver'}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70"
                  />
                </div>

                {/* Medio de Cobro */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Medio de Cobro Predeterminado
                  </label>
                  <select
                    disabled={modalMode === 'ver'}
                    value={defaultPaymentMethod}
                    onChange={e => setDefaultPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70 cursor-pointer"
                  >
                    <option value="cash">Efectivo / Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="debit">Débito Automático</option>
                  </select>
                </div>
              </div>

              {/* Tasa mensual proyectada inicial */}
              {modalMode === 'nuevo' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Ajuste Mensual Proyectado (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ipcIncreasePercent}
                    onChange={e => setIpcIncreasePercent(e.target.value)}
                    placeholder="1.5"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Se aplicará a los 17 períodos. Podrá ajustar cada mes individualmente en la grilla.
                  </p>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  disabled={modalMode === 'ver'}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalles del contrato, condiciones de facturación o acuerdos particulares..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none disabled:opacity-70"
                />
              </div>

              {/* MODAL FOOTER */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {modalMode === 'ver' ? 'Cerrar' : 'Cancelar'}
                </button>
                {modalMode !== 'ver' && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#0088FF] hover:bg-[#0077EE] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {modalMode === 'nuevo' ? 'Guardar Fuente de Ingreso' : 'Guardar Cambios'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PROYECCION POR MESES */}
      {isProjectionGridOpen && selectedVentureForGrid && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* HEADER */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Proyección Mensual Detallada: {selectedVentureForGrid.clientName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedVentureForGrid.projectName} — Ingrese o ajuste el monto proyectado para cada mes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProjectionGridOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BARRA DE HERRAMIENTAS / INCREMENTO AUTOMATICO */}
            <div className="p-4 bg-purple-500/5 border-b border-purple-500/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  Aplicar Crecimiento Acumulado Mensual:
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={ipcIncreasePercent}
                  onChange={e => setIpcIncreasePercent(e.target.value)}
                  className="w-20 px-2.5 py-1 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-xs font-bold text-center outline-none"
                />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">% / mes</span>
                <button
                  onClick={handleApplyGlobalIncrease}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer transition-all"
                >
                  Recalcular Grilla
                </button>
              </div>

              <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
                Total 17 Meses:{' '}
                <span className="text-purple-600 dark:text-purple-400 table-cell-num">
                  {Money.fromAmount(
                    Object.values(tempGridProjections).reduce((a, b) => a + b, 0)
                  ).toFormattedString()}
                </span>
              </div>
            </div>

            {/* BODY GRID PERMESES */}
            <div className="p-6 overflow-y-auto max-h-[50vh] scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {INITIAL_MONTHS.map(month => (
                  <div
                    key={month}
                    className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl"
                  >
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {month}
                    </label>
                    <FormattedNumberInput
                      value={tempGridProjections[month] || 0}
                      onChange={val => {
                        setTempGridProjections(prev => ({
                          ...prev,
                          [month]: val
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/40">
              <button
                type="button"
                onClick={() => setIsProjectionGridOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProjectionGrid}
                disabled={submitting}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar Proyección Detallada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
