import { describe, expect, it } from 'vitest';
import { parseReceiptDraft, receiptTransactionFields } from './ReceiptDraft';
const receipt={supplier:'Supermercado',date:'2026-10-26',number:'0001-00000010',currency:'ARS',total:1500,detail:'Huevos y lavandina'};
const egg={name:'HUEVOS',presentation:'12 unidades',unit:'paquete',quantity:1,lineTotal:1500,kind:'consumable'};
describe('Productos extraídos del comprobante',()=>{
  it('lleva las líneas al formulario sin perder el texto original',()=>{
    const draft=parseReceiptDraft({...receipt,items:[egg]});
    expect(receiptTransactionFields(draft).purchaseItems?.[0]).toMatchObject({rawName:'HUEVOS',name:'HUEVOS',unit:'paquete',quantity:1,lineTotal:1500});
  });
  it('deja unidad y cantidad ilegibles para revisión humana',()=>{
    const fields=receiptTransactionFields(parseReceiptDraft({...receipt,items:[{...egg,quantity:null,unit:null}]}));
    expect(fields.purchaseItems?.[0]).toMatchObject({quantity:null,unit:''});
  });
  it('una factura de servicio sin productos no crea productos',()=>{
    expect(receiptTransactionFields(parseReceiptDraft({...receipt,items:[]})).purchaseItems).toBeUndefined();
  });
  it('no trata importes de renglón en moneda extranjera como pesos',()=>{
    expect(receiptTransactionFields(parseReceiptDraft({...receipt,currency:'USD',items:[egg]})).purchaseItems?.[0].lineTotal).toBeNull();
  });
  it.each([{...egg,quantity:0},{...egg,quantity:1.0001},{...egg,lineTotal:-1},{...egg,name:''},{...egg,kind:'inventado'}])('rechaza productos extraídos inválidos',item=>{
    expect(()=>parseReceiptDraft({...receipt,items:[item]})).toThrow();
  });
});
