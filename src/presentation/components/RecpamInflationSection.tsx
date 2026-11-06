import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  TrendingDown,
  TrendingUp,
  Calculator,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  CreditCard,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { SupabaseDomAccountingRepository } from '../../infrastructure/SupabaseDomAccountingRepository';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { Money } from '../../domain/shared/Money';
import { argentinaDate } from '../../domain/shared/argentinaDate';
import { useDomesticAccess } from '../auth/DomesticAuthGate';
import { supabase } from '../../infrastructure/supabaseClient';

export const RecpamInflationSection: React.FC = () => {
  const { personaPadreId } = useDomesticAccess();
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);

  const [accounts, setAccounts] = useState<DomAccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [ipcRate, setIpcRate] = useState<number>(3.5); // % mensual sugerido
  const [periodMonth, setPeriodMonth] = useState<string>(argentinaDate().slice(0, 7)); // YYYY-MM
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await accountingRepo.getAccounts(personaPadreId);
      setAccounts(data);

      // Intentar cargar IPC guardado para el mes
      const { data: paramData } = await supabase
        .from('dom_monthly_parameters')
        .select('ipc_rate')
        .eq('persona_padre_id', personaPadreId)
        .eq('month_period', periodMonth)
        .maybeSingle();

      if (paramData?.ipc_rate) {
        setIpcRate(Number(paramData.ipc_rate));
      }
    } catch {
      // Ignorar fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [personaPadreId, periodMonth]);

  // 1. Partidas Monetarias Activas (Caja y Cuentas Bancarias en ARS)
  const monetaryAssets = useMemo(() => {
    return accounts.filter(
      a => !a.isArchived && a.kind === 'asset' &&
      (a.code.startsWith('1.1.01.') || ['1.1.02.01', '1.1.02.02'].includes(a.code))
    );
  }, [accounts]);

  const totalMonetaryAssets = useMemo(() => {
    return monetaryAssets.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
  }, [monetaryAssets]);

  // 2. Partidas Monetarias Pasivas (Deudas y Tarjetas en ARS)
  const monetaryLiabilities = useMemo(() => {
    return accounts.filter(
      a => !a.isArchived && a.kind === 'liability' &&
      (a.code.startsWith('2.1.01.') || a.code.startsWith('2.2.01.'))
    );
  }, [accounts]);

  const totalMonetaryLiabilities = useMemo(() => {
    return monetaryLiabilities.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
  }, [monetaryLiabilities]);

  // 3. Posición Monetaria Neta
  const netMonetaryPosition = useMemo(() => {
    return totalMonetaryAssets - totalMonetaryLiabilities;
  }, [totalMonetaryAssets, totalMonetaryLiabilities]);

  // 4. RECPAM del Período (RT 6)
  // Posición neta activa genera pérdida; posición neta pasiva genera ganancia (licuación)
  const recpamAmount = useMemo(() => {
    const rateDecimal = ipcRate / 100;
    return -netMonetaryPosition * rateDecimal;
  }, [netMonetaryPosition, ipcRate]);

  // 5. Registrar Asiento Contable del RECPAM
  const handlePostRecpam = async () => {
    if (Math.abs(recpamAmount) < 0.01) {
      setFeedback({ text: 'El monto de RECPAM calculado es irrelevante ($0.00).', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      // Cuentas de ajuste contable en el plan
      const rxtLossAccount = accounts.find(a => a.code === '5.2.02.01') || accounts.find(a => a.code === '5.2.01.01');
      const rxtGainAccount = accounts.find(a => a.code === '4.2.02.01') || accounts.find(a => a.code === '4.2.01.01');
      const capitalAccount = accounts.find(a => a.code === '3.1.01.01');

      if (!capitalAccount || (!rxtLossAccount && !rxtGainAccount)) {
        throw new Error('Faltan cuentas de ajuste de resultados o capital en el plan contable.');
      }

      const absAmount = Math.abs(recpamAmount);
      const isLoss = recpamAmount < 0;

      // Si es pérdida por inflación (RECPAM negativo): Debita 5.2.xx y Acredita 3.1.xx o cuenta de ajuste
      // Si es ganancia por licuación de deuda: Debita 3.1.xx y Acredita 4.2.xx
      const debitAccountId = isLoss ? rxtLossAccount!.id : capitalAccount.id;
      const creditAccountId = isLoss ? capitalAccount.id : rxtGainAccount!.id;

      const res = await accountingRepo.recordJournalEntry({
        personaPadreId,
        entryDate: argentinaDate(),
        description: `[RECPAM RT 6] Ajuste por Inflación Mes ${periodMonth} (IPC ${ipcRate}%)`,
        referenceId: `RECPAM-${periodMonth}-${Date.now()}`,
        lines: [
          { personaPadreId, accountId: debitAccountId, debit: absAmount, credit: 0, memo: isLoss ? 'Pérdida por exposición a la inflación (RECPAM)' : 'Ajuste de pasivos por inflación' },
          { personaPadreId, accountId: creditAccountId, debit: 0, credit: absAmount, memo: isLoss ? 'Ajuste de capital monetario expuesto' : 'Ganancia por licuación monetaria (RECPAM)' }
        ]
      });

      if (res.success) {
        // Guardar parámetro de IPC en base
        await supabase
          .from('dom_monthly_parameters')
          .upsert({
            persona_padre_id: personaPadreId,
            month_period: periodMonth,
            ipc_rate: ipcRate,
            updated_at: new Date().toISOString()
          }, { onConflict: 'persona_padre_id,month_period' });

        setFeedback({
          text: `Ajuste por Inflación asentado con éxito. Asiento Nº ${res.entryNumber} registrado en el Libro Diario.`,
          type: 'success'
        });
        await loadData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al asentar RECPAM.';
      setFeedback({ text: message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Ajuste por Inflación en Moneda Homogénea (RT 6)</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Determinación del RECPAM sobre partidas monetarias netas del hogar y registro de moneda homogénea.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0088FF]" />}
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Período:</label>
          <input
            type="month"
            value={periodMonth}
            onChange={e => setPeriodMonth(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1E293B] text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]"
          />
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* MÉTRICAS DE EXPOSICIÓN MONETARIA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Activos Monetarios */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-[#1E293B]/40">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="font-semibold">Activos Monetarios (ARS)</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {Money.fromAmount(totalMonetaryAssets).toFormattedString()}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Caja efectivo y cuentas bancarias en pesos
          </p>
        </div>

        {/* Pasivos Monetarios */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-[#1E293B]/40">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="font-semibold">Pasivos Monetarios (ARS)</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {Money.fromAmount(totalMonetaryLiabilities).toFormattedString()}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Deuda de tarjetas y proveedores pendientes
          </p>
        </div>

        {/* Posición Monetaria Neta */}
        <div className={`p-4 rounded-xl border ${netMonetaryPosition >= 0 ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20' : 'border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20'}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Posición Monetaria Neta</span>
            <ShieldCheck className="w-4 h-4 text-[#0088FF]" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {Money.fromAmount(netMonetaryPosition).toFormattedString()}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            {netMonetaryPosition >= 0 ? 'Expuesta a pérdida por inflación' : 'Pasivo monetario licuable por inflación'}
          </p>
        </div>
      </div>

      {/* CALCULADORA DE RECPAM Y TASA IPC */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1E293B]/60 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">Tasa de Inflación IPC del Mes (%)</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Variación oficial INDEC / FACPCE para {periodMonth}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={ipcRate}
              onChange={e => setIpcRate(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0F172A] text-sm font-bold text-gray-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-[#0088FF]"
            />
            <span className="text-sm font-bold text-gray-500">%</span>
          </div>
        </div>

        {/* RESULTADO ESTIMADO RECPAM */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {recpamAmount < 0 ? (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {recpamAmount < 0 ? 'Pérdida por Inflación (RECPAM Negativo)' : 'Ganancia por Inflación (RECPAM Positivo)'}
              </span>
            </div>
            <p className="text-xl font-black mt-1 text-gray-900 dark:text-white">
              {Money.fromAmount(Math.abs(recpamAmount)).toFormattedString()}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {recpamAmount < 0
                ? 'Erosión real del poder adquisitivo de tu efectivo y saldos bancarios en pesos.'
                : 'Beneficio financiero obtenido por mantener pasivos que se licúan frente a la inflación.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePostRecpam}
            disabled={submitting || Math.abs(recpamAmount) < 0.01}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Asentando...</span>
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>Asentar RECPAM en Libro Diario</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

