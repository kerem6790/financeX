import { useMemo } from 'react';
import { formatCurrency, useFinanceStore, usePlanningStore } from './store';

const HISTORY_POINTS = [
  { label: 'Hafta 1', value: 120_000 },
  { label: 'Hafta 2', value: 128_500 },
  { label: 'Hafta 3', value: 131_200 },
  { label: 'Hafta 4', value: 135_800 },
  { label: 'Hafta 5', value: 140_400 }
];

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
};

const Dashboard = () => {
  const totals = useFinanceStore((state) => state.totals);
  const planningMetrics = usePlanningStore((state) => state.metrics);
  const currentGoal = usePlanningStore((state) => state.goal);

  const chart = useMemo(() => {
    const latestValue = totals.netWorth !== 0 ? totals.netWorth : HISTORY_POINTS[HISTORY_POINTS.length - 1]?.value ?? 0;
    const series = [...HISTORY_POINTS, { label: 'Bugün', value: latestValue }];
    const values = series.map((point) => point.value);
    const max = Math.max(...values, latestValue, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const denominator = series.length > 1 ? series.length - 1 : 1;

    const coordinates = series.map((point, index) => {
      const x = (index / denominator) * 100;
      const y = 100 - ((point.value - min) / range) * 100;
      return { x, y };
    });

    const path = coordinates.reduce((acc, coord, index) => (index === 0 ? `M ${coord.x} ${coord.y}` : `${acc} L ${coord.x} ${coord.y}`), '');
    const areaPath = `${path} L 100 100 L 0 100 Z`;
    const latest = series[series.length - 1];
    const previous = series[series.length - 2] ?? latest;
    const delta = latest.value - previous.value;

    return {
      series,
      coordinates,
      path,
      areaPath,
      delta
    };
  }, [totals.netWorth]);

  const progress = clampProgress(planningMetrics.progressToGoal);
  const goalValue = planningMetrics.goalValue || 0;
  const progressPercent = (progress * 100).toFixed(1);
  const deltaLabel = `${deltaDirection(chart.delta)} ${formatCurrency(Math.abs(chart.delta))}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
      <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Worth</span>
            <span className="text-4xl font-semibold text-slate-900">{formatCurrency(totals.netWorth)}</span>
          </div>
          <div className={`rounded-full px-4 py-1 text-sm font-semibold ${chart.delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
            {deltaLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Toplam Varlık</span>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatCurrency(totals.assets)}</p>
          <p className="mt-2 text-sm text-slate-500">Likid ve yatırımların toplamı.</p>
        </div>
        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Toplam Borç</span>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatCurrency(totals.debt)}</p>
          <p className="mt-2 text-sm text-slate-500">Kredi kartı ve diğer borçlar.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-[28px] bg-white p-8 shadow-fx-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Net Worth Trend</h3>
              <p className="text-sm text-slate-500">Son haftalardaki değişim (örnek veri)</p>
            </div>
          </div>
          <div className="mt-8 h-60 w-full">
            <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="networthGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path d={chart.areaPath} fill="url(#networthGradient)" opacity={0.6} />
              <path d={chart.path} fill="none" stroke="#2563eb" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              {chart.coordinates.map((point, index) => (
                <circle
                  key={`point-${point.x}-${point.y}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === chart.coordinates.length - 1 ? 1.6 : 1}
                  fill={index === chart.coordinates.length - 1 ? '#2563eb' : '#94a3b8'}
                />
              ))}
            </svg>
            <div className="mt-4 flex justify-between text-xs font-medium text-slate-400">
              {chart.series.map((point) => (
                <span key={point.label}>{point.label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
            <h3 className="text-lg font-semibold text-slate-800">Hedefe İlerleme</h3>
            <p className="mt-1 text-sm text-slate-500">
              {currentGoal ? `Hedef: ₺${currentGoal}` : 'Planlama sekmesinde hedef belirleyin.'}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                <span>İlerleme</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent transition-all duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
            <h3 className="text-lg font-semibold text-slate-800">Özet</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Esnek Harcama Limiti: {formatCurrency(planningMetrics.flexibleSpending)}</li>
              <li>• Haftalık Limit: {formatCurrency(planningMetrics.weeklyLimit)}</li>
              <li>• Kalan Hedef: {formatCurrency(planningMetrics.remainingGoal)}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

function deltaDirection(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) {
    return '±';
  }
  return delta > 0 ? '+' : '-';
}

export default Dashboard;
