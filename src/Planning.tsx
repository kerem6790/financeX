import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  buildMotivationMessage,
  buildPlanProjectionSeries,
  calculateEstimatedGoalDate,
  formatDate
} from './analytics';
import { formatCurrency, useFinanceStore, usePlanningStore } from './store';

const Planning = () => {
  const netWorth = useFinanceStore((state) => state.totals.netWorth);
  const goal = usePlanningStore((state) => state.goal);
  const monthlyIncome = usePlanningStore((state) => state.monthlyIncome);
  const expenses = usePlanningStore((state) => state.expenses);
  const metrics = usePlanningStore((state) => state.metrics);
  const setGoal = usePlanningStore((state) => state.setGoal);
  const setMonthlyIncome = usePlanningStore((state) => state.setMonthlyIncome);
  const targetMode = usePlanningStore((state) => state.targetMode);
  const targetDurationMonths = usePlanningStore((state) => state.targetDurationMonths);
  const targetDate = usePlanningStore((state) => state.targetDate);
  const setTargetMode = usePlanningStore((state) => state.setTargetMode);
  const setTargetDurationMonths = usePlanningStore((state) => state.setTargetDurationMonths);
  const setTargetDate = usePlanningStore((state) => state.setTargetDate);
  const addExpense = usePlanningStore((state) => state.addExpense);
  const updateExpense = usePlanningStore((state) => state.updateExpense);
  const removeExpense = usePlanningStore((state) => state.removeExpense);

  const plannedCompletionDate = useMemo(() => {
    if (!metrics.plannedCompletionDate) {
      return null;
    }
    const parsed = new Date(metrics.plannedCompletionDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [metrics.plannedCompletionDate]);

  const estimatedDate = useMemo(() => {
    const computed = calculateEstimatedGoalDate(
      netWorth,
      metrics.goalValue,
      metrics.weeklyLimit,
      metrics.weeklySpend
    );

    return computed ?? plannedCompletionDate;
  }, [metrics.goalValue, metrics.weeklyLimit, metrics.weeklySpend, netWorth, plannedCompletionDate]);

  const motivationMessage = useMemo(() => buildMotivationMessage(metrics.progressToGoal), [metrics.progressToGoal]);

  const planProjection = useMemo(
    () => buildPlanProjectionSeries(netWorth, metrics.monthlySavingTarget, 3),
    [netWorth, metrics.monthlySavingTarget]
  );

  const hasShortfall = !metrics.planFeasible;
  const shortfallPercent = (metrics.shortfallRatio * 100).toFixed(1);
  const flexibleAmountClass =
    metrics.flexibleSpending < 0 ? 'text-2xl font-semibold text-rose-600 md:text-3xl' : 'text-3xl font-semibold text-slate-900';
  const weeklyLimitClass =
    metrics.weeklyLimit <= 0 ? 'text-2xl font-semibold text-rose-600 md:text-3xl' : 'text-3xl font-semibold text-slate-900';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
      <div className="rounded-[28px] bg-white p-8 shadow-fx-card transition-shadow duration-300 hover:shadow-xl">
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hedef Birikim (₺)</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-800 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
                placeholder="örn. 250000"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aylık Gelir (₺)</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-800 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
                placeholder="örn. 65000"
                value={monthlyIncome}
                onChange={(event) => setMonthlyIncome(event.target.value)}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Hedef Zamanı
            </span>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${targetMode === 'duration' ? 'border-fx-accent bg-white text-fx-accent' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                <input
                  type="radio"
                  checked={targetMode === 'duration'}
                  onChange={() => setTargetMode('duration')}
                  className="sr-only"
                />
                <span>Kaç Ayda?</span>
              </label>
              <label className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${targetMode === 'date' ? 'border-fx-accent bg-white text-fx-accent' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                <input
                  type="radio"
                  checked={targetMode === 'date'}
                  onChange={() => setTargetMode('date')}
                  className="sr-only"
                />
                <span>Hangi Gün?</span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-end">
              {targetMode === 'duration' ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-600">Planlanan süre (ay)</span>
                <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
                    placeholder="örn. 4"
                    value={targetDurationMonths}
                    onChange={(event) => setTargetDurationMonths(event.target.value)}
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-600">Hedef tarih</span>
                <input
                    type="date"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
                    value={targetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                  />
                </label>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Plan süresi</p>
                <p>
                  ≈ {metrics.planDurationMonths > 0 ? metrics.planDurationMonths.toFixed(1) : '0.0'} ay ({targetMode === 'date' ? 'tarih bazlı' : 'süre bazlı'})
                </p>
              </div>
            </div>
          </div>

          {hasShortfall ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm text-rose-700">
              <p className="text-base font-semibold text-rose-600">Plan çok agresif görünüyor</p>
              <p className="mt-2">
                Seçtiğin süre ayda <span className="font-semibold">{formatCurrency(metrics.monthlySavingTarget)}</span> birikim gerektiriyor.
                Bu tutar, gelirinden {formatCurrency(metrics.monthlyShortfall)} fazla (%{shortfallPercent}).
              </p>
              <p className="mt-2 text-xs">
                Süreyi uzatarak veya hedef tutarı düşürerek planı daha gerçekçi hale getirebilirsin. Aksi halde haftalık limit negatif kalır.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-fx-card transition-shadow duration-300 hover:shadow-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Sabit Giderler</h3>
              <p className="text-sm text-slate-500">Kategori bazlı giderlerinizi ekleyin.</p>
            </div>
            <button
              type="button"
              onClick={addExpense}
              className="rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-fx-accent/30"
            >
              + Gider Ekle
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition duration-200 hover:border-fx-accent/50 md:flex-row md:items-center"
              >
                <input
                  type="text"
                  value={expense.category}
                  onChange={(event) => updateExpense(expense.id, 'category', event.target.value)}
                  placeholder="Kategori (örn. Kira)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={expense.amount}
                  onChange={(event) => updateExpense(expense.id, 'amount', event.target.value)}
                  placeholder="Tutar"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:outline-none focus:ring-4 focus:ring-fx-accent/20 md:max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => removeExpense(expense.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 text-lg font-semibold text-red-500 transition duration-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={expenses.length === 1}
                  aria-label="Gideri sil"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aylık Tasarruf Hedefi</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(metrics.monthlySavingTarget)}</p>
          <p className="mt-2 text-sm text-slate-500">Hedefe ulaşmak için ayda biriktirmen gereken tutar.</p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Esnek Harcama Limiti</h4>
          <p className={`mt-3 ${flexibleAmountClass}`}>{formatCurrency(metrics.flexibleSpending)}</p>
          <p className="mt-2 text-sm text-slate-500">Gelir – Sabit Giderler – Aylık tasarruf hedefi.</p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Haftalık Limit</h4>
          <p className={`mt-3 ${weeklyLimitClass}`}>{formatCurrency(metrics.weeklyLimit)}</p>
          <p className="mt-2 text-sm text-slate-500">Esnek harcama limitini haftalara böldüğümüzde kalan miktar.</p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kalan Hedef</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(metrics.remainingGoal)}</p>
          <p className="mt-2 text-sm text-slate-500">Hedef birikim – Net Worth.</p>
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
        <h3 className="text-lg font-semibold text-slate-800">İlerleme</h3>
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
              <span>Hedefe ilerleme</span>
              <span>{(metrics.progressToGoal * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent transition-all duration-500"
                style={{ width: `${metrics.progressToGoal * 100}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
              <span>Haftalık harcama limiti</span>
              <span>{(metrics.weeklyProgress * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-500 transition-all duration-500"
                style={{ width: `${metrics.weeklyProgress * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">
              Haftalık harcama: {formatCurrency(metrics.weeklySpend)} / {formatCurrency(metrics.weeklyLimit)}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planlanan Hedef Tarihi</span>
              <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(plannedCompletionDate)}</p>
              <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Tahmini gerçekleşme:</span>
                <span className="ml-2 text-slate-700">{formatDate(estimatedDate)}</span>
              </div>
              {estimatedDate === null && (
                <p className="mt-2 text-xs text-slate-500">
                  Haftalık tasarruf tutarınızı artırarak hedef tarihini netleştirebilirsiniz.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Motivasyon</span>
              <p className="mt-2 text-sm text-slate-700">{motivationMessage}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Planlanan Net Worth Trend'i
                </span>
                <p className="text-sm text-slate-500">Şu anki tempoda önümüzdeki 3 ay için beklenen hareket.</p>
              </div>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={planProjection.map((point) => {
                    const rawValue = metrics.planFeasible ? point.baseline : Math.max(point.baseline, 0);
                    return { label: point.label, value: Number(rawValue.toFixed(2)) };
                  })}
                  margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="planProjection" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(value).replace('₺', '')}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="url(#planProjection)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#0f172a', strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: '#0f172a', strokeWidth: 1, fill: '#22d3ee' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planning;
