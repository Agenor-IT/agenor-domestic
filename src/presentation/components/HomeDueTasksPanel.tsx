import React, { useEffect, useMemo, useState } from 'react';
import { DomExpenseDTO } from '../../domain/expenses/DomExpense';
import { DomExpenseReceipt } from '../../domain/expenses/DomExpenseReceipt';
import { Money } from '../../domain/shared/Money';
import { SupabaseDomExpenseReceiptRepository } from '../../infrastructure/SupabaseDomExpenseReceiptRepository';
import { SupabaseDomExpenseRepository } from '../../infrastructure/SupabaseDomExpenseRepository';
import { HomeTask, HomeTaskList } from './HomeTaskList';
import { useDomesticAccess } from '../auth/DomesticAuthGate';

const completedTasksKey = (personaPadreId: number) => `dom_due_tasks_completed_${personaPadreId}`;

const validDueDate = (date?: string): date is string => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getFullYear() === Number(date.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(date.slice(5, 7)) &&
    parsed.getDate() === Number(date.slice(8, 10));
};

const taskTitle = (expense: DomExpenseDTO): string =>
  [expense.supplierName.trim(), expense.concept.trim()].filter(Boolean).join(' · ') || 'Egreso sin descripción';

const buildDueTasks = (expenses: DomExpenseDTO[], receipts: DomExpenseReceipt[]): HomeTask[] => {
  const expensesById = new Map(expenses.map(expense => [expense.id, expense]));
  const receiptsWithDueDate = receipts.filter(receipt => receipt.paymentCondition === 'cuenta_corriente' && validDueDate(receipt.dueDate));
  const expensesWithReceipts = new Set(receiptsWithDueDate.map(receipt => receipt.expenseId));

  const receiptTasks: HomeTask[] = receiptsWithDueDate.flatMap(receipt => {
    const expense = expensesById.get(receipt.expenseId);
    if (!expense || !receipt.dueDate) return [];
    return [{
      id: `receipt:${receipt.id}:${receipt.dueDate}`,
      title: taskTitle(expense),
      detail: `Comprobante · ${Money.fromAmount(receipt.amount).toFormattedString()}`,
      dueDate: receipt.dueDate,
      completed: false
    }];
  });

  const expenseTasks: HomeTask[] = expenses.flatMap(expense => {
    if (expense.paymentCondition !== 'cuenta_corriente' || !validDueDate(expense.dueDate) || expensesWithReceipts.has(expense.id) || expense.status === 'finalizado') return [];
    return [{
      id: `expense:${expense.id}:${expense.dueDate}`,
      title: taskTitle(expense),
      detail: `Egreso · ${Money.fromAmount(expense.baseMonthlyAmount).toFormattedString()}`,
      dueDate: expense.dueDate,
      completed: false
    }];
  });

  return [...receiptTasks, ...expenseTasks].sort((first, second) =>
    (first.dueDate || '').localeCompare(second.dueDate || '') || first.title.localeCompare(second.title, 'es')
  );
};

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
}

export const HomeDueTasksPanel: React.FC<HomeDueTasksPanelProps> = ({ onOpenExpenses }) => {
  const { personaPadreId } = useDomesticAccess();
  const expenseRepository = useMemo(() => new SupabaseDomExpenseRepository(), []);
  const receiptRepository = useMemo(() => new SupabaseDomExpenseReceiptRepository(), []);
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
    Promise.all([
      expenseRepository.getAllExpenses(personaPadreId),
      receiptRepository.list(personaPadreId),
    ])
      .then(([expenses, receipts]) => {
        if (!active) return;
        setDueTasks(buildDueTasks(expenses, receipts.items));
        setError(undefined);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los vencimientos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [expenseRepository, receiptRepository, personaPadreId]);

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
