import { describe, expect, it } from 'vitest';
import { ConsumptionContract, ConsumptionProduct, estimatePurchases, PurchaseObservation, validatePurchaseItems } from './Consumption';

const product: ConsumptionProduct = { id: 'egg', name: 'Huevos', presentation: '12 unidades', unit: 'paquete', kind: 'consumable' };
const contract: ConsumptionContract = { version: 1, estimation: 'purchase_intervals_v1', minimumPurchaseDays: 2 };
const purchase = (id: string, date: string, quantity: number | null, overrides: Partial<PurchaseObservation> = {}): PurchaseObservation => ({
  id, productId: product.id, name: product.name, rawName: 'HUEVOS X12', presentation: product.presentation,
  unit: product.unit, kind: product.kind, quantity, lineTotal: 1000, transactionId: `tx-${id}`,
  date, supplier: 'Comercio de prueba', receiptNumber: id, ...overrides
});
const estimate = (rows: PurchaseObservation[], p = product) => estimatePurchases(p, rows, '2026-10-26', 7, contract);

describe('Frecuencia de compras sin stock, v1', () => {
  it('usa cantidad anterior / intervalo y no incluye la última compra en el numerador', () => {
    const result = estimate([purchase('a','2026-10-05',1),purchase('b','2026-10-12',1),purchase('c','2026-10-19',2)]);
    expect(result.dailyQuantity).toBeCloseTo(1/7);
    expect(result.nextPurchaseDate).toBe('2026-11-02');
    expect(result.suggestedQuantity).toBe(1);
    expect(result.intervalCount).toBe(2);
  });
  it('pondera por los días observados en vez de promediar tasas diarias sin peso', () => {
    const result = estimate([purchase('a','2026-10-01',2),purchase('b','2026-10-03',3),purchase('c','2026-10-13',4)]);
    expect(result.dailyQuantity).toBeCloseTo(5/12);
  });
  it('agrupa compras del mismo día antes de construir intervalos', () => {
    const result = estimate([purchase('a','2026-10-01',1),purchase('b','2026-10-01',2),purchase('c','2026-10-08',1)]);
    expect(result.purchaseDays).toBe(2); expect(result.dailyQuantity).toBeCloseTo(3/7);
  });
  it('deduplica renglones por ID y no confunde varios renglones con más observaciones', () => {
    const row = purchase('a','2026-10-01',2);
    const result = estimate([row,row,purchase('b','2026-10-08',2)]);
    expect(result.dailyQuantity).toBeCloseTo(2/7); expect(result.intervalCount).toBe(1);
  });
  it('una fecha, aun con varios comprobantes, no demuestra frecuencia', () => {
    expect(estimate([purchase('a','2026-10-01',2),purchase('b','2026-10-01',4)]).dailyQuantity).toBeNull();
  });
  it('no inventa cantidades ni salta un intervalo con cantidad desconocida', () => {
    const result = estimate([purchase('a','2026-10-01',null),purchase('b','2026-10-08',2)]);
    expect(result.dailyQuantity).toBeNull(); expect(result.excludedIntervals).toBe(1); expect(result.nextPurchaseDate).toBeNull();
  });
  it('si un renglón del mismo día no tiene cantidad, el día completo queda incompleto', () => {
    const result = estimate([purchase('a','2026-10-01',2),purchase('b','2026-10-01',null),purchase('c','2026-10-08',2)]);
    expect(result.dailyQuantity).toBeNull();
  });
  it('puede mostrar promedio anterior pero no fecha próxima si falta cantidad en la última compra', () => {
    const result = estimate([purchase('a','2026-10-01',2),purchase('b','2026-10-08',null)]);
    expect(result.dailyQuantity).toBeCloseTo(2/7); expect(result.nextPurchaseDate).toBeNull();
  });
  it('excluye unidades, presentaciones y productos diferentes sin conversiones implícitas', () => {
    const result = estimate([purchase('a','2026-10-01',2),purchase('b','2026-10-08',10,{unit:'unidad'}),purchase('c','2026-10-09',1,{presentation:'6 unidades'}),purchase('d','2026-10-10',1,{productId:'other'})]);
    expect(result.purchaseDays).toBe(1); expect(result.dailyQuantity).toBeNull();
  });
  it('conserva historia de durables pero no recomienda reposición automática', () => {
    const result = estimate([purchase('a','2026-10-01',1),purchase('b','2026-10-15',1)], {...product,kind:'durable'});
    expect(result.purchaseDays).toBe(2); expect(result.nextPurchaseDate).toBeNull(); expect(result.suggestedQuantity).toBeNull();
  });
  it('ignora fechas futuras y fechas inexistentes', () => {
    const result = estimate([purchase('a','2026-10-01',2),purchase('b','2026-11-08',2),purchase('c','2026-02-30',2)]);
    expect(result.purchaseDays).toBe(1);
  });
  it('ordena fechas de forma determinista y no depende del orden del ticket', () => {
    const rows = [purchase('a','2026-10-01',2),purchase('b','2026-10-08',2),purchase('c','2026-10-15',3)];
    expect(estimate(rows)).toEqual(estimate([...rows].reverse()));
  });
  it('un intervalo extremo no desborda la fecha estimada ni rompe el módulo', () => {
    const result=estimate([purchase('a','1900-01-01',0.001),purchase('b','2026-10-01',999999999)]);
    expect(result.dailyQuantity).not.toBeNull();expect(result.nextPurchaseDate).toBeNull();
  });
  it('rechaza contratos desconocidos y horizontes inválidos', () => {
    expect(()=>estimatePurchases(product,[],'2026-10-26',7,{...contract,minimumPurchaseDays:1})).toThrow();
    expect(()=>estimatePurchases(product,[],'2026-10-26',0,contract)).toThrow();
  });
});

describe('Renglones revisados del comprobante', () => {
  const item = { rawName:'HUEVOS X12',name:'Huevos',presentation:'12 unidades',unit:'paquete',kind:'consumable',quantity:2,lineTotal:1500.50 };
  it('acepta cantidad desconocida y un importe de renglón gratuito', () => {
    expect(validatePurchaseItems([{...item,quantity:null,lineTotal:0}])[0]).toMatchObject({quantity:null,lineTotal:0});
  });
  it.each([0,-1,1.0001,Infinity,NaN,'2'])('rechaza cantidad inválida %s', quantity => expect(()=>validatePurchaseItems([{...item,quantity}])).toThrow());
  it.each([-1,1.001,Infinity,'10,50'])('rechaza importe inválido %s', lineTotal => expect(()=>validatePurchaseItems([{...item,lineTotal}])).toThrow());
  it('exige unidad y producto identificados antes de guardar', () => {
    expect(()=>validatePurchaseItems([{...item,unit:''}])).toThrow();
    expect(()=>validatePurchaseItems([{...item,name:''}])).toThrow();
    expect(()=>validatePurchaseItems(Array.from({length:101},()=>item))).toThrow();
  });
});
