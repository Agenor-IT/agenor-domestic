import { describe, expect, it, vi } from 'vitest';
import { buildHomeDueTasks, loadHomeDueTasks } from './HomeDueTasks';
import { DomExpenseDTO } from '../../domain/expenses/DomExpense';
import { PendingBill } from '../../domain/cashflow/MonthlyCashPlan';
const expense:DomExpenseDTO={id:'expense',personaPadreId:42,supplierName:'Comercio',concept:'Servicio',category:'Servicios',
  status:'activo',expenseType:'fijo',baseMonthlyAmount:100,monthlyProjections:{},defaultPaymentMethod:'cash',paymentCondition:'cuenta_corriente',dueDate:'2026-10-27'};
const bill:PendingBill={id:'bill',description:'Factura',amount:100,date:'2026-10-26',dueDate:'2026-10-27',
  expenseId:'expense',budgetMonth:'2026-10',scheduleRevision:0,payments:[]};
describe('Lectura de avisos de Inicio',()=>{
  it('usa el vínculo explícito de presupuesto para no duplicar el aviso estimado',()=>{
    const items=buildHomeDueTasks([expense],[],[bill]);expect(items).toHaveLength(1);expect(items[0].id).toMatch(/^bill:/);
    expect(buildHomeDueTasks([expense],[],[{...bill,payments:[{amount:100,date:'2026-10-27'}]}])).toEqual([]);
  });
  it('no une facturas y presupuestos sólo porque coincidan proveedor o importe',()=>{
    expect(buildHomeDueTasks([expense],[],[{...bill,expenseId:null,budgetMonth:null}])).toHaveLength(2);
  });
  it('consulta todas las fuentes con el mismo titular y conserva avisos antiguos ante una falla parcial',async()=>{
    const sources={expenses:vi.fn(async(_owner:number)=>[expense]),receipts:vi.fn(async(_owner:number)=>[]),
      bills:vi.fn(async(_owner:number):Promise<PendingBill[]>=>{throw Error('offline');})};
    const result=await loadHomeDueTasks(42,sources);expect(result.items).toHaveLength(1);expect(result.error).toContain('incompleta');
    for(const fn of Object.values(sources))expect(fn).toHaveBeenCalledWith(42);
  });
  it('no consulta sin titular y muestra el remanente de una factura pagada parcialmente',async()=>{
    const sources={expenses:vi.fn(async()=>[]),receipts:vi.fn(async()=>[]),bills:vi.fn(async()=>[{...bill,payments:[{amount:40,date:'2026-10-27'}]}])};
    await expect(loadHomeDueTasks(0,sources)).rejects.toThrow();expect(sources.bills).not.toHaveBeenCalled();
    const result=await loadHomeDueTasks(42,sources);expect(result.items[0].detail).toContain('60,00');expect(result.error).toBeUndefined();
  });
});
