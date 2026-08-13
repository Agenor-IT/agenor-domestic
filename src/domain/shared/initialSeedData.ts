import { FlowNode } from '../cashflow/CashFlowProjectionService';
import { PaymentPriority } from '../priorities/PaymentPriority';

export const INITIAL_MONTHS = [
  "Ago-26", "Sep-26", "Oct-26", "Nov-26", "Dic-26",
  "Ene-27", "Feb-27", "Mar-27", "Abr-27", "May-27",
  "Jun-27", "Jul-27", "Ago-27", "Sep-27", "Oct-27",
  "Nov-27", "Dic-27"
];

export const INITIAL_DEFAULT_IPC = [
  0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01
];

export const DEFAULT_PAYMENT_PRIORITIES: PaymentPriority[] = [
  new PaymentPriority(1, 'card', 'supervielle_card', 'Tarjeta Supervielle', 1),
  new PaymentPriority(1, 'expense', 'bruno_medical', 'Médicos Bruno', 2),
  new PaymentPriority(1, 'tax', 'monotributo', 'Monotributo corriente', 3),
  new PaymentPriority(1, 'mortgage', 'hipotecario_1', 'Hipotecario 1', 4),
  new PaymentPriority(1, 'mortgage', 'hipotecario_2', 'Hipotecario 2', 5),
  new PaymentPriority(1, 'loan', 'supervielle_loan', 'Préstamo Supervielle', 6)
];

export const INITIAL_SECTIONS: FlowNode[] = [
  {
    id: "flow-opening",
    label: "Saldo inicial / proyectado",
    flowType: "initialBalance",
    note: "El saldo inicial de agosto es editable. Desde septiembre, cada mes toma automáticamente el saldo final proyectado del mes anterior.",
    children: []
  },
  {
    id: "income-section",
    label: "Ingresos proyectados",
    flowType: "group",
    children: [
      {
        id: "income-business",
        label: "Emprendimiento",
        origin: [2165000.0, 2386650.0, 2610516.5, 2836621.665, 3064987.88, 3295637.76, 3528594.14, 3763880.08, 4001518.88, 4241534.07, 4483949.41, 4728788.90, 4976076.79, 5225837.56, 5478095.94, 5732876.90, 5990205.66],
        flowType: "income",
        defaultMethod: "cash",
        allowedMethods: ["cash", "card"],
        note: "Proyección corregida desde Ago-26: $2.165.000; luego IPC mensual + crecimiento adicional.",
        children: []
      },
      {
        id: "income-rent",
        label: "Alquiler",
        origin: [450000.0, 550000.0, 550000.0, 550000.0, 550000.0, 572332.21, 572332.21, 572332.21, 572332.21, 595571.19, 595571.19, 595571.19, 595571.19, 619753.77, 619753.77, 619753.77, 619753.77],
        flowType: "income",
        defaultMethod: "cash",
        allowedMethods: ["cash", "card"],
        note: "Base $550.000 desde Sep-26. Se ajusta cada cuatro meses por IPC acumulado.",
        children: []
      },
      {
        id: "income-extra",
        label: "Ingresos extraordinarios",
        origin: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        flowType: "income",
        defaultMethod: "cash",
        allowedMethods: ["cash", "card"],
        note: "Fila disponible para registrar ingresos extraordinarios reales. No forma parte de la proyección base.",
        children: []
      }
    ]
  },
  {
    id: "expense-section",
    label: "Egresos proyectados",
    flowType: "group",
    children: [
      {
        id: "expense-bruno",
        label: "Bruno",
        flowType: "group",
        children: [
          {
            id: "expense-food-support",
            label: "Cuota alimentaria",
            origin: [376600.0, 380366.0, 384169.66, 388011.36, 391891.47, 395810.38, 399768.49, 403766.17, 407803.84, 411881.87, 416000.69, 420160.70, 424362.31, 428605.93, 432891.99, 437220.91, 441593.12],
            flowType: "expense",
            defaultMethod: "cash",
            allowedMethods: ["cash", "card", "debit"],
            note: "Base real Ago-26: $376.600; luego se ajusta 1% mensual.",
            children: []
          },
          {
            id: "expense-bruno-medical",
            label: "Médicos Bruno",
            origin: [210000.0, 212100.0, 214221.0, 216363.21, 218526.84, 220712.11, 222919.23, 225148.42, 227399.91, 229673.91, 231970.65, 234290.35, 236633.26, 238999.59, 241389.58, 243803.48, 246241.52],
            flowType: "expense",
            defaultMethod: "cash",
            allowedMethods: ["cash", "card", "debit"],
            note: "Base real Ago-26: $210.000; pagados $70.000 al 12/08; pendiente agosto $140.000.",
            children: []
          }
        ]
      },
      {
        id: "expense-misc",
        label: "Gastos varios",
        origin: [150000.0, 151500.0, 153015.0, 154545.15, 156090.60, 157651.51, 159228.02, 160820.30, 162428.51, 164052.79, 165693.32, 167350.25, 169023.75, 170713.99, 172421.13, 174145.34, 175886.80],
        flowType: "expense",
        defaultMethod: "cash",
        allowedMethods: ["cash", "card", "debit"],
        children: []
      },
      {
        id: "expense-business-fixed",
        label: "Gastos fijos emprendimiento",
        flowType: "group",
        children: [
          {
            id: "expense-software",
            label: "Software y servicios",
            flowType: "group",
            children: [
              { id: "expense-hostinger", label: "Hostinger", origin: Array(17).fill(35000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-tusfacturas", label: "TusFacturas", origin: Array(17).fill(35000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-chatgpt", label: "ChatGPT", origin: Array(17).fill(35000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-supabase", label: "Supabase", origin: Array(17).fill(40000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true }
            ]
          },
          {
            id: "expense-connectivity",
            label: "Conectividad",
            flowType: "group",
            children: [
              { id: "expense-internet", label: "Internet", origin: Array(17).fill(18000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-cellphone", label: "Celular", origin: Array(17).fill(25000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true }
            ]
          },
          {
            id: "expense-tax-current",
            label: "Monotributo corriente",
            flowType: "group",
            status: "current",
            note: "Obligación corriente fija por semestre.",
            children: [
              { id: "expense-tax-cash", label: "Pago corriente en efectivo", origin: [91714.67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], flowType: "expense", defaultMethod: "cash", allowedMethods: ["cash", "card", "debit"], status: "current" },
              { id: "expense-tax-card", label: "Pago corriente con tarjeta", origin: [0, 91714.67, 91714.67, 91714.67, 91714.67, 97356.97, 97356.97, 97356.97, 97356.97, 97356.97, 97356.97, 103346.39, 103346.39, 103346.39, 103346.39, 103346.39, 103346.39], flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], status: "current", cardConsumption: true }
            ]
          }
        ]
      },
      {
        id: "expense-home-fixed",
        label: "Gastos fijos domésticos",
        flowType: "group",
        children: [
          {
            id: "expense-home-services",
            label: "Servicios",
            flowType: "group",
            children: [
              { id: "expense-electricity", label: "Luz", origin: Array(17).fill(50000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-gas", label: "Gas", origin: Array(17).fill(25000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true },
              { id: "expense-water", label: "Agua", origin: Array(17).fill(20000.0), flowType: "expense", defaultMethod: "card", allowedMethods: ["cash", "card", "debit"], cardConsumption: true }
            ]
          },
          {
            id: "expense-food-hygiene",
            label: "Comida e higiene",
            origin: Array(17).fill(244352.30),
            flowType: "expense",
            defaultMethod: "card",
            allowedMethods: ["cash", "card", "debit"],
            note: "Base real Ago-26: $244.352,30. Compras con Naranja X.",
            cardConsumption: true,
            children: []
          }
        ]
      },
      {
        id: "expense-cards",
        label: "Tarjetas y saldos",
        flowType: "group",
        children: [
          {
            id: "expense-naranja",
            label: "Naranja X",
            flowType: "group",
            children: [
              { id: "expense-naranja-base", label: "Plan / deuda base Naranja X", origin: [956900.0, 561121.0, 521600.0, 521600.0, 495169.0, 374574.0, 190420.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0, 186617.0], flowType: "expense", defaultMethod: "cash", allowedMethods: ["cash", "debit"] },
              { id: "info-naranja-card-impact", label: "Consumos con tarjeta trasladados", flowType: "derivedCardImpact" }
            ]
          },
          { id: "expense-visa-cordobesa", label: "Visa Cordobesa", origin: [39999.17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], flowType: "expense", defaultMethod: "cash", allowedMethods: ["cash", "debit"], status: "current", note: "Mínimo $354.998 ya pagado. Saldo base residual $39.999,17. Cierre 24/08." },
          { id: "expense-card-supervielle", label: "Tarjeta Supervielle", origin: [193955.0, 93300.0, 17500.0, 10000.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], flowType: "expense", defaultMethod: "cash", allowedMethods: ["cash", "debit"], status: "current" }
        ]
      },
      {
        id: "expense-loans",
        label: "Préstamos y Moras",
        flowType: "group",
        children: [
          { id: "loan-hip1-current", label: "Hipotecario 1 - Cuota corriente", origin: Array(17).fill(254032.05), flowType: "expense", defaultMethod: "debit", allowedMethods: ["cash", "debit"], status: "current" },
          { id: "loan-hip2-current", label: "Hipotecario 2 - Cuota corriente", origin: Array(17).fill(44491.30), flowType: "expense", defaultMethod: "debit", allowedMethods: ["cash", "debit"], status: "current" },
          { id: "loan-supervielle-current", label: "Préstamo Supervielle - Cuota corriente", origin: Array(17).fill(148647.58), flowType: "expense", defaultMethod: "debit", allowedMethods: ["cash", "debit"], status: "current" },
          { id: "loan-nation-signature-current", label: "Nación solo firma - Cuota corriente", origin: Array(17).fill(650000.00), flowType: "expense", defaultMethod: "debit", allowedMethods: ["cash", "debit"], status: "current" },
          { id: "loan-nation-sgr-current", label: "Nación SGR - Cuota corriente", origin: Array(17).fill(125000.00), flowType: "expense", defaultMethod: "debit", allowedMethods: ["cash", "debit"], status: "current" }
        ]
      }
    ]
  },
  { id: "flow-net", label: "Flujo neto proyectado", flowType: "net" },
  { id: "flow-extra", label: "Ingresos extraordinarios necesarios", flowType: "extraNeeded" },
  { id: "flow-final", label: "Saldo final proyectado", flowType: "finalBalance" }
];

export const INITIAL_ACTUAL_STATE = {
  cutoff: "12/08/2026",
  availability: [
    { label: "Cuenta Naranja X", amount: 435637.37 },
    { label: "Efectivo pesos", amount: 200.0 }
  ],
  receivables: [
    { label: "Mayra Llanos", amount: 91000.0 },
    { label: "Clever Contreras", amount: 56000.0 }
  ],
  pending_required: [
    { label: "Tarjeta Supervielle", amount: 193955.0, priority: 1 },
    { label: "Médicos Bruno", amount: 140000.0, priority: 2 },
    { label: "Monotributo corriente", amount: 91714.67, priority: 3, note: "Vence 20/08." },
    { label: "Hipotecario 1", amount: 254032.05, priority: 4 },
    { label: "Hipotecario 2", amount: 44491.30, priority: 5 },
    { label: "Préstamo Supervielle", amount: 148647.58, priority: 6 },
    { label: "Nación solo firma", amount: 650000.0 },
    { label: "Nación SGR", amount: 125000.0 },
    { label: "Bancor — saldo base para cierre", amount: 39999.17, note: "Verificar saldo al 24/08." }
  ],
  scenario_no_extra: {
    title: "Escenario sin ingreso extra",
    note: "Usa caja actual + cobros Mayra/Clever. Prioriza según dom_payment_priorities (Supervielle tarjeta, Bruno, Monotributo y préstamos).",
    august: {
      available_after_receivables: 582837.37,
      carryover_total: 1105002.40
    },
    monthly: [
      { month: "Sep-26", income: 2936650.0, base_expense: 3147910.3, monthly_gap: 211260.3, accumulated_gap: 1316262.7 },
      { month: "Oct-26", income: 3160516.5, base_expense: 3299396.68, monthly_gap: 138880.18, accumulated_gap: 1455142.88 },
      { month: "Nov-26", income: 3386621.67, base_expense: 3536210.65, monthly_gap: 149588.98, accumulated_gap: 1604731.87 },
      { month: "Dic-26", income: 3614987.88, base_expense: 3773302.76, monthly_gap: 158314.88, accumulated_gap: 1763046.74 }
    ],
    debt_stock_total: 12931828.88
  }
};
