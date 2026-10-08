import React, { useState } from 'react';
import { TableSearchFilter } from './TableSearchFilter';
import { CustomPaymentMethod } from '../../domain/shared/PaymentMethod';
import { Plus, CreditCard, Building2, Wallet, Trash2, CheckCircle2, XCircle, Eye, Pencil } from 'lucide-react';
import { FiscalYearsSection } from './FiscalYearsSection';
import { PaymentMethodModal } from './PaymentMethodModal';
import { FormattedNumberInput } from './FormattedNumberInput';
import { DomAccountDTO } from '../../domain/repositories/IAccountingRepository';

interface ParametersPanelProps {
  ipcRates: number[];
  onIpcChange: (index: number, val: number) => void;
  paymentMethods: CustomPaymentMethod[];
  accounts?: DomAccountDTO[];
  onSavePaymentMethod: (data: {
    id?: string;
    name: string;
    type: 'cash' | 'bank' | 'card';
    active: boolean;
    accountId?: number;
    accountCode?: string;
    accountName?: string;
    creditLimit?: number;
    initialAvailable?: number;
    initialBalance?: number;
  }) => void;
  onTogglePaymentMethod: (id: string) => void;
  onDeletePaymentMethod: (id: string) => void;
}

const MONTH_NAMES = [
  'Ago-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dic-26', 'Ene-27',
  'Feb-27', 'Mar-27', 'Abr-27', 'May-27', 'Jun-27', 'Jul-27',
  'Ago-27', 'Sep-27', 'Oct-27', 'Nov-27', 'Dic-27'
];

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  ipcRates,
  onIpcChange,
  paymentMethods,
  accounts = [],
  onSavePaymentMethod,
  onTogglePaymentMethod,
  onDeletePaymentMethod
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'nuevo' | 'editar' | 'ver'>('nuevo');
  const [selectedMethod, setSelectedMethod] = useState<CustomPaymentMethod | null>(null);

  const filteredRates = MONTH_NAMES.map((name, idx) => ({
    index: idx,
    month: name,
    rate: ipcRates[idx] || 0
  })).filter(item => item.month.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleOpenNuevoModal = () => {
    setSelectedMethod(null);
    setModalMode('nuevo');
    setIsModalOpen(true);
  };

  const handleOpenEditarModal = (method: CustomPaymentMethod) => {
    setSelectedMethod(method);
    setModalMode('editar');
    setIsModalOpen(true);
  };

  const handleOpenVerModal = (method: CustomPaymentMethod) => {
    setSelectedMethod(method);
    setModalMode('ver');
    setIsModalOpen(true);
  };

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
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#0088FF]" />
              1. Configuración de Medios de Pago
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Administración de cuentas, efectivo, límites de tarjetas, saldos iniciales e imputación contable
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenNuevoModal}
            className="px-4 py-2.5 bg-[#0088FF] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Medio de Pago</span>
          </button>
        </div>

        {/* TABLA DE MEDIOS DE PAGO CONFIGURADOS */}
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1E293B]/60 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="py-3 px-4">Nombre del Medio</th>
                <th className="py-3 px-4">Tipo de Medio</th>
                <th className="py-3 px-4">Límite Otorgado</th>
                <th className="py-3 px-4">Disponible / Saldo Inicial</th>
                <th className="py-3 px-4">Cuenta Contable Asignada</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
              {paymentMethods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No hay medios de pago configurados. Haz clic en "Nuevo Medio de Pago" para agregar uno.
                  </td>
                </tr>
              ) : (
                paymentMethods.map((pm) => (
                  <tr key={pm.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="p-1.5 bg-gray-100 dark:bg-[#0F172A] rounded-lg shrink-0">
                        {getMethodIcon(pm.type)}
                      </div>
                      <span>{pm.name}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                      {getMethodTypeName(pm.type)}
                    </td>
                    <td className="py-3 px-4">
                      {pm.type === 'card' ? (
                        <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          $ {(pm.creditLimit || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        $ {(pm.type === 'card' ? (pm.initialAvailable ?? pm.creditLimit ?? 0) : (pm.initialBalance || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {pm.accountCode ? (
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#0088FF] dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900/50 font-semibold">
                          {pm.accountCode} - {pm.accountName}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Por defecto del tipo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        pm.active
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {pm.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenVerModal(pm)}
                          title="Ver detalle"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditarModal(pm)}
                          title="Editar medio de pago"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onTogglePaymentMethod(pm.id)}
                          title={pm.active ? 'Desactivar medio' : 'Activar medio'}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            pm.active
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          {pm.active ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeletePaymentMethod(pm.id)}
                          title="Eliminar medio de pago"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECCIÓN 2: PARÁMETROS IPC */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-[#172033] dark:text-white">
            2. Índices de Inflación e IPC Mensual
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tasas de ajuste IPC proyectadas para los 17 períodos del modelo
          </p>
        </div>

        <TableSearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Buscar mes o período de inflación IPC..."
        />

        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredRates.map((item) => (
              <div key={item.index} className="bg-gray-50 dark:bg-[#1E293B]/70 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs font-bold text-[#12355b] dark:text-blue-400">{item.month}</span>
                <div className="mt-2 flex items-center gap-1">
                  <FormattedNumberInput
                    decimals={1}
                    value={item.rate}
                    onChange={(val) => onIpcChange(item.index, val)}
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0088FF]"
                  />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: GESTIÓN DE EJERCICIOS ECONÓMICOS Y SALDOS INICIALES */}
      <FiscalYearsSection />

      {/* MODAL MEDIO DE PAGO */}
      <PaymentMethodModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={selectedMethod}
        accounts={accounts}
        onClose={() => setIsModalOpen(false)}
        onSave={onSavePaymentMethod}
      />
    </div>
  );
};
