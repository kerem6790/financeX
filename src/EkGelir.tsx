import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { buildProjectionCombinationSeries } from './analytics';
import { formatCurrency, useFinanceStore, usePlanningStore, useProjectionStore } from './store';

const chartColors = ['#4ade80', '#38bdf8', '#a855f7', '#f97316', '#facc15', '#ec4899'];

const initialFormState = {
  source: '',
  amount: '',
  expectedDate: '',
  probability: 50,
  note: ''
};

const EkGelir = () => {
  const netWorth = useFinanceStore((state) => state.totals.netWorth);
  const planningMetrics = usePlanningStore((state) => state.metrics);
  const monthlyIncomeDay = usePlanningStore((state) => state.monthlyIncomeDay);
  const projections = useProjectionStore((state) => state.entries);
  const addProjection = useProjectionStore((state) => state.addProjection);
  const removeProjection = useProjectionStore((state) => state.removeProjection);

  const [form, setForm] = useState(initialFormState);
  const [isAdding, setIsAdding] = useState(false);

  const totals = useMemo(() => {
    if (projections.length === 0) {
      return { total: 0, weightedProbability: 0 };
    }

    const total = projections.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const weighted = projections.reduce(
      (sum, entry) => sum + Number(entry.amount || 0) * (entry.probability / 100),
      0
    );

    return {
      total,
      weightedProbability: total > 0 ? (weighted / total) * 100 : 0
    };
  }, [projections]);

  const chartData = useMemo(() => {
    const sorted = [...projections]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 6);

    return sorted.map((entry) => ({
      name: entry.source || 'Kaynak',
      value: Number(entry.amount || 0)
    }));
  }, [projections]);

  const scenarioNetWorth = netWorth + totals.total;

  const projectionCombinations = useMemo(() => {
    const parsed = Number.parseInt(monthlyIncomeDay, 10);
    const incomeDay = Number.isFinite(parsed) ? parsed : 1;
    return buildProjectionCombinationSeries(netWorth, planningMetrics.monthlySavingTarget, projections, 3, 3, incomeDay);
  }, [monthlyIncomeDay, netWorth, planningMetrics.monthlySavingTarget, projections]);

  const sortedProjectionSeries = useMemo(() => {
    if (projectionCombinations.series.length === 0) {
      return [];
    }

    const [baseline, ...rest] = projectionCombinations.series;
    const sortedRest = rest
      .slice()
      .sort((a, b) => {
        const aValue = a.values[a.values.length - 1] ?? 0;
        const bValue = b.values[b.values.length - 1] ?? 0;
        return bValue - aValue;
      });

    return [...sortedRest, baseline];
  }, [projectionCombinations]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.source || Number(form.amount) <= 0) {
      return;
    }

    addProjection({
      ...form,
      probability: Math.min(Math.max(Number(form.probability), 0), 100)
    });

    setForm(initialFormState);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-24">
      <section className="flex flex-col gap-24">
        <div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-slate-900">Ek Gelir Projeksiyonları 💡</h2>
            <p className="text-sm text-slate-600">
              Olası gelir kaynaklarını planla, hedeflerini projekte et.
            </p>
          </div>

          <div className="mt-16 flex flex-col gap-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Potansiyel Gelir Kaynakları</h3>
                <p className="text-sm text-slate-500">
                  Her satır gerçekleşmesi muhtemel bir gelir senaryosunu temsil eder.
                </p>
              </div>
              <motion.button
                type="button"
                onClick={() => setIsAdding((prev) => !prev)}
                whileTap={{ scale: 0.94 }}
                className="rounded-full bg-gradient-to-r from-fx-accent-soft to-fx-accent px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                {isAdding ? 'Formu Kapat' : '+ Yeni Projeksiyon Ekle'}
              </motion.button>
            </div>

            <AnimatePresence>
              {isAdding && (
                <motion.form
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[1.5fr,1fr,1fr,1fr,auto]"
                  onSubmit={handleSubmit}
                >
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Kaynak
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-fx-accent focus:outline-none focus:ring-2 focus:ring-fx-accent/30"
                      value={form.source}
                      onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
                      placeholder="örn. Freelance proje"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Tahmini Tutar (₺)
                    <input
                      type="number"
                      min="0"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-fx-accent focus:outline-none focus:ring-2 focus:ring-fx-accent/30"
                      value={form.amount}
                      onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                      placeholder="örn. 15000"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Beklenen Tarih
                    <input
                      type="date"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-fx-accent focus:outline-none focus:ring-2 focus:ring-fx-accent/30"
                      value={form.expectedDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, expectedDate: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Olasılık (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-fx-accent focus:outline-none focus:ring-2 focus:ring-fx-accent/30"
                      value={form.probability}
                      onChange={(event) => setForm((prev) => ({ ...prev, probability: Number(event.target.value) }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 md:col-span-2">
                    Not
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-fx-accent focus:outline-none focus:ring-2 focus:ring-fx-accent/30"
                      value={form.note}
                      onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="İlave yorum"
                    />
                  </label>
                  <div className="flex items-end justify-end gap-3">
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.94 }}
                      className="rounded-full bg-fx-accent px-4 py-2 text-sm font-semibold text-white shadow-md"
                    >
                      Kaydet
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-4 py-3">Kaynak</th>
                    <th className="px-4 py-3">Tahmini Tutar (₺)</th>
                    <th className="px-4 py-3">Beklenen Tarih</th>
                    <th className="px-4 py-3">Olasılık (%)</th>
                    <th className="px-4 py-3">Not</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <AnimatePresence>
                    {projections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                          Henüz ek gelir projeksiyonu eklemediniz.
                        </td>
                      </tr>
                    ) : (
                      projections.map((entry) => (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="text-sm text-slate-700"
                        >
                          <td className="px-4 py-3 font-semibold">{entry.source || '—'}</td>
                          <td className="px-4 py-3 text-fx-accent">{formatCurrency(Number(entry.amount || 0))}</td>
                          <td className="px-4 py-3">{entry.expectedDate || '—'}</td>
                          <td className="px-4 py-3 text-fx-neutral">%{entry.probability.toFixed(0)}</td>
                          <td className="px-4 py-3 text-slate-500">{entry.note || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeProjection(entry.id)}
                              className="rounded-full border border-rose-200/60 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500 hover:border-rose-400 hover:text-rose-600"
                            >
                              Sil
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Projeksiyon Dağılımı</h3>
            <p className="text-sm text-slate-500">En yüksek tahmini gelir kaynakları</p>
            <div className="mt-6 h-64 w-full">
              {chartData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">
                  Verileri görebilmek için projeksiyon ekleyin.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Tahmini Tutar']}
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
              <span>
                Toplam Teorik Potansiyel Gelir: <span className="font-semibold text-fx-accent">{formatCurrency(totals.total)}</span>
              </span>
              <span>
                Ağırlıklı Ortalama Gerçekleşme: <span className="font-semibold text-fx-neutral">{totals.weightedProbability.toFixed(1)}%</span>
              </span>
            </div>

            <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Plan + Ek Gelir Senaryoları
                </span>
                <p className="text-sm text-slate-500">
                  Planlanan tasarruf temposu ve farklı ek gelir kombinasyonlarını karşılaştır.
                </p>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectionCombinations.data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
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
                      formatter={(value: number, name: string) => [formatCurrency(Number(value)), `${name} net değer`]}
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 42px rgba(148,163,184,0.25)' }}
                    />
                    {sortedProjectionSeries.map((seriesMeta, index) => (
                      <Line
                        key={seriesMeta.key}
                        type="monotone"
                        dataKey={seriesMeta.key}
                        name={seriesMeta.name}
                        stroke={seriesMeta.color}
                        strokeWidth={index === 0 ? 3 : 2.5}
                        dot={{ r: index === 0 ? 4 : 3, strokeWidth: 0 }}
                        activeDot={{ r: 6, stroke: '#0f172a', strokeWidth: 1, fill: seriesMeta.color }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
              <h3 className="text-lg font-semibold text-slate-800">Teorik Senaryo</h3>
*** End Patch
              <p className="mt-2 text-sm text-slate-500">Eğer tüm bu projeksiyonlar gerçekleşirse, mevcut Net Worth’ün yaklaşık şu seviyede olurdu:</p>
              <p className="mt-4 text-2xl font-semibold text-fx-positive">{formatCurrency(scenarioNetWorth)}</p>
              <p className="mt-1 text-xs text-slate-400">Teorik Hesaplama — Gerçek bakiyeyi etkilemez.</p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-fx-card">
              <h3 className="text-lg font-semibold text-slate-800">Teorik Özet</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• Toplam projeksiyon miktarı: <span className="font-semibold text-fx-accent">{formatCurrency(totals.total)}</span></li>
                <li>• Ortalama gerçekleşme olasılığı: <span className="font-semibold text-fx-neutral">{totals.weightedProbability.toFixed(1)}%</span></li>
                <li className="text-xs text-slate-400">Teorik Hesaplama — Gerçek Bakiyeyi Etkilemez.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EkGelir;
