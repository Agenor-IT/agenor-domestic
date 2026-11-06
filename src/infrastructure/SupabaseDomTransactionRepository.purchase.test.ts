import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseDomTransactionRepository } from './SupabaseDomTransactionRepository';
import { Money } from '../domain/shared/Money';
import { TransactionDTO } from '../domain/repositories/ITransactionRepository';

const { rpc, fetchPurchaseHistory }=vi.hoisted(()=>({rpc:vi.fn(),fetchPurchaseHistory:vi.fn()}));
vi.mock('./supabaseClient',()=>({supabase:{rpc}}));
vi.mock('./SupabaseDomConsumptionRepository',()=>({fetchPurchaseHistory,ConsumptionNotEnabledError:class extends Error{}}));
const row={rawName:'HUEVOS',name:'Huevos',presentation:'12 unidades',unit:'paquete',kind:'consumable' as const,quantity:1,lineTotal:1000};
const transaction:TransactionDTO={id:'test-tx',personaPadreId:42,direction:'expense',amount:Money.fromAmount(1000),description:'Compra',occurredOn:'2026-10-26',paymentMethod:'cta_cte',status:'confirmed',operationType:'compra',counterparty:'Comercio',opNumber:'TICKET-1',paymentCondition:'cta_cte'};
const lines=[{accountId:1,debit:1000,credit:0,memo:'Compra'},{accountId:2,debit:0,credit:1000,memo:'Compra'}];
describe('Guardado atómico de compra y productos',()=>{
  beforeEach(()=>{rpc.mockReset();rpc.mockResolvedValue({data:{success:true,revision:1,entry_id:11},error:null});});
  it('envía compra, asiento y renglones en UNA llamada, no en escrituras separadas',async()=>{
    const result=await new SupabaseDomTransactionRepository().saveTransaction({...transaction,purchaseItems:[row]},lines,'cash',null,0);
    expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('dom_post_purchase_transaction',expect.objectContaining({p_persona_padre_id:42,p_expected_revision:0,p_purchase_items:[row],p_transaction:expect.objectContaining({amount:1000,operation_type:'compra'})}));
    expect(result.revision).toBe(1);expect(result.purchaseItems).toEqual([row]);
  });
  it('conserva el RPC vigente para operaciones sin detalle de productos',async()=>{
    await new SupabaseDomTransactionRepository().saveTransaction(transaction,lines,'cash',null,0);
    expect(rpc.mock.calls[0][0]).toBe('dom_post_transaction');expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_purchase_items');
  });
  it('vaciar el detalle al editar también usa la operación atómica',async()=>{
    await new SupabaseDomTransactionRepository().saveTransaction({...transaction,purchaseItems:[]},lines,'cash',null,3);
    expect(rpc).toHaveBeenCalledWith('dom_post_purchase_transaction',expect.objectContaining({p_expected_revision:3,p_purchase_items:[]}));
  });
  it('si falta el RPC nuevo no registra sólo la parte contable como fallback',async()=>{
    rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing'}});
    await expect(new SupabaseDomTransactionRepository().saveTransaction({...transaction,purchaseItems:[row]},lines,'cash',null,0)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('no reintenta ni declara éxito si hay conflicto de revisión',async()=>{
    rpc.mockResolvedValue({data:null,error:{code:'40001',message:'La compra cambió'}});
    await expect(new SupabaseDomTransactionRepository().saveTransaction({...transaction,purchaseItems:[row]},lines,'cash',null,2)).rejects.toThrow('La compra cambió');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rechaza renglones inválidos antes de llamar la base y no adjunta productos a pagos',async()=>{
    const repo=new SupabaseDomTransactionRepository();
    await expect(repo.saveTransaction({...transaction,purchaseItems:[{...row,quantity:0}]},lines,'cash',null,0)).rejects.toThrow();
    await expect(repo.saveTransaction({...transaction,operationType:'pago',purchaseItems:[row]},lines,'cash',null,0)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
