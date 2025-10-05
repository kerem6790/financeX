import { useMemo, useState } from 'react';
import { formatCurrency, parseAmount, useFinanceStore } from './store';

interface FixedExpense {
  id: string;
  category: string;
  amount: string;
}

const createExpense = (): FixedExpense => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fx-${Math.random().toString(36).slice(2, 9)}`,
  category: '',
  amount: ''
});

const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const Planning = () => {
  const netWorth = useFinanceStore((state) => state.totals.netWorth);

  const [goal, setGoal] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([createExpense()]);

  const updateExpense = (id: string, key: keyof Omit<FixedExpense, 'id'>, value: string) => {
    setFixedExpenses((previous) => previous.map((expense) => (expense.id === id ? { ...expense, [key]: value } : expense)));
  };

  const addExpense = () => {
    setFixedExpenses((previous) => [...previous, createExpense()]);
  };

  const removeExpense = (id: string) => {
    setFixedExpenses((previous) => (previous.length > 1 ? previous.filter((expense) => expense.id !== id) : previous));
  };

  const totals = useMemo(() => {
    const goalValue = parseAmount(goal);
    const incomeValue = parseAmount(monthlyIncome);
    const fixedTotal = fixedExpenses.reduce((sum, expense) => sum + parseAmount(expense.amount), 0);

    const savingsQuarter = goalValue / 4;
    const flexibleSpending = incomeValue - fixedTotal - savingsQuarter;
    const weeklyLimit = flexibleSpending / 4;
    const remainingGoal = goalValue - netWorth;

    return {
      goalValue,
      incomeValue,
      fixedTotal,
      savingsQuarter,
      flexibleSpending,
      weeklyLimit,
      remainingGoal
    };
  }, [fixedExpenses, goal, monthlyIncome, netWorth]);

  const progressToGoal = clampProgress(totals.goalValue > 0 ? netWorth / totals.goalValue : 0);
  const weeklyProgress = 0; // Will connect to real data later.

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
              {fixedExpenses.map((expense) => (
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
                    disabled={fixedExpenses.length === 1}
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
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totals.flexibleSpending)}</p>
          <p className="mt-2 text-sm text-slate-500">
            Gelir – Sabit Giderler – (Hedef Birikim / 4)
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Haftalık Limit</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totals.weeklyLimit)}</p>
          <p className="mt-2 text-sm text-slate-500">Esnek harcama limitinin dörtte biri.</p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kalan Hedef</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totals.remainingGoal)}</p>
          <p className="mt-2 text-sm text-slate-500">Hedef birikim – Net Worth.</p>
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
        <h3 className="text-lg font-semibold text-slate-800">İlerleme</h3>
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
              <span>Hedefe ilerleme</span>
              <span>{(progressToGoal * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent transition-all duration-500"
                style={{ width: `${progressToGoal * 100}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
              <span>Haftalık harcama limiti</span>
              <span>{(weeklyProgress * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-500 transition-all duration-500"
                style={{ width: `${weeklyProgress * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">Haftalık harcama takibi yakında entegre edilecek.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planning;
