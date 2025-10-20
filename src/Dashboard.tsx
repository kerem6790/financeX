import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  buildNetWorthTrend,
  buildSuggestion,
  formatCurrencyLabel
} from './analytics';
import {
  formatCurrency,
  useExpenseStore,
  useFinanceStore,
  usePlanningStore,
  type NetWorthSnapshot
} from './store';

const snapshotDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const Dashboard = () => {
  const totals = useFinanceStore((state) => state.totals);
  const snapshots = useFinanceStore((state) => state.snapshots);
  const captureSnapshot = useFinanceStore((state) => state.captureSnapshot);
  const removeSnapshot = useFinanceStore((state) => state.removeSnapshot);
  const restoreSnapshot = useFinanceStore((state) => state.restoreSnapshot);
  const planningMetrics = usePlanningStore((state) => state.metrics);
  const currentGoal = usePlanningStore((state) => state.goal);
  const expenses = useExpenseStore((state) => state.entries);

  const [undoSnapshot, setUndoSnapshot] = useState<NetWorthSnapshot | null>(null);

  const netWorthTrend = useMemo(
    () => buildNetWorthTrend(snapshots, totals.netWorth),
    [snapshots, totals.netWorth]
  );

  const chartDelta = useMemo(() => {
    if (netWorthTrend.length < 2) {
      return 0;
    }
    const latest = netWorthTrend[netWorthTrend.length - 1]?.value ?? 0;
    const previous = netWorthTrend[netWorthTrend.length - 2]?.value ?? latest;
    return latest - previous;
  }, [netWorthTrend]);

  const hasSnapshots = snapshots.length > 0;
  const recentSnapshots = useMemo(
    () =>
      snapshots
        .slice()
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, 5),
    [snapshots]
  );

  useEffect(() => {
    if (!undoSnapshot) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setUndoSnapshot(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [undoSnapshot]);

  const handleRemoveSnapshot = (id: string) => {
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) {
      return;
    }

    removeSnapshot(id);
    setUndoSnapshot(snapshot);
  };

  const handleUndoRemove = () => {
    if (!undoSnapshot) {
      return;
    }

    restoreSnapshot(undoSnapshot);
    setUndoSnapshot(null);
  };

  const suggestion = useMemo(() => buildSuggestion(expenses), [expenses]);

  const progress = Number.isFinite(planningMetrics.progressToGoal)
    ? Math.min(Math.max(planningMetrics.progressToGoal, 0), 1)
    : 0;
  const goalValue = planningMetrics.goalValue || 0;
  const progressPercent = (progress * 100).toFixed(1);
  const deltaLabel = `${deltaDirection(chartDelta)} ${formatCurrency(Math.abs(chartDelta))}`;

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
        <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Worth</span>
              <span className="text-4xl font-semibold text-slate-900">{formatCurrency(totals.netWorth)}</span>
            </div>
            <div className={`rounded-full px-4 py-1 text-sm font-semibold ${chartDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
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
              <h3 className="text-lg font-semibold text-slate-800">Net Değer Değişimi (₺)</h3>
              <p className="text-sm text-slate-500">
                Anlık net değerinizi kaydetmek için aşağıdaki SS butonunu kullanın.
              </p>
            </div>
          </div>
          <div className="mt-8 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={netWorthTrend.map((point) => ({
                  label: point.label,
                  timestamp: point.date.getTime(),
                  netWorth: Number(point.value.toFixed(2))
                }))}
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="networthLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  width={96}
                  tickMargin={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value).replace('₺', '₺ ')}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrencyLabel(value), 'Net değer']}
                  labelStyle={{ fontWeight: 600 }}
                  contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="url(#networthLine)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: '#0f172a', strokeWidth: 1, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex items-center justify-between">
            {!hasSnapshots ? (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Henüz kayıt yok. SS ile ilk net değerini kaydet.
              </p>
            ) : null}
            <button
              type="button"
              onClick={captureSnapshot}
              className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 active:scale-[0.97]"
              aria-label="Şu anki net değeri kaydet"
            >
              SS
            </button>
          </div>
          {hasSnapshots ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Kaydedilmiş Net Worth SS'leri
                </span>
                <span className="text-xs text-slate-400">Son {recentSnapshots.length} kayıt</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-200 text-sm text-slate-600">
                {recentSnapshots.map((snapshot) => (
                  <li key={snapshot.id} className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">{formatCurrency(snapshot.value)}</span>
                      <span className="text-xs text-slate-400">
                        {snapshotDateFormatter.format(new Date(snapshot.capturedAt))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSnapshot(snapshot.id)}
                      className="rounded-full border border-rose-200/70 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-400 hover:text-rose-600"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
              <li>
                • Haftalık Limit: {formatCurrency(planningMetrics.weeklyLimit)} ({(planningMetrics.weeklyProgress * 100).toFixed(1)}% kullanıldı)
              </li>
              <li>• Haftalık Harcama: {formatCurrency(planningMetrics.weeklySpend)}</li>
              <li>• Kalan Hedef: {formatCurrency(planningMetrics.remainingGoal)}</li>
            </ul>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
            <h3 className="text-lg font-semibold text-slate-800">Akıllı Öneri</h3>
            {suggestion ? (
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {suggestion.highlight}
                </span>
                <p>{suggestion.message}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Harcamalarınızı ekledikçe size özel öneriler burada görünecek.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
      {undoSnapshot ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-xl">
          <span>
            Son kaydı sildin. <span className="font-semibold text-slate-800">{formatCurrency(undoSnapshot.value)}</span> geri alınsın mı?
          </span>
          <button
            type="button"
            onClick={handleUndoRemove}
            className="rounded-full border border-fx-accent px-3 py-1 text-xs font-semibold text-fx-accent transition hover:bg-fx-accent hover:text-white"
          >
            Geri Al
          </button>
        </div>
      ) : null}
    </>
  );
};

function deltaDirection(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) {
    return '±';
  }
  return delta > 0 ? '+' : '-';
}

export default Dashboard;
