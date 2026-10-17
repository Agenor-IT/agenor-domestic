import { SearchableSelect } from './SearchableSelect';
import React, { useState, useMemo } from 'react';
import { Money } from '../../domain/shared/Money';
import { LineChart, Calendar, ArrowRight } from 'lucide-react';

export type PeriodFilterType = 'month' | 'year' | 'range';

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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Esta vista recibe proyecciones mensuales. No inventar series diarias o semanales.
  const chartData = useMemo(() => {
    const monthNumbers: Record<string, string> = {
      Ene: '01', Feb: '02', Mar: '03', Abr: '04', May: '05', Jun: '06',
      Jul: '07', Ago: '08', Sep: '09', Oct: '10', Nov: '11', Dic: '12'
    };
    const monthly = months.map((m, idx) => ({
      label: m,
      period: `20${m.slice(-2)}-${monthNumbers[m.slice(0, 3)] || '00'}`,
      income: income[idx] || Money.zero(),
      expense: expense[idx] || Money.zero(),
      net: net[idx] || Money.zero()
    }));
    if (periodFilter === 'range') {
      return monthly.filter(row =>
        (!startDate || row.period >= startDate.slice(0, 7)) &&
        (!endDate || row.period <= endDate.slice(0, 7))
      );
    }
    if (periodFilter === 'year') {
      const years = new Map<string, { label: string; income: Money; expense: Money; net: Money }>();
      for (const row of monthly) {
        const year = row.period.slice(0, 4);
        const current = years.get(year) || { label: year, income: Money.zero(), expense: Money.zero(), net: Money.zero() };
        years.set(year, {
          label: year,
          income: current.income.add(row.income),
          expense: current.expense.add(row.expense),
          net: current.net.add(row.net)
        });
      }
      return [...years.values()];
    }
    return monthly;
  }, [periodFilter, months, income, expense, net, startDate, endDate]);

  const maxVal = Math.max(
    ...chartData.map(d => d.income.toAmount()),
    ...chartData.map(d => d.expense.toAmount()),
    ...chartData.map(d => d.net.toAmount()),
    1
  );

  const minVal = Math.min(0, ...chartData.map(d => d.net.toAmount()));
  const chartHeight = 220;
  const itemWidth = Math.max(70, Math.floor(1100 / Math.max(chartData.length, 1)));
  const svgWidth = Math.max(1000, chartData.length * itemWidth);

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return chartHeight - ratio * (chartHeight - 30);
  };

  const pointsIncome = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(d.income.toAmount())}`).join(' ');
  const pointsExpense = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(d.expense.toAmount())}`).join(' ');
  const pointsNet = chartData.map((d, i) => `${i * itemWidth + itemWidth / 2},${getY(d.net.toAmount())}`).join(' ');

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-5 lg:p-6 shadow-sm mb-6">
      {/* HEADER DE GRÁFICO Y FILTROS DE PERÍODO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#0088FF] shrink-0" />
            <span>Proyección de flujo de caja</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Estimaciones del escenario. No son movimientos registrados.</p>
        </div>

        {/* SELECTOR DÍA / SEMANA / MES / AÑO / RANGO */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <label htmlFor="financial-period-mobile" className="w-full lg:hidden text-xs font-bold text-gray-700 dark:text-gray-200">
            Período
            <SearchableSelect
              id="financial-period-mobile"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as PeriodFilterType)}
              className="mt-1 block w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0F172A] px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white"
            >
              <option value="month">Mes</option>
              <option value="year">Año</option>
              <option value="range">Rango</option>
            </SearchableSelect>
          </label>
          <div className="hidden lg:flex lg:flex-wrap items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl max-w-full shrink-0">
            {(['month', 'year', 'range'] as PeriodFilterType[]).map((p) => {
              const labels: Record<PeriodFilterType, string> = {
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-xl text-xs">
              <Calendar className="hidden lg:block w-3.5 h-3.5 text-gray-400" />
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-gray-500 font-medium">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="max-w-full min-w-0 bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs"
                />
              </div>
              <ArrowRight className="hidden lg:block w-3 h-3 text-gray-400" />
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-gray-500 font-medium">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="max-w-full min-w-0 bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs"
                />
              </div>
            </div>
          )}

          {/* LEYENDA */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold pl-1 sm:pl-2">
            <div className="flex items-center gap-1.5 text-[#0f8a5f] dark:text-emerald-400">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#0f8a5f] dark:bg-emerald-400 shrink-0" />
              <span>Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#b54747] dark:text-red-400">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#b54747] dark:bg-red-400 shrink-0" />
              <span>Egresos</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#0088FF] dark:text-blue-400">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#0088FF] dark:bg-blue-400 shrink-0" />
              <span>Flujo Neto</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:hidden">
        {chartData.map((period, index) => (
          <div key={`${period.label}-${index}`} className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{period.label}</h3>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2 text-[#0f8a5f] dark:text-emerald-400"><dt>Ingresos</dt><dd className="font-bold text-right break-all">{period.income.toFormattedString()}</dd></div>
              <div className="flex justify-between gap-2 text-[#b54747] dark:text-red-400"><dt>Egresos</dt><dd className="font-bold text-right break-all">{period.expense.toFormattedString()}</dd></div>
              <div className="flex justify-between gap-2 border-t border-gray-200 dark:border-gray-700 pt-1.5 text-[#0088FF] dark:text-blue-400"><dt>Flujo neto</dt><dd className="font-bold text-right break-all">{period.net.toFormattedString()}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      {/* El gráfico ancho queda reservado para escritorio. */}
      <div className="relative hidden lg:block w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
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
            <line x1="0" y1={getY(0)} x2={svgWidth} y2={getY(0)} stroke="currentColor" className="text-gray-400 dark:text-gray-500" strokeDasharray="5 5" />
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
              const yNet = getY(d.net.toAmount());

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
