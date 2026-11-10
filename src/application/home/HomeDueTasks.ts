import { DomExpenseDTO } from '../../domain/expenses/DomExpense';
import { DomExpenseReceipt } from '../../domain/expenses/DomExpenseReceipt';
import { PendingBill, validPlanDate } from '../../domain/cashflow/MonthlyCashPlan';
import { billDueNotices } from '../../domain/cashflow/BillDueNotices';
import { Money } from '../../domain/shared/Money';

export interface HomeDueTask { id:string; title:string; detail:string; dueDate:string; completed:boolean }
const validDate = (date?:string):date is string => typeof date==='string' && validPlanDate(date);
const titleOf = (expense:DomExpenseDTO) => [expense.supplierName.trim(),expense.concept.trim()].filter(Boolean).join(' · ') || 'Egreso sin descripción';

export function buildHomeDueTasks(expenses:DomExpenseDTO[],receipts:DomExpenseReceipt[],bills:PendingBill[]):HomeDueTask[] {
  const expensesById=new Map(expenses.map(expense=>[expense.id,expense]));
  const datedReceipts=receipts.filter(receipt=>receipt.paymentCondition==='cuenta_corriente' && validDate(receipt.dueDate));
  const expensesWithReceipts=new Set(datedReceipts.map(receipt=>receipt.expenseId));
  const receiptTasks:HomeDueTask[]=datedReceipts.flatMap(receipt=>{
    const expense=expensesById.get(receipt.expenseId);
    return expense && receipt.dueDate ? [{id:`receipt:${receipt.id}:${receipt.dueDate}`,title:titleOf(expense),
      detail:`Comprobante · ${Money.fromAmount(receipt.amount).toFormattedString()}`,dueDate:receipt.dueDate,completed:false}] : [];
  });
  const expenseTasks:HomeDueTask[]=expenses.flatMap(expense=>{
    if(expense.paymentCondition!=='cuenta_corriente' || !validDate(expense.dueDate) ||
      expensesWithReceipts.has(expense.id) || expense.status==='finalizado')return [];
    // Only the explicit budget link replaces an estimate; never infer by name or amount.
    if(bills.some(bill=>bill.expenseId===expense.id && !!bill.dueDate && bill.budgetMonth===expense.dueDate!.slice(0,7)))return [];
    return [{id:`expense:${expense.id}:${expense.dueDate}`,title:titleOf(expense),
      detail:`Egreso · ${Money.fromAmount(expense.baseMonthlyAmount).toFormattedString()}`,dueDate:expense.dueDate,completed:false}];
  });
  const billTasks:HomeDueTask[]=billDueNotices(bills).map(notice=>({id:notice.id,title:notice.title,
    detail:`Factura pendiente · ${notice.outstanding.toFormattedString()}`,dueDate:notice.dueDate,completed:false}));
  return [...receiptTasks,...expenseTasks,...billTasks].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.title.localeCompare(b.title,'es'));
}

export interface HomeDueTaskSources {
  expenses(owner:number):Promise<DomExpenseDTO[]>;
  receipts(owner:number):Promise<DomExpenseReceipt[]>;
  bills(owner:number):Promise<PendingBill[]>;
}
export async function loadHomeDueTasks(owner:number,sources:HomeDueTaskSources):Promise<{items:HomeDueTask[];error?:string}> {
  if(!Number.isInteger(owner)||owner<=0)throw new Error('Titular de los vencimientos inválido.');
  const [expenses,receipts,bills]=await Promise.allSettled([sources.expenses(owner),sources.receipts(owner),sources.bills(owner)]);
  return {items:buildHomeDueTasks(expenses.status==='fulfilled'?expenses.value:[],receipts.status==='fulfilled'?receipts.value:[],bills.status==='fulfilled'?bills.value:[]),
    error:[expenses,receipts,bills].some(result=>result.status==='rejected')
      ? 'No se pudieron cargar todos los vencimientos. La lista puede estar incompleta.' : undefined};
}
