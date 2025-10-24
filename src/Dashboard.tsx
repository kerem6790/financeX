import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  buildNetWorthTrend,
  buildSuggestion,
  buildPaydayPlanSeries,
  buildExpenseActualSeries,
  buildPlanVsActualData,
  formatCurrencyLabel
} from './analytics';
import {
  formatCurrency,
  parseAmount,
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
  const planHistory = useFinanceStore((state) => state.planHistory);
  const planningMetrics = usePlanningStore((state) => state.metrics);
  const monthlyIncome = usePlanningStore((state) => state.monthlyIncome);
  const monthlyIncomeDay = usePlanningStore((state) => state.monthlyIncomeDay);
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

  const plannedCompletionDate = useMemo(() => {
    if (!planningMetrics.plannedCompletionDate) {
      return null;
    }
    const parsed = new Date(planningMetrics.plannedCompletionDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [planningMetrics.plannedCompletionDate]);

  const planMonthsAhead = useMemo(() => {
    const durationMonths = Number.isFinite(planningMetrics.planDurationMonths)
      ? Math.ceil(planningMetrics.planDurationMonths)
      : 0;

    let monthsFromDate = 0;
    if (plannedCompletionDate) {
      const now = new Date();
      const diffMs = plannedCompletionDate.getTime() - now.getTime();
      if (diffMs > 0) {
        monthsFromDate = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
      }
    }

    const value = Math.max(durationMonths, monthsFromDate);
    if (!Number.isFinite(value) || value <= 0) {
      return 3;
    }

    return Math.min(120, value);
  }, [planningMetrics.planDurationMonths, plannedCompletionDate]);

  const monthlyIncomeValue = useMemo(() => parseAmount(monthlyIncome), [monthlyIncome]);

  const plannedMonthlySpend = useMemo(() => {
    const spend = monthlyIncomeValue - planningMetrics.monthlySavingTarget;
    return spend > 0 ? spend : 0;
  }, [monthlyIncomeValue, planningMetrics.monthlySavingTarget]);

  const planSeries = useMemo(() => {
    if (planMonthsAhead <= 0) {
      return [];
    }
    const day = Number.parseInt(monthlyIncomeDay, 10);
    const incomeDay = Number.isFinite(day) ? day : 1;
    return buildPaydayPlanSeries(
      totals.netWorth,
      monthlyIncomeValue,
      plannedMonthlySpend,
      planMonthsAhead,
      incomeDay,
      plannedCompletionDate
    );
  }, [monthlyIncomeDay, totals.netWorth, monthlyIncomeValue, plannedMonthlySpend, planMonthsAhead, plannedCompletionDate]);

  const actualPointsFromEntries = useMemo(() => {
    const points = planHistory
      .map((point) => ({ date: new Date(point.capturedAt), value: point.value }))
      .filter((point) => !Number.isNaN(point.date.getTime()));

    if (points.length === 0) {
      points.push({ date: new Date(), value: totals.netWorth });
    }

    return points;
  }, [planHistory, totals.netWorth]);

  const planVsActualDataInputs = useMemo(() => {
    if (planSeries.length === 0) {
      return [];
    }
    return buildPlanVsActualData(planSeries, actualPointsFromEntries, totals.netWorth);
  }, [planSeries, actualPointsFromEntries, totals.netWorth]);

  const inputComparisonSummary = useMemo(() => {
    if (planSeries.length === 0 || actualPointsFromEntries.length === 0) {
      return null;
    }
    const latestActualPoint = actualPointsFromEntries[actualPointsFromEntries.length - 1];
    const planPoint = planSeries.find((point) => point.date >= latestActualPoint.date) ?? planSeries[planSeries.length - 1];
    const diff = latestActualPoint.value - planPoint.baseline;
    const status = Math.abs(diff) < 1
      ? 'Planla aynı tempodasın.'
      : diff > 0
        ? 'Planın ilerisindesin.'
        : 'Planın gerisindesin.';
    return {
      status,
      diff,
      diffLabel: formatCurrency(Math.abs(diff)),
      ahead: diff >= 0,
      actual: latestActualPoint.value,
      plan: planPoint.baseline
    };
  }, [planSeries, actualPointsFromEntries]);

  const expenseActualSeries = useMemo(() => {
    if (planSeries.length === 0) {
      return [];
    }
    const day = Number.parseInt(monthlyIncomeDay, 10);
    const incomeDay = Number.isFinite(day) ? day : 1;
    return buildExpenseActualSeries(
      totals.netWorth,
      monthlyIncomeValue,
      expenses,
      planMonthsAhead,
      incomeDay,
      plannedCompletionDate
    );
  }, [monthlyIncomeDay, totals.netWorth, monthlyIncomeValue, expenses, planMonthsAhead, plannedCompletionDate, planSeries.length]);

  const expenseActualPoints = useMemo(
    () => expenseActualSeries.map((point) => ({ date: point.date, value: point.baseline })),
    [expenseActualSeries]
  );

  const planVsActualDataExpenses = useMemo(() => {
    if (planSeries.length === 0) {
      return [];
    }
    return buildPlanVsActualData(planSeries, expenseActualPoints, totals.netWorth);
  }, [planSeries, expenseActualPoints, totals.netWorth]);

  const expenseComparisonSummary = useMemo(() => {
    if (planSeries.length === 0 || expenseActualPoints.length === 0) {
      return null;
    }
    const latestExpensePoint = expenseActualPoints[expenseActualPoints.length - 1];
    const planPoint = planSeries.find((point) => point.date >= latestExpensePoint.date) ?? planSeries[planSeries.length - 1];
    const diff = latestExpensePoint.value - planPoint.baseline;
    const status = Math.abs(diff) < 1
      ? 'Harcamalar plana paralel ilerliyor.'
      : diff > 0
        ? 'Harcamalar hedefe göre daha kontrollü.'
        : 'Harcamalar hedefin üzerinde.';
    return {
      status,
      diff,
      diffLabel: formatCurrency(Math.abs(diff)),
      ahead: diff >= 0,
      actual: latestExpensePoint.value,
      plan: planPoint.baseline
    };
  }, [planSeries, expenseActualPoints]);

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Plan vs Mevcut (Girdiler)</h3>
              <p className="text-sm text-slate-500">Girdi tablosundaki net worth güncellemeleri ile planlanan tempo karşılaştırması.</p>
            </div>
            <div className="flex gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-full bg-sky-500" /> Plan</span>
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-full bg-rose-500" /> Mevcut</span>
            </div>
          </div>
          <div className="mt-6 h-60 w-full">
            {planVsActualDataInputs.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                Girdi tablosuna düzenli kayıt ekledikçe karşılaştırma grafiği oluşacak.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={planVsActualDataInputs} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
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
                    formatter={(value: number, name: string) => [formatCurrency(value), name === 'plan' ? 'Planlanan' : 'Mevcut']}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                  />
                  <Line type="monotone" dataKey="plan" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="actual" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {inputComparisonSummary ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{inputComparisonSummary.status}</p>
              <p className="mt-1 text-xs text-slate-500">
                Plan: <span className="font-semibold text-slate-700">{formatCurrency(inputComparisonSummary.plan)}</span> · Mevcut: <span className="font-semibold text-slate-700">{formatCurrency(inputComparisonSummary.actual)}</span> → Fark: <span className={inputComparisonSummary.ahead ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{inputComparisonSummary.diff >= 0 ? '+' : '-'}{inputComparisonSummary.diffLabel}</span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Plan vs Harcama (Harcamalar Sekmesi)</h3>
              <p className="text-sm text-slate-500">Harcama kayıtları kullanılarak planlanan net worth temposu ile kıyaslama.</p>
            </div>
            <div className="flex gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-full bg-sky-500" /> Plan</span>
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-full bg-fuchsia-500" /> Harcama</span>
            </div>
          </div>
          <div className="mt-6 h-60 w-full">
            {planVsActualDataExpenses.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                Harcamalar sekmesine tarihli kayıtlar eklediğinizde grafik oluşacak.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={planVsActualDataExpenses} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
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
                    formatter={(value: number, name: string) => [formatCurrency(value), name === 'plan' ? 'Planlanan' : 'Harcamalara göre']}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                  />
                  <Line type="monotone" dataKey="plan" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="actual" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {expenseComparisonSummary ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{expenseComparisonSummary.status}</p>
              <p className="mt-1 text-xs text-slate-500">
                Plan: <span className="font-semibold text-slate-700">{formatCurrency(expenseComparisonSummary.plan)}</span> · Harcama Bazlı: <span className="font-semibold text-slate-700">{formatCurrency(expenseComparisonSummary.actual)}</span> → Fark: <span className={expenseComparisonSummary.ahead ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{expenseComparisonSummary.diff >= 0 ? '+' : '-'}{expenseComparisonSummary.diffLabel}</span>
              </p>
            </div>
          ) : null}
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
