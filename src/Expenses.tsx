import { FormEvent, useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  formatCurrency,
  parseAmount,
  useExpenseStore,
  usePlanningStore
} from './store';
import { buildMonthlySpendingInsight } from './analytics';

const todayIso = new Date().toISOString().slice(0, 10);

const Expenses = () => {
  const entries = useExpenseStore((state) => state.entries);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const planningMetrics = usePlanningStore((state) => state.metrics);

  const [category, setCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(todayIso);

  const totalSpent = useMemo(
    () => entries.reduce((sum, entry) => sum + parseAmount(entry.amount), 0),
    [entries]
  );

  const monthlyInsight = useMemo(() => buildMonthlySpendingInsight(entries), [entries]);
  const trendClass = monthlyInsight.trendTone === 'positive'
    ? 'text-emerald-600'
    : monthlyInsight.trendTone === 'negative'
      ? 'text-rose-600'
      : 'text-slate-500';

  let trendMessage = 'Harcamalar dengede 👍';
  if (monthlyInsight.trendTone === 'negative' && monthlyInsight.percentageChange > 10) {
    trendMessage = 'Harcama oranı yükseldi ⚠️';
  } else if (monthlyInsight.trendTone === 'positive') {
    trendMessage = 'Harcamalarda iyileşme 👏';
  }

  const categoryTotals = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    entries.forEach((entry) => {
      const nextValue = (totals.get(entry.category as ExpenseCategory) ?? 0) + parseAmount(entry.amount);
      totals.set(entry.category as ExpenseCategory, nextValue);
    });

    const data = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      total: totals.get(cat) ?? 0
    }));
    const max = Math.max(...data.map((item) => item.total), 1);

    return { data, max };
  }, [entries]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!amount || parseAmount(amount) <= 0) {
      return;
    }

    addExpense({
      category,
      description: description.trim(),
      amount,
      date
    });

    setDescription('');
    setAmount('');
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
      <div className="rounded-[28px] bg-white p-8 shadow-fx-card transition-shadow duration-300 hover:shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Harcamalar</h2>
        <p className="mt-1 text-sm text-slate-500">Haftalık giderlerinizi kaydedin ve limitlerinizi takip edin.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Bu ayki toplam harcama
            </span>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              {formatCurrency(monthlyInsight.currentMonthTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {monthlyInsight.currentMonthLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Geçen aya göre değişim
            </span>
            <p className={`mt-2 text-lg font-semibold ${trendClass}`}>
              {monthlyInsight.trendLabel}
            </p>
            <p className={`mt-1 text-xs ${trendClass}`}>{trendMessage}</p>
          </div>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-[1fr,1fr,1fr,auto]" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kategori</label>
            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
              value={category}
              onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
            >
              {EXPENSE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Açıklama</label>
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
              placeholder="örn. Market alışverişi"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tutar (₺)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
              placeholder="örn. 850"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tarih</label>
            <input
              type="date"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 focus:border-fx-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-fx-accent/20"
              value={date}
              max={todayIso}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="self-end rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-fx-accent/30"
          >
            Kaydet
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
          <h3 className="text-lg font-semibold text-slate-800">Kategori Bazlı Dağılım</h3>
          <p className="mt-1 text-sm text-slate-500">Harcamalarınızı kategorilere göre inceleyin.</p>

          <div className="mt-6 flex flex-col gap-4">
            {categoryTotals.data.map((item) => (
              <div key={item.category} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                  <span>{item.category}</span>
                  <span>{formatCurrency(item.total)}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-200 to-fx-accent transition-all duration-500"
                    style={{ width: `${(item.total / categoryTotals.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Haftalık Harcama</h4>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(planningMetrics.weeklySpend)}</p>
            <p className="mt-2 text-sm text-slate-500">Son 7 gün içerisindeki toplam harcama.</p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-500 transition-all duration-500"
                style={{ width: `${planningMetrics.weeklyProgress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Limit: {formatCurrency(planningMetrics.weeklyLimit)} · Kullanım: {(Math.min(planningMetrics.weeklyProgress * 100, 999)).toFixed(1)}%
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Toplam Harcama</h4>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{formatCurrency(totalSpent)}</p>
            <p className="mt-2 text-sm text-slate-500">Tüm zamanlar genelinde kaydedilen toplam.</p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-fx-card">
        <h3 className="text-lg font-semibold text-slate-800">Harcamalar Listesi</h3>
        <div className="mt-6 flex flex-col gap-3">
          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Henüz harcama eklemediniz.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 transition duration-200 hover:border-fx-accent/50 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-800">{entry.description || 'Harcamalar'}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{entry.category}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">{new Date(entry.date).toLocaleDateString('tr-TR')}</span>
                  <span className="text-base font-semibold text-slate-900">{formatCurrency(parseAmount(entry.amount))}</span>
                  <button
                    type="button"
                    onClick={() => removeExpense(entry.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-base font-semibold text-red-500 transition duration-200 hover:bg-red-100"
                    aria-label="Harcamayı sil"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
