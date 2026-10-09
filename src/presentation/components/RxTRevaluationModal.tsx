import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Calculator, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { SupabaseDomAccountingRepository } from '../../infrastructure/SupabaseDomAccountingRepository';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';
import { Money } from '../../domain/shared/Money';
import { FormattedNumberInput } from './FormattedNumberInput';

interface RxTRevaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DomAccountDTO[];
  onSuccess?: () => void;
}

export const RxTRevaluationModal: React.FC<RxTRevaluationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSuccess
}) => {
  const accountingRepo = useMemo(() => new SupabaseDomAccountingRepository(), []);

  // Filter asset accounts eligible for RxT revaluation
  const assetAccounts = useMemo(() => {
    return accounts.filter(a => a.kind === 'asset');
  }, [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<number>(() => {
    const usdAcc = assetAccounts.find(a => a.code === '1.1.02.03') || assetAccounts[0];
    return usdAcc ? usdAcc.id : 0;
  });

  const [unitsCount, setUnitsCount] = useState<number>(1000);
  const [unitRate, setUnitRate] = useState<number>(1350);
  const [useUnitCalculator, setUseUnitCalculator] = useState<boolean>(true);
  const [targetTotalValue, setTargetTotalValue] = useState<number>(0);
  const [concept, setConcept] = useState<string>('Ajuste por Revaluación a Valor de Cotización (RxT)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const currentAccount = assetAccounts.find(a => a.id === selectedAccountId) || assetAccounts[0];
  const bookBalance = currentAccount ? currentAccount.currentBalance : 0;

  // Calculate Market Target Value
  const calculatedMarketValue = useUnitCalculator
    ? (unitsCount || 0) * (unitRate || 0)
    : (targetTotalValue || 0);

  const rxtDifference = calculatedMarketValue - bookBalance;
  const isGain = rxtDifference >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    if (Math.abs(rxtDifference) < 0.01) {
      setFeedback({ text: 'No existe diferencia entre el valor de mercado y el valor en libros.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      // Find RxT Income / Expense accounts
      const rxtIncomeAcc = accounts.find(a => a.code === '4.2.02.01') || accounts.find(a => a.name.includes('Tenencia Positivo'));
      const rxtExpenseAcc = accounts.find(a => a.code === '5.2.02.01') || accounts.find(a => a.name.includes('Tenencia Negativo'));

      if (!rxtIncomeAcc || !rxtExpenseAcc) {
        throw new Error('No se encontraron las cuentas contables de Resultado por Tenencia (4.2.02.01 y 5.2.02.01).');
      }

      const diffAbs = Math.abs(rxtDifference);
      const lines: Array<{ personaPadreId: number; accountId: number; debit: number; credit: number; memo: string }> = [];

      if (isGain) {
        // RxT Positivo (Ganancia)
        // DEBE: Cuenta de Activo (+ Activo)
        lines.push({
          personaPadreId: 1,
          accountId: currentAccount.id,
          debit: diffAbs,
          credit: 0,
          memo: `Revaluación RxT Positivo ${currentAccount.code}`
        });
        // HABER: Cuenta de Ingreso / Ganancia por Tenencia
        lines.push({
          personaPadreId: 1,
          accountId: rxtIncomeAcc.id,
          debit: 0,
          credit: diffAbs,
          memo: `Ganancia por Tenencia ${currentAccount.code}`
        });
      } else {
        // RxT Negativo (Pérdida)
        // DEBE: Cuenta de Egreso / Pérdida por Tenencia
        lines.push({
          personaPadreId: 1,
          accountId: rxtExpenseAcc.id,
          debit: diffAbs,
          credit: 0,
          memo: `Pérdida por Tenencia ${currentAccount.code}`
        });
        // HABER: Cuenta de Activo (- Activo)
        lines.push({
          personaPadreId: 1,
          accountId: currentAccount.id,
          debit: 0,
          credit: diffAbs,
          memo: `Desvalorización RxT Negativo ${currentAccount.code}`
        });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const res = await accountingRepo.recordJournalEntry({
        personaPadreId: 1,
        entryDate: todayStr,
        description: `${concept} - ${currentAccount.name}`,
        referenceId: `AJU-RXT-${Date.now().toString().slice(-4)}`,
        lines
      });

      if (res.success) {
        setFeedback({
          text: `Asiento de Revaluación RxT N° ${res.entryNumber} registrado con éxito (${isGain ? 'Ganancia' : 'Pérdida'} de ${Money.fromAmount(diffAbs).toFormattedString()}).`,
          type: 'success'
        });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error al registrar revaluación RxT:', err);
      setFeedback({ text: err.message || 'Error al registrar revaluación contable.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] overflow-hidden transition-all flex flex-col">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1E293B]/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#0088FF] text-white p-2 sm:p-2.5 rounded-xl shadow-md shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">Revaluación y RxT</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Ajuste periódico a valor de mercado / cotización</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className={`mx-4 sm:mx-6 mt-4 p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* SELECTOR CUENTA DE ACTIVO */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Cuenta de Activo a Revaluar
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
              className="w-full text-xs font-semibold p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none"
            >
              {assetAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} (Saldo actual: {Money.fromAmount(acc.currentBalance).toFormattedString()})
                </option>
              ))}
            </select>
          </div>

          {/* VALOR EN LIBROS VS VALOR OBJETIVO */}
          <div className="p-4 bg-gray-50 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-500 dark:text-gray-400">Saldo en Libros Contable:</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {Money.fromAmount(bookBalance).toFormattedString()}
              </span>
            </div>

            {/* MODO DE CALCULADORA (POR COTIZACIÓN O VALOR GLOBAL) */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700/60">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Modo de Revaluación</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseUnitCalculator(true)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    useUnitCalculator
                      ? 'bg-[#0088FF] text-white border-transparent'
                      : 'bg-white dark:bg-[#0F172A] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Unidades x Cotización
                </button>
                <button
                  type="button"
                  onClick={() => setUseUnitCalculator(false)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    !useUnitCalculator
                      ? 'bg-[#0088FF] text-white border-transparent'
                      : 'bg-white dark:bg-[#0F172A] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Valor Total Directo
                </button>
              </div>
            </div>

            {useUnitCalculator ? (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Cantidad / Unidades (ej: USD)
                  </label>
                  <FormattedNumberInput
                    value={unitsCount}
                    onChange={(val) => setUnitsCount(val)}
                    placeholder="0,00"
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Cotización Unitaria ($ ARS)
                  </label>
                  <FormattedNumberInput
                    value={unitRate}
                    onChange={(val) => setUnitRate(val)}
                    placeholder="0,00"
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white p-2.5"
                  />
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Nuevo Valor de Mercado Total ($ ARS)
                </label>
                <FormattedNumberInput
                  value={targetTotalValue}
                  onChange={(val) => setTargetTotalValue(val)}
                  placeholder="0,00"
                  className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white p-2.5"
                />
              </div>
            )}
          </div>

          {/* RESULTADO POR TENENCIA CALCULADO */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isGain
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {isGain ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider block">
                  {isGain ? 'Resultado por Tenencia Positivo (Ganancia RxT)' : 'Resultado por Tenencia Negativo (Pérdida RxT)'}
                </span>
                <span className="text-xs font-medium">
                  {isGain ? 'Impactará como Ingreso en la cuenta 4.2.02.01' : 'Impactará como Egreso en la cuenta 5.2.02.01'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-base font-black ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isGain ? '+' : ''}{Money.fromAmount(rxtDifference).toFormattedString()}
              </span>
            </div>
          </div>

          {/* CONCEPTO DEL ASIENTO */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Concepto / Motivo del Asiento
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Revaluación Dólar MEP al cierre del mes..."
              className="w-full p-3 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0088FF] outline-none"
            />
          </div>

          {/* BOTONES ACCION */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Math.abs(rxtDifference) < 0.01}
              className="w-full sm:flex-1 py-3 bg-[#0088FF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando Asiento RxT...</span>
                </>
              ) : (
                <span>Registrar Asiento Contable RxT</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
