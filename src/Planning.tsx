import { useMemo } from 'react';
import { buildMotivationMessage, calculateEstimatedGoalDate, formatDate } from './analytics';
import { formatCurrency, useFinanceStore, usePlanningStore } from './store';

const Planning = () => {
  const netWorth = useFinanceStore((state) => state.totals.netWorth);
  const goal = usePlanningStore((state) => state.goal);
  const monthlyIncome = usePlanningStore((state) => state.monthlyIncome);
  const expenses = usePlanningStore((state) => state.expenses);
  const metrics = usePlanningStore((state) => state.metrics);
  const setGoal = usePlanningStore((state) => state.setGoal);
  const setMonthlyIncome = usePlanningStore((state) => state.setMonthlyIncome);
  const addExpense = usePlanningStore((state) => state.addExpense);
  const updateExpense = usePlanningStore((state) => state.updateExpense);
  const removeExpense = usePlanningStore((state) => state.removeExpense);

  const estimatedDate = useMemo(
    () => calculateEstimatedGoalDate(netWorth, metrics.goalValue, metrics.weeklyLimit, metrics.weeklySpend),
    [metrics.goalValue, metrics.weeklyLimit, metrics.weeklySpend, netWorth]
  );

  const motivationMessage = useMemo(() => buildMotivationMessage(metrics.progressToGoal), [metrics.progressToGoal]);

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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Esnek Harcama Limiti</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(metrics.flexibleSpending)}</p>
          <p className="mt-2 text-sm text-slate-500">
            Gelir – Sabit Giderler – (Hedef Birikim / 4)
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Haftalık Limit</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(metrics.weeklyLimit)}</p>
          <p className="mt-2 text-sm text-slate-500">Esnek harcama limitinin dörtte biri.</p>
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
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tahmini hedefe ulaşma tarihi
              </span>
              <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(estimatedDate)}</p>
              {estimatedDate === null && (
                <p className="mt-1 text-xs text-slate-500">
                  Haftalık tasarruf tutarınızı artırarak hedef tarihini netleştirebilirsiniz.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Motivasyon</span>
              <p className="mt-2 text-sm text-slate-700">{motivationMessage}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planning;
