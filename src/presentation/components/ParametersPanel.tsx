import React from 'react';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import { CreditCard, Building2, Wallet } from 'lucide-react';
import { FiscalYearsSection } from './FiscalYearsSection';

interface ParametersPanelProps {
  paymentMethods: CustomPaymentMethod[];
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  paymentMethods
}) => {
  const getMethodIcon = (type: 'cash' | 'bank' | 'card') => {
    switch (type) {
      case 'cash': return <Wallet className="w-4 h-4 text-emerald-500" />;
      case 'bank': return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'card': return <CreditCard className="w-4 h-4 text-amber-500" />;
    }
  };

  const getMethodTypeName = (type: 'cash' | 'bank' | 'card') => {
    switch (type) {
      case 'cash': return 'Efectivo';
      case 'bank': return 'Caja de Ahorro / Banco';
      case 'card': return 'Tarjeta de Crédito';
    }
  };

  return (
    <div className="space-y-8">
      {/* SECCIÓN 1: CONFIGURACIÓN DE MEDIOS DE PAGO */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#0088FF] shrink-0" />
              <span>1. Configuración de Medios de Pago</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Medios derivados del plan de cuentas. El saldo cambia sólo con asientos; la cuenta puede archivarse desde el plan.
            </p>
          </div>
        </div>

        {/* TABLA DE MEDIOS DE PAGO CONFIGURADOS */}
        <div className="mobile-card-container overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl scrollbar-thin">
          <table className="mobile-record-table w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1E293B]/60 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="py-3 px-4 sticky left-0 bg-gray-50 dark:bg-[#1E293B] z-10">Nombre del Medio</th>
                <th className="py-3 px-4">Tipo de Medio</th>
                <th className="py-3 px-4">Cuenta Contable Asignada</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
              {paymentMethods.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    No hay cuentas contables de efectivo, banco o tarjeta disponibles.
                  </td>
                </tr>
              ) : (
                paymentMethods.map((pm) => (
                  <tr key={pm.id} className="record-row hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/40 transition-colors">
                    <td data-label="Medio de pago" data-primary="true" className="py-3 px-4 font-bold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-[#0F172A] z-10">
                      <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-100 dark:bg-[#0F172A] rounded-lg shrink-0">
                        {getMethodIcon(pm.type)}
                      </div>
                      <span className="truncate">{pm.name}</span>
                      </div>
                    </td>
                    <td data-label="Tipo" className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                      {getMethodTypeName(pm.type)}
                    </td>
                    <td data-label="Cuenta contable" data-mobile-hidden="true" className="py-3 px-4 whitespace-nowrap">
                      {pm.accountCode ? (
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#0088FF] dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900/50 font-semibold">
                          {pm.accountCode} - {pm.accountName}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Sin cuenta</span>
                      )}
                    </td>
                    <td data-label="Estado" className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        pm.active
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {pm.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>


      {/* SECCIÓN 2: GESTIÓN DE EJERCICIOS ECONÓMICOS Y SALDOS INICIALES */}
      <FiscalYearsSection />

    </div>
  );
};
