import { describe, expect, it } from 'vitest';
import { billDueNotices } from './BillDueNotices';
import { PendingBill } from './MonthlyCashPlan';

const bill: PendingBill = { id:'bill',description:'Factura sintética',amount:100,date:'2026-10-26',
  dueDate:'2026-10-27',expenseId:null,budgetMonth:null,scheduleRevision:0,payments:[] };
describe('Avisos contables de Inicio',()=>{
  it('usa vencimiento explícito, nunca emisión, y muestra el saldo pendiente',()=>{
    const [notice]=billDueNotices([{...bill,payments:[{amount:40,date:'2026-10-26'}]}]);
    expect(notice.dueDate).toBe('2026-10-27');expect(notice.outstanding.toAmount()).toBe(60);
    expect(notice.transactionId).toBe('bill');
  });
  it('retira el aviso al quedar pagada y lo restituye al anular un pago',()=>{
    expect(billDueNotices([{...bill,payments:[{amount:100,date:'2026-10-27'}]}])).toEqual([]);
    expect(billDueNotices([bill])).toHaveLength(1);
  });
  it('no inventa vencimiento desde texto ni desde la emisión',()=>{
    expect(billDueNotices([{...bill,dueDate:null,description:'Vence 27/10/2026'}])).toEqual([]);
  });
  it('no conserva avisos de facturas anuladas o con calendario invalidado por una revisión',()=>{
    expect(billDueNotices([])).toEqual([]);
    expect(billDueNotices([{...bill,dueDate:null}])).toEqual([]);
  });
  it('rechaza fechas imposibles y duplicados en vez de fabricar avisos',()=>{
    expect(()=>billDueNotices([{...bill,dueDate:'2026-02-30'}])).toThrow();
    expect(()=>billDueNotices([bill,bill])).toThrow('Factura duplicada');
  });
});
