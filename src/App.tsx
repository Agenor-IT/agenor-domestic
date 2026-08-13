import React, { useState, useMemo } from 'react';
import { Navbar } from './presentation/components/Navbar';
import { MetricsHeader } from './presentation/components/MetricsHeader';
import { ActualTrackingPanel } from './presentation/components/ActualTrackingPanel';
import { NoExtraScenarioPanel } from './presentation/components/NoExtraScenarioPanel';
import { ProjectionTable } from './presentation/components/ProjectionTable';
import { ParametersPanel } from './presentation/components/ParametersPanel';
import { OverduesPanel } from './presentation/components/OverduesPanel';
import { PaymentPrioritiesPanel } from './presentation/components/PaymentPrioritiesPanel';
import { TransactionModal } from './presentation/components/TransactionModal';
import { ThemeProvider } from './presentation/context/ThemeContext';

import { ProjectCashFlowUseCase } from './application/ProjectCashFlowUseCase';
import { INITIAL_MONTHS, INITIAL_DEFAULT_IPC, INITIAL_SECTIONS, DEFAULT_PAYMENT_PRIORITIES } from './domain/shared/initialSeedData';
import { PaymentMethodType } from './domain/shared/PaymentMethod';
import { Money } from './domain/shared/Money';
import { PaymentPriority } from './domain/priorities/PaymentPriority';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('resumen');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [ipcRates, setIpcRates] = useState<number[]>(INITIAL_DEFAULT_IPC);
  const [priorities, setPriorities] = useState<PaymentPriority[]>(DEFAULT_PAYMENT_PRIORITIES);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, PaymentMethodType>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const useCase = useMemo(() => new ProjectCashFlowUseCase(), []);

  const { nodes, projection } = useMemo(() => {
    return useCase.execute({
      nodes: INITIAL_SECTIONS,
      selectedMethods,
      openingBalance,
      ipcRates,
      periodCount: INITIAL_MONTHS.length
    });
  }, [useCase, selectedMethods, openingBalance, ipcRates]);

  const handleMethodChange = (nodeId: string, method: PaymentMethodType) => {
    setSelectedMethods(prev => ({
      ...prev,
      [nodeId]: method
    }));
  };

  const handleIpcChange = (index: number, val: number) => {
    setIpcRates(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSavePriorities = (updatedPriorities: PaymentPriority[]) => {
    setPriorities(updatedPriorities);
    console.log('Prioridades guardadas en dom_payment_priorities:', updatedPriorities);
  };

  const totalIncome = projection.income.reduce((sum, m) => sum.add(m), Money.zero());
  const totalExpense = projection.expense.reduce((sum, m) => sum.add(m), Money.zero());
  const finalBalance = projection.final[projection.final.length - 1] || Money.zero();
  const extraNeeded = projection.extraNeeded.reduce((sum, m) => sum.add(m), Money.zero());

  return (
    <div className="min-h-screen bg-[#f4f6f8] dark:bg-slate-900 text-[#172033] dark:text-slate-100 transition-colors">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenNewTransaction={() => setIsModalOpen(true)}
      />

      <main className="max-w-[1850px] mx-auto px-4 md:px-6 py-6">
        <MetricsHeader
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          finalBalance={finalBalance}
          extraNeeded={extraNeeded}
          periodLabel="Año Completo (17 meses)"
        />

        {currentTab === 'resumen' && (
          <>
            <ActualTrackingPanel />
            <NoExtraScenarioPanel />
            <ProjectionTable
              nodes={nodes}
              months={INITIAL_MONTHS}
              selectedMethods={selectedMethods}
              onMethodChange={handleMethodChange}
              openingBalance={openingBalance}
              onOpeningBalanceChange={setOpeningBalance}
            />
          </>
        )}

        {currentTab === 'escenario' && (
          <NoExtraScenarioPanel />
        )}

        {currentTab === 'prioridades' && (
          <PaymentPrioritiesPanel
            priorities={priorities}
            onSave={handleSavePriorities}
          />
        )}

        {currentTab === 'parametros' && (
          <ParametersPanel
            ipcRates={ipcRates}
            onIpcChange={handleIpcChange}
          />
        )}

        {currentTab === 'atrasos' && (
          <OverduesPanel />
        )}
      </main>

      <TransactionModal
        isOpen={isModalOpen}
        mode="nuevo"
        onClose={() => setIsModalOpen(false)}
        onSubmit={(data) => {
          console.log('Nueva transacción registrada:', data);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
