import { FormattedNumberInput } from './FormattedNumberInput';
import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseDomAccountingRepository, DEFAULT_DOM_ACCOUNTS } from '../../infrastructure/SupabaseDomAccountingRepository';
import { DomFiscalYearDTO } from '../../domain/repositories/IAccountingRepository';
import { Calendar, CheckCircle2, Lock, Play, RotateCcw, Plus, AlertCircle, Check, Loader2, Search } from 'lucide-react';

interface FiscalYearsSectionProps {
  onRefreshData?: () => void;
}

export const FiscalYearsSection: React.FC<FiscalYearsSectionProps> = ({ onRefreshData }) => {
  const [fiscalYears, setFiscalYears] = useState<DomFiscalYearDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Fiscal Year modal / form state
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);
  const [newStartDate, setNewStartDate] = useState<string>(`${new Date().getFullYear() + 1}-01-01`);
  const [newEndDate, setNewEndDate] = useState<string>(`${new Date().getFullYear() + 1}-12-31`);

  // Confirmation Modal state for Refundición
  const [closingYearTarget, setClosingYearTarget] = useState<DomFiscalYearDTO | null>(null);

  // Opening Entry Modal state
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState<boolean>(false);
  const [openingTargetYear, setOpeningTargetYear] = useState<DomFiscalYearDTO | null>(null);
  const [openingSearch, setOpeningSearch] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [openingAccounts, setOpeningAccounts] = useState<Array<{
    accountId: number;
    code: string;
    name: string;
    kind: string;
    nature: string;
    openingBalance: number;
  }>>([]);

  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);

  const loadFiscalYears = async () => {
    try {
      setLoading(true);
      const data = await accountingRepo.getFiscalYears(1);
      setFiscalYears(data);
    } catch (err: any) {
      console.error('Error al cargar ejercicios económicos:', err);
      setBannerMessage({ text: err.message || 'Error al cargar ejercicios económicos', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiscalYears();
  }, []);

  const handleOpenNewModal = () => {
    const years = fiscalYears.map(f => f.year);
    const maxYear = years.length > 0 ? Math.max(...years) : 2025;
    const nextY = maxYear + 1;
    setNewYear(nextY);
    setNewStartDate(`${nextY}-01-01`);
    setNewEndDate(`${nextY}-12-31`);
    setIsNewModalOpen(true);
  };

  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fiscalYears.some(f => f.year === newYear)) {
      setBannerMessage({
        text: `El Ejercicio Económico ${newYear} ya se encuentra abierto o registrado en el sistema.`,
        type: 'error'
      });
      return;
    }

    try {
      setActionLoadingId(-1);
      await accountingRepo.createFiscalYear({
        personaPadreId: 1,
        year: newYear,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'open'
      });
      setBannerMessage({ text: `Ejercicio Económico ${newYear} abierto con éxito.`, type: 'success' });
      setIsNewModalOpen(false);
      await loadFiscalYears();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setBannerMessage({ text: err.message || 'Error al crear ejercicio económico', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenOpeningModal = async (fy: DomFiscalYearDTO) => {
    try {
      setActionLoadingId(fy.id);
      setModalError(null);
      const fetched = await accountingRepo.getAccounts(1);
      const allAccs = (fetched && fetched.length > 0) ? fetched : DEFAULT_DOM_ACCOUNTS;

      setOpeningAccounts(allAccs.map(a => ({
        accountId: a.id,
        code: a.code,
        name: a.name,
        kind: a.kind,
        nature: a.nature,
        openingBalance: a.openingBalance || 0
      })));
      setOpeningSearch('');
      setOpeningTargetYear(fy);
      setIsOpeningModalOpen(true);
    } catch (err: any) {
      setBannerMessage({ text: err.message || 'Error al cargar cuentas contables para apertura', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpeningBalanceChange = (accountId: number, val: number) => {
    setOpeningAccounts(prev => prev.map(a => a.accountId === accountId ? { ...a, openingBalance: val } : a));
  };

  const handleConfirmOpeningEntry = async () => {
    if (!openingTargetYear) return;
    try {
      setActionLoadingId(openingTargetYear.id);
      setModalError(null);

      // 1. Validar que al menos una cuenta tenga saldo != 0
      const activeAccounts = openingAccounts.filter(a => Math.abs(Number(a.openingBalance || 0)) > 0);
      if (activeAccounts.length === 0) {
        setModalError('Debe ingresar al menos un saldo inicial en las cuentas patrimoniales para generar el Asiento de Apertura.');
        setActionLoadingId(null);
        return;
      }

      // 2. Persistir saldos iniciales en dom_accounts
      await accountingRepo.updateAccountOpeningBalances(1, openingAccounts.map(a => ({
        accountId: a.accountId,
        openingBalance: Number(a.openingBalance || 0)
      })));

      // 3. Generar Asiento de Apertura
      const res = await accountingRepo.recordOpeningEntry(1, openingTargetYear.id, openingTargetYear.year);
      setBannerMessage({ text: res.message || `Asiento de Apertura generado con éxito (N° ${res.entryNumber}).`, type: 'success' });
      setIsOpeningModalOpen(false);
      setOpeningTargetYear(null);
      await loadFiscalYears();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error al registrar asiento de apertura:', err);
      setModalError(err.message || 'Error al registrar asiento de apertura');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCloseFiscalYear = async () => {
    if (!closingYearTarget) return;
    try {
      setActionLoadingId(closingYearTarget.id);
      const res = await accountingRepo.closeFiscalYear(1, closingYearTarget.id, closingYearTarget.year);
      setBannerMessage({ text: res.message || `Ejercicio ${closingYearTarget.year} cerrado y Asiento de Refundición generado (N° ${res.entryNumber}).`, type: 'success' });
      setClosingYearTarget(null);
      await loadFiscalYears();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setBannerMessage({ text: err.message || 'Error al cerrar el ejercicio económico', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* HEADER SECCIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#0088FF]" />
            Gestión de Ejercicios Económicos y Saldos Iniciales
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Administración de períodos contables anuales, Asiento de Apertura (`APERTURA`) y Asiento de Refundición de Resultados (`REFUNDICION`) al Cierre de Ejercicio
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          className="px-4 py-2 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Ejercicio Económico</span>
        </button>
      </div>

      {/* BANNER DE NOTIFICACIÓN */}
      {bannerMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
          bannerMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-xs underline hover:no-underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* CARGANDO */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#0088FF]" />
          <span className="text-xs text-gray-500 ml-2 font-medium">Cargando ejercicios económicos...</span>
        </div>
      ) : fiscalYears.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-[#1E293B]/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">No hay ejercicios económicos registrados</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Haga clic en "Nuevo Ejercicio Económico" para abrir el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fiscalYears.map((fy) => {
            const isOpen = fy.status === 'open';
            const isWorking = actionLoadingId === fy.id;

            return (
              <div
                key={fy.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isOpen
                    ? 'bg-white dark:bg-[#1E293B] border-emerald-300 dark:border-emerald-700/60 shadow-sm'
                    : 'bg-gray-50/70 dark:bg-[#0F172A]/70 border-gray-200 dark:border-gray-800 opacity-90'
                }`}
              >
                {/* HEAD DE TARJETA */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-gray-900 dark:text-white">
                      Ejercicio Económico {fy.year}
                    </span>
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      ({fy.startDate} al {fy.endDate})
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                    isOpen
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
                  }`}>
                    {isOpen ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Abierto</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-gray-500" />
                        <span>Cerrado</span>
                      </>
                    )}
                  </span>
                </div>

                {/* DETALLES DE ASIENTOS ESPECIALES */}
                <div className="py-4 space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Asiento de Apertura (`APERTURA`):</span>
                    {fy.openingEntryId ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Registrado (Asiento N° {fy.openingEntryId})
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Pendiente de Generación
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Asiento de Refundición (`REFUNDICION`):</span>
                    {fy.closingEntryId ? (
                      <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        Registrado (Asiento N° {fy.closingEntryId})
                      </span>
                    ) : (
                      <span className="font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                        Pendiente de Cierre
                      </span>
                    )}
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                {isOpen && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isWorking || !!fy.openingEntryId}
                      onClick={() => handleOpenOpeningModal(fy)}
                      className={`flex-1 px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        fy.openingEntryId
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      {isWorking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{fy.openingEntryId ? 'Apertura Registrada' : 'Generar Asiento Apertura'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => setClosingYearTarget(fy)}
                      className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isWorking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Cerrar Ejercicio (Refundición)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CONFIGURACIÓN DE SALDOS INICIALES Y ASIENTO DE APERTURA */}
      {isOpeningModalOpen && openingTargetYear && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-500" />
                  Saldos Iniciales y Asiento de Apertura {openingTargetYear.year}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ingrese o verifique los saldos de apertura al 01/01/{openingTargetYear.year} para las cuentas patrimoniales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpeningModalOpen(false);
                  setOpeningTargetYear(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* MENSAJE DE ERROR DENTRO DEL MODAL */}
            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            {/* BUSCADOR DE CUENTAS */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar cuenta por código o nombre (ej: Caja, Banco, Proveedores, Capital)..."
                value={openingSearch}
                onChange={(e) => setOpeningSearch(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white shadow-xs"
              />
            </div>

            {/* LISTADO DE CUENTAS PATRIMONIALES CON INPUT */}
            <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[50vh] space-y-2 pr-1">
              <table className="w-full min-w-[500px] text-xs text-left">
                <thead className="bg-gray-50 dark:bg-[#1E293B] text-gray-500 dark:text-gray-400 sticky top-0 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Código / Cuenta</th>
                    <th className="py-2 px-3">Naturaleza</th>
                    <th className="py-2 px-3 text-right">Saldo Inicial ($ ARS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {openingAccounts
                    .filter(a =>
                      a.code.toLowerCase().includes(openingSearch.toLowerCase()) ||
                      a.name.toLowerCase().includes(openingSearch.toLowerCase())
                    )
                    .map((acc) => {
                      const isDebit = acc.kind === 'asset' || acc.nature === 'debit';
                      return (
                        <tr key={acc.accountId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3">
                            <span className="font-mono text-[11px] text-gray-400 mr-2">{acc.code}</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{acc.name}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDebit 
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' 
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {isDebit ? 'DEBE (Activo/Egreso)' : 'HABER (Pasivo/PN/Ingreso)'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <FormattedNumberInput
                              value={acc.openingBalance}
                              onChange={(val) => handleOpeningBalanceChange(acc.accountId, val)}
                              className="w-36 text-xs p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* RESUMEN PARTIDA DOBLE */}
            {(() => {
              const debitTotal = openingAccounts
                .filter(a => a.kind === 'asset' || a.nature === 'debit')
                .reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);
              const creditTotal = openingAccounts
                .filter(a => a.kind !== 'asset' && a.nature !== 'debit')
                .reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);
              const diff = debitTotal - creditTotal;

              return (
                <div className="bg-gray-50 dark:bg-[#1E293B] p-4 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700 text-xs">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-600 dark:text-gray-400">Total Debe (Activo):</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">${debitTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-600 dark:text-gray-400">Total Haber (Pasivo + PN registrado):</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">${creditTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center font-black pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-800 dark:text-gray-200">Ajuste Automático a Capital Neto (`3.1.01.01`):</span>
                    <span className={`font-mono ${diff !== 0 ? 'text-amber-500' : 'text-gray-500'}`}>
                      ${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* BOTONES ACCIÓN */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsOpeningModalOpen(false);
                  setOpeningTargetYear(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmOpeningEntry}
                disabled={actionLoadingId === openingTargetYear.id}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {actionLoadingId === openingTargetYear.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Registrando Asiento...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Confirmar y Generar Asiento de Apertura</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO EJERCICIO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0088FF]" />
              Abrir Nuevo Ejercicio Económico
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Complete los datos del nuevo período fiscal contable para el hogar/empresa.
            </p>

            <form onSubmit={handleCreateFiscalYear} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Año del Ejercicio</label>
                <input
                  type="number"
                  required
                  value={newYear}
                  onChange={(e) => {
                    const y = parseInt(e.target.value) || new Date().getFullYear();
                    setNewYear(y);
                    setNewStartDate(`${y}-01-01`);
                    setNewEndDate(`${y}-12-31`);
                  }}
                  className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fecha Cierre</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === -1}
                  className="px-4 py-2 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {actionLoadingId === -1 ? 'Guardando...' : 'Abrir Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN REFUNDICIÓN DE RESULTADOS */}
      {closingYearTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Confirmar Cierre y Refundición Ejercicio {closingYearTarget.year}
              </h3>
            </div>

            <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2 text-xs text-rose-900 dark:text-rose-200">
              <p className="font-bold">¿Desea ejecutar la Refundición de Cuentas de Resultado?</p>
              <ul className="list-disc list-inside space-y-1 text-rose-800 dark:text-rose-300">
                <li>Se debitarán todas las cuentas de Ingresos para dejarlas en cero.</li>
                <li>Se acreditarán todas las cuentas de Egresos para dejarlas en cero.</li>
                <li>El resultado neto del ejercicio (Superávit/Déficit) se refundirá en la cuenta de Patrimonio Neto **3.1.01.01 Capital Neto del Hogar**.</li>
                <li>El estado del Ejercicio Económico **{closingYearTarget.year}** pasará a ser **CERRADO**.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingYearTarget(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseFiscalYear}
                disabled={actionLoadingId === closingYearTarget.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {actionLoadingId === closingYearTarget.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ejecutando Refundición...</span>
                  </>
                ) : (
                  <span>Ejecutar Refundición y Cerrar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
