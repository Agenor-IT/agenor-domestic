import React, { useEffect, useMemo, useState } from 'react';
import { SupabaseDomExpenseReceiptRepository } from '../../infrastructure/SupabaseDomExpenseReceiptRepository';
import { SupabaseDomExpenseRepository } from '../../infrastructure/SupabaseDomExpenseRepository';
import { HomeTask, HomeTaskList } from './HomeTaskList';
import { useDomesticAccess } from '../auth/DomesticAuthGate';
import { SupabaseDomMonthlyCashRepository } from '../../infrastructure/SupabaseDomMonthlyCashRepository';
import { loadHomeDueTasks } from '../../application/home/HomeDueTasks';

const completedTasksKey = (personaPadreId: number) => `dom_due_tasks_completed_${personaPadreId}`;

const readCompletedTasks = (personaPadreId: number): Set<string> => {
  try {
    const stored = JSON.parse(localStorage.getItem(completedTasksKey(personaPadreId)) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

interface HomeDueTasksPanelProps {
  onOpenExpenses: () => void;
  refreshKey?: number;
}

export const HomeDueTasksPanel: React.FC<HomeDueTasksPanelProps> = ({ onOpenExpenses, refreshKey = 0 }) => {
  const { personaPadreId } = useDomesticAccess();
  const expenseRepository = useMemo(() => new SupabaseDomExpenseRepository(), []);
  const receiptRepository = useMemo(() => new SupabaseDomExpenseReceiptRepository(), []);
  const monthlyRepository = useMemo(() => new SupabaseDomMonthlyCashRepository(), []);
  const [dueTasks, setDueTasks] = useState<HomeTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState(() => readCompletedTasks(personaPadreId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(completedTasksKey(personaPadreId), JSON.stringify([...completedTaskIds]));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [completedTaskIds, personaPadreId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadHomeDueTasks(personaPadreId, {
      expenses: owner => expenseRepository.getAllExpenses(owner),
      receipts: owner => receiptRepository.list(owner).then(result => result.items),
      bills: owner => monthlyRepository.getSnapshot(owner).then(result => result.bills)
    })
      .then(result => {
        if (!active) return;
        setDueTasks(result.items);
        setError(result.error);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los vencimientos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [expenseRepository, receiptRepository, monthlyRepository, personaPadreId, refreshKey]);

  const toggleTask = (id: string) => {
    setCompletedTaskIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <HomeTaskList
      items={dueTasks.map(task => ({ ...task, completed: completedTaskIds.has(task.id) }))}
      onToggle={toggleTask}
      onOpenExpenses={onOpenExpenses}
      loading={loading}
      error={error}
      notice={storageError ? 'El estado de esta lista no pudo guardarse en este dispositivo.' : undefined}
    />
  );
};
