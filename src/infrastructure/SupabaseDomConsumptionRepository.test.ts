import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsumptionNotEnabledError, fetchPurchaseHistory, SupabaseDomConsumptionRepository } from './SupabaseDomConsumptionRepository';
const {from,rpc}=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabaseClient',()=>({supabase:{from,rpc}}));
const product={id:'product',name:'Huevos',presentation:'12 unidades',unit:'paquete',kind:'consumable'};
const row={id:'line',product_id:'product',transaction_id:'tx',transaction_revision:2,line_number:1,raw_name:'HUEVOS X12',quantity:2,line_total:1500,product,transaction:{id:'tx',occurred_on:'2026-10-20',counterparty:'Comercio',op_number:'1',status:'confirmed',revision:2,operation_type:'compra'}};
function query(data:unknown[],error:unknown=null){
  const q={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,error})};
  q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.order.mockReturnValue(q);return q;
}
describe('Lecturas de productos y aislamiento del cliente',()=>{
  beforeEach(()=>{from.mockReset();rpc.mockReset();});
  it('consulta exclusivamente renglones del tenant y mapea la referencia al comprobante',async()=>{
    const q=query([row]);from.mockReturnValue(q);
    expect((await fetchPurchaseHistory(42))[0]).toMatchObject({productId:'product',transactionId:'tx',quantity:2,date:'2026-10-20'});
    expect(q.eq).toHaveBeenCalledWith('persona_padre_id',42);expect(q.range).toHaveBeenCalledWith(0,499);
  });
  it('no cuenta anulaciones, compras editadas por otro circuito ni pagos como consumo',async()=>{
    from.mockReturnValue(query([{...row,transaction:{...row.transaction,status:'voided'}},{...row,id:'stale',transaction_revision:1},{...row,id:'payment',transaction:{...row.transaction,operation_type:'pago'}}]));
    expect(await fetchPurchaseHistory(42)).toEqual([]);
  });
  it('diferencia módulo ausente de un error de permisos y no oculta errores de autorización',async()=>{
    from.mockReturnValue(query([],{code:'PGRST205',message:'missing table'}));
    await expect(fetchPurchaseHistory(42)).rejects.toBeInstanceOf(ConsumptionNotEnabledError);
    from.mockReturnValue(query([],{code:'42501',message:'denied'}));
    await expect(fetchPurchaseHistory(42)).rejects.toThrow('denied');
  });
  it('no inventa un contrato si el backend no está habilitado',async()=>{
    rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing'}});
    await expect(new SupabaseDomConsumptionRepository().getSnapshot(42)).rejects.toBeInstanceOf(ConsumptionNotEnabledError);
    expect(from).not.toHaveBeenCalled();
  });
  it('envía versión y tenant al editar y eliminar la lista, sin modificar el historial',async()=>{
    rpc.mockResolvedValue({error:null});
    const repo=new SupabaseDomConsumptionRepository();
    const item={id:'list',productId:'product',quantity:2,note:'Para la semana',checked:true,revision:4};
    await repo.saveShoppingItem(42,item);await repo.deleteShoppingItem(42,item);
    expect(rpc.mock.calls[0]).toEqual(['dom_save_shopping_item',{p_persona_padre_id:42,p_item:item}]);
    expect(rpc.mock.calls[1]).toEqual(['dom_delete_shopping_item',{p_persona_padre_id:42,p_id:'list',p_expected_revision:4}]);
    expect(from).not.toHaveBeenCalled();
  });
});
