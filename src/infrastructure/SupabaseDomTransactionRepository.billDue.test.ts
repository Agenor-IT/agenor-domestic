import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseDomTransactionRepository } from './SupabaseDomTransactionRepository';
const {from,rpc}=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabaseClient',()=>({supabase:{from,rpc}}));
vi.mock('./SupabaseDomConsumptionRepository',()=>({fetchPurchaseHistory:async()=>[],ConsumptionNotEnabledError:class extends Error{}}));
function query(data:unknown[]){const q={select:vi.fn(),eq:vi.fn(),neq:vi.fn(),order:vi.fn(),range:vi.fn(async()=>({data,error:null}))};
  q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.neq.mockReturnValue(q);q.order.mockReturnValue(q);return q;}
const transaction={id:'bill',persona_padre_id:42,direction:'expense',amount:100,description:'Factura',occurred_on:'2026-10-26',
  status:'confirmed',revision:2,operation_type:'compra',payment_condition:'cta_cte'};
describe('Vencimiento al volver a abrir una factura',()=>{
  beforeEach(()=>from.mockReset());
  it.each([2,1])('sólo recupera el calendario de la revisión contable vigente: %s',async revision=>{
    const tx=query([transaction]);const schedule=query([{transaction_id:'bill',transaction_revision:revision,due_date:'2026-11-10',revision:3}]);
    from.mockImplementation(table=>table==='dom_transactions'?tx:schedule);
    const [result]=await new SupabaseDomTransactionRepository().getTransactionsByTenant(42);
    expect(result.billDueDate).toBe(revision===2?'2026-11-10':null);
    expect(result.billScheduleRevision).toBe(revision===2?3:0);
    expect(schedule.eq).toHaveBeenCalledWith('persona_padre_id',42);
  });
});
