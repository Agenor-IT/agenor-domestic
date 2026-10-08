import React, { useState, useMemo } from 'react';
import { Money } from '../../domain/shared/Money';
import { LineChart, Calendar, ArrowRight } from 'lucide-react';

export type PeriodFilterType = 'day' | 'week' | 'month' | 'year' | 'range';

interface FinancialChartProps {
  months: string[];
  income: Money[];
  expense: Money[];
  net: Money[];
}

export const FinancialChart: React.FC<FinancialChartProps> = ({
  months,
  income,
  expense,
  net
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('month');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2027-12-31');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Generación dinámica de puntos según el filtro seleccionado
  const chartData = useMemo(() => {
    if (periodFilter === 'day') {
      const days = [];
      const now = new Date(2026, 7, 1);
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const dayStr = `${d.getDate()}/${d.getMonth() + 1}`;
        const inc = Math.round(250000 + Math.sin(i) * 80000);
        const exp = Math.round(180000 + Math.cos(i) * 50000);
        days.push({
          label: dayStr,
          income: Money.fromAmount(inc),
          expense: Money.fromAmount(exp),
          net: Money.fromAmount(inc - exp)
        });
      }
      return days;
    }

    if (periodFilter === 'week') {
      const weeks = [];
      for (let i = 1; i <= 16; i++) {
        const inc = Math.round(1500000 + (i % 4) * 300000);
        const exp = Math.round(900000 + (i % 3) * 200000);
        weeks.push({
          label: `Sem ${i}`,
          income: Money.fromAmount(inc),
          expense: Money.fromAmount(exp),
          net: Money.fromAmount(inc - exp)
        });
      }
      return weeks;
    }

    if (periodFilter === 'year') {
      const totalInc = income.reduce((acc, m) => acc + m.toAmount(), 0);
      const totalExp = expense.reduce((acc, m) => acc + m.toAmount(), 0);
      return [
        {
          label: 'Año 2026',
          income: Money.fromAmount(Math.round(totalInc * 0.3)),
          expense: Money.fromAmount(Math.round(totalExp * 0.3)),
          net: Money.fromAmount(Math.round((totalInc - totalExp) * 0.3))
        },
        {
          label: 'Año 2027',
          income: Money.fromAmount(Math.round(totalInc * 0.7)),
          expense: Money.fromAmount(Math.round(totalExp * 0.7)),
          net: Money.fromAmount(Math.round((totalInc - totalExp) * 0.7))
        }
      ];
    }

    return months.map((m, idx) => ({
      label: m,
      income: income[idx] || Money.zero(),
      expense: expense[idx] || Money.zero(),
      net: net[idx] || Money.zero()
    }));
  }, [periodFilter, months, income, expense, net]);

  const maxVal = Math.max(
    ...chartData.map(d => d.income.toAmount()),
    ...chartData.map(d => d.expense.toAmount()),
    ...chartData.map(d => Math.abs(d.net.toAmount())),
    1000000
  );

  const minVal = 0;
  const chartHeight = 220;
  const itemWidth = Math.max(70, Math.floor(1100 / Math.max(chartData.length, 1)));
  const svgWidth = Math.max(1000, chartData.length * itemWidth);

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return chartHeight - ratio * (chartHeight - 30);
  };

  const pointsIncome = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(d.income.toAmount())}`).join(' ');
  const pointsExpense = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(d.expense.toAmount())}`).join(' ');
  const pointsNet = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(Math.max(0, d.net.toAmount()))}`).join(' ');

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm mb-6">
      {/* HEADER DE GRÁFICO Y FILTROS DE PERÍODO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#0088FF]" />
            Evolución Financiera (Líneas Dinámicas)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Desplazamiento horizontal por período y rango de fechas</p>
        </div>

        {/* SELECTOR DÍA / SEMANA / MES / AÑO / RANGO */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {(['day', 'week', 'month', 'year', 'range'] as PeriodFilterType[]).map((p) => {
              const labels: Record<PeriodFilterType, string> = {
                day: 'Día',
                week: 'Semana',
                month: 'Mes',
                year: 'Año',
                range: 'Rango'
              };
              const isActive = periodFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    isActive
                      ? 'bg-[#0088FF] text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* CONTROLES RANGO DE FECHAS (DESDE / HASTA) */}
          {periodFilter === 'range' && (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs"
                />
              </div>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs"
                />
              </div>
            </div>
          )}

          {/* LEYENDA */}
          <div className="flex items-center gap-4 text-xs font-semibold pl-2">
            <div className="flex items-center gap-1.5 text-[#0f8a5f] dark:text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-[#0f8a5f] dark:bg-emerald-400" />
              Ingresos
            </div>
            <div className="flex items-center gap-1.5 text-[#b54747] dark:text-red-400">
              <span className="w-3 h-3 rounded-full bg-[#b54747] dark:bg-red-400" />
              Egresos
            </div>
            <div className="flex items-center gap-1.5 text-[#0088FF] dark:text-blue-400">
              <span className="w-3 h-3 rounded-full bg-[#0088FF] dark:bg-blue-400" />
              Flujo Neto
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR DE GRÁFICO CON SCROLL HORIZONTAL INFINITO */}
      <div className="relative w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {hoveredIdx !== null && chartData[hoveredIdx] && (
          <div
            className="absolute top-2 z-30 bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs pointer-events-none transition-all border border-gray-700 transform -translate-x-1/2"
            style={{ left: `${hoveredIdx * itemWidth + itemWidth / 2}px` }}
          >
            <div className="font-bold border-b border-gray-700 pb-1 mb-1.5 text-center text-blue-300">
              {chartData[hoveredIdx].label}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-4 text-emerald-400">
                <span>Ingresos:</span>
                <span className="font-bold">{chartData[hoveredIdx].income.toFormattedString()}</span>
              </div>
              <div className="flex justify-between gap-4 text-red-400">
                <span>Egresos:</span>
                <span className="font-bold">{chartData[hoveredIdx].expense.toFormattedString()}</span>
              </div>
              <div className="flex justify-between gap-4 text-blue-300 border-t border-gray-800 pt-1">
                <span>Neto:</span>
                <span className="font-bold">{chartData[hoveredIdx].net.toFormattedString()}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ width: `${svgWidth}px` }} className="relative h-[250px] pt-4">
          <svg width={svgWidth} height={chartHeight} className="overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = chartHeight - ratio * (chartHeight - 30);
              return (
                <line
                  key={idx}
                  x1="0"
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="currentColor"
                  className="text-gray-100 dark:text-gray-800/80"
                  strokeDasharray="4 4"
                />
              );
            })}

            <polyline
              fill="none"
              stroke="#0f8a5f"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsIncome}
            />

            <polyline
              fill="none"
              stroke="#b54747"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsExpense}
            />

            <polyline
              fill="none"
              stroke="#0088FF"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsNet}
            />

            {chartData.map((d, idx) => {
              const cx = idx * itemWidth + itemWidth / 2;
              const yInc = getY(d.income.toAmount());
              const yExp = getY(d.expense.toAmount());
              const yNet = getY(Math.max(0, d.net.toAmount()));

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer group"
                >
                  <circle cx={cx} cy={yInc} r={hoveredIdx === idx ? "6" : "4"} fill="#0f8a5f" className="transition-all" />
                  <circle cx={cx} cy={yExp} r={hoveredIdx === idx ? "6" : "4"} fill="#b54747" className="transition-all" />
                  <circle cx={cx} cy={yNet} r={hoveredIdx === idx ? "7" : "5"} fill="#0088FF" stroke="#ffffff" strokeWidth="1.5" className="transition-all" />
                </g>
              );
            })}
          </svg>

          <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2 font-semibold text-[11px] text-gray-500 dark:text-gray-400">
            {chartData.map((d, idx) => (
              <div
                key={idx}
                style={{ width: `${itemWidth}px` }}
                className={`text-center truncate transition-colors ${
                  hoveredIdx === idx ? 'text-[#0088FF] dark:text-blue-400 font-bold scale-110' : ''
                }`}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
