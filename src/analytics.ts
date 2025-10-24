import {
  formatCurrency,
  parseAmount,
  type NetWorthSnapshot,
  type SpendingEntry,
  type ExtraIncomeEntry,
  type ProjectionEntry,
  EXPENSE_CATEGORIES,
  type ExpenseCategory
} from './store';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric'
});

const projectionFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  year: 'numeric'
});

const payDayFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short'
});

export interface TrendPoint {
  label: string;
  value: number;
  date: Date;
}

export const buildNetWorthTrend = (snapshots: NetWorthSnapshot[], fallbackNetWorth: number): TrendPoint[] => {
  if (!snapshots || snapshots.length === 0) {
    const now = new Date();
    return [
      {
        label: dateFormatter.format(now),
        value: fallbackNetWorth,
        date: now
      }
    ];
  }

  return snapshots
    .slice()
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((snapshot) => {
      const date = new Date(snapshot.capturedAt);
      return {
        label: dateFormatter.format(date),
        value: snapshot.value,
        date
      };
    });
};

export interface NetWorthProjectionPoint {
  label: string;
  date: Date;
  baseline: number;
  withExtra?: number;
}

export interface ProjectionScenarioSeries {
  key: string;
  name: string;
  color: string;
  values: number[];
}

export interface ProjectionCombinationResult {
  data: Array<Record<string, number | string>>;
  series: ProjectionScenarioSeries[];
}

const clampNumber = (value: number): number => (Number.isFinite(value) ? value : 0);

const clampDayForMonth = (year: number, month: number, day: number): number => {
  if (!Number.isFinite(day)) {
    return 1;
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(Math.floor(day), lastDay));
  return Number.isFinite(safeDay) ? safeDay : 1;
};

const resolveIncomeDate = (start: Date, day: number, offset: number): Date => {
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const clampCurrent = clampDayForMonth(base.getFullYear(), base.getMonth(), day);

  let firstOccurrence: Date;
  if (base.getDate() <= clampCurrent) {
    firstOccurrence = new Date(base.getFullYear(), base.getMonth(), clampCurrent);
  } else {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const clampNext = clampDayForMonth(nextMonth.getFullYear(), nextMonth.getMonth(), day);
    firstOccurrence = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), clampNext);
  }

  if (offset <= 1) {
    return firstOccurrence;
  }

  const monthIndex = firstOccurrence.getMonth() + (offset - 1);
  const targetYear = firstOccurrence.getFullYear() + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const clampTarget = clampDayForMonth(targetYear, targetMonth, day);
  return new Date(targetYear, targetMonth, clampTarget);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (input: Date): Date => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const monthIndex = result.getMonth() + months;
  const year = result.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const clamp = clampDayForMonth(year, month, result.getDate());
  return new Date(year, month, clamp);
};

export const buildPlanProjectionSeries = (
  currentNetWorth: number,
  monthlySavingTarget: number,
  monthsAhead = 3,
  incomeDay = 1
): NetWorthProjectionPoint[] => {
  const base = clampNumber(currentNetWorth);
  const monthlyDelta = clampNumber(monthlySavingTarget);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const points: NetWorthProjectionPoint[] = [];
  points.push({
    label: projectionFormatter.format(start),
    date: start,
    baseline: base
  });

  let runningTotal = base;

  for (let idx = 1; idx <= monthsAhead; idx += 1) {
    runningTotal += monthlyDelta;
    const projectedDate = resolveIncomeDate(start, incomeDay, idx);
    points.push({
      label: projectionFormatter.format(projectedDate),
      date: projectedDate,
      baseline: runningTotal
    });
  }

  return points;
};

const normaliseProjectionAmount = (entry: ProjectionEntry, weighted: boolean): number => {
  const amount = clampNumber(parseAmount(entry.amount));
  if (amount <= 0) {
    return 0;
  }

  if (!weighted) {
    return amount;
  }

  const probability = Number.isFinite(entry.probability) ? entry.probability : 0;
  return amount * Math.max(Math.min(probability, 100), 0) * 0.01;
};

export const buildPlanProjectionWithExtraIncome = (
  currentNetWorth: number,
  monthlySavingTarget: number,
  projections: ProjectionEntry[],
  monthsAhead = 3,
  weighted = true,
  incomeDay = 1
): NetWorthProjectionPoint[] => {
  const baseSeries = buildPlanProjectionSeries(currentNetWorth, monthlySavingTarget, monthsAhead, incomeDay);

  if (!projections || projections.length === 0) {
    return baseSeries.map((point) => ({ ...point, withExtra: point.baseline }));
  }

  const extrasAccumulator = new Array(baseSeries.length).fill(0);

  projections.forEach((entry) => {
    const expected = entry.expectedDate ? new Date(entry.expectedDate) : null;
    if (!expected || Number.isNaN(expected.getTime())) {
      return;
    }

    const amount = normaliseProjectionAmount(entry, weighted);
    if (amount <= 0) {
      return;
    }

    const index = baseSeries.findIndex((point) => expected <= point.date);
    const targetIndex = index === -1 ? baseSeries.length - 1 : index;
    extrasAccumulator[targetIndex] += amount;
  });

  let runningExtra = 0;
  return baseSeries.map((point, index) => {
    runningExtra += extrasAccumulator[index] ?? 0;
    return {
      ...point,
      withExtra: point.baseline + runningExtra
    };
  });
};

export const buildPaydayPlanSeries = (
  currentNetWorth: number,
  monthlyIncome: number,
  plannedMonthlySpend: number,
  monthsAhead: number,
  incomeDay: number,
  plannedCompletion?: Date | null
): NetWorthProjectionPoint[] => {
  const base = clampNumber(currentNetWorth);
  const incomeValue = Math.max(0, clampNumber(monthlyIncome));
  const spendValue = Math.max(0, clampNumber(plannedMonthlySpend));
  const incomeDaySafe = Number.isFinite(incomeDay) && incomeDay >= 1 && incomeDay <= 31 ? Math.floor(incomeDay) : 1;

  const start = startOfDay(new Date());
  const monthsPositive = Math.max(1, Number.isFinite(monthsAhead) ? Math.ceil(monthsAhead) : 1);
  let endDate = plannedCompletion ? startOfDay(plannedCompletion) : addMonths(start, monthsPositive);
  if (endDate <= start) {
    endDate = addMonths(start, monthsPositive);
  }

  const points: NetWorthProjectionPoint[] = [
    {
      label: payDayFormatter.format(start),
      date: start,
      baseline: Number(base.toFixed(2))
    }
  ];

  let currentNet = base;
  let cycleStart = start;
  let cycleIndex = 1;
  const maxCycles = Math.min(240, monthsPositive + 6);

  while (cycleStart < endDate && cycleIndex <= maxCycles) {
    const nextPayDay = startOfDay(resolveIncomeDate(start, incomeDaySafe, cycleIndex));
    const totalCycleDays = Math.max(1, Math.round((nextPayDay.getTime() - cycleStart.getTime()) / DAY_MS));

    if (nextPayDay >= endDate) {
      const elapsedDays = Math.max(0, Math.round((endDate.getTime() - cycleStart.getTime()) / DAY_MS));
      const spendPerDay = spendValue / totalCycleDays;
      const spentSoFar = Math.min(spendValue, spendPerDay * elapsedDays);
      const partialNet = currentNet - spentSoFar;
      points.push({
        label: payDayFormatter.format(endDate),
        date: endDate,
        baseline: Number(partialNet.toFixed(2))
      });
      break;
    }

    const beforeIncomeNet = currentNet - spendValue;
    const dayBeforePayday = new Date(nextPayDay.getTime() - DAY_MS);
    if (dayBeforePayday > cycleStart) {
      points.push({
        label: payDayFormatter.format(dayBeforePayday),
        date: dayBeforePayday,
        baseline: Number(beforeIncomeNet.toFixed(2))
      });
    }

    const afterIncomeNet = beforeIncomeNet + incomeValue;
    points.push({
      label: payDayFormatter.format(nextPayDay),
      date: nextPayDay,
      baseline: Number(afterIncomeNet.toFixed(2))
    });

    currentNet = afterIncomeNet;
    cycleStart = nextPayDay;
    cycleIndex += 1;
  }

  return points;
};

const scenarioColors = ['#38bdf8', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#facc15', '#ef4444', '#6366f1'];

const getProjectionLabel = (entries: ProjectionEntry[]): string => {
  if (entries.length === 0) {
    return '';
  }

  if (entries.length === 1) {
    return entries[0].source || 'Senaryo';
  }

  return entries
    .map((entry) => entry.source || 'Senaryo')
    .filter(Boolean)
    .join(' + ');
};

export const buildProjectionCombinationSeries = (
  currentNetWorth: number,
  monthlySavingTarget: number,
  projections: ProjectionEntry[],
  monthsAhead = 3,
  maxCombinations = 3,
  incomeDay = 1
): ProjectionCombinationResult => {
  const baseSeries = buildPlanProjectionSeries(currentNetWorth, monthlySavingTarget, monthsAhead, incomeDay);
  const chartData = baseSeries.map((point) => ({ label: point.label } as Record<string, number | string>));
  const series: ProjectionScenarioSeries[] = [];

  series.push({ key: 'baseline', name: 'Planlanan tempo', color: scenarioColors[0], values: [] });
  baseSeries.forEach((point, index) => {
    const value = Number(point.baseline.toFixed(2));
    chartData[index].baseline = value;
    series[0].values.push(value);
  });

  if (!projections || projections.length === 0) {
    return { data: chartData, series };
  }

  const selected = projections.slice(0, maxCombinations);
  const scenarioCount = 1 << selected.length;
  const now = new Date();

  for (let mask = 1; mask < scenarioCount; mask += 1) {
    const involved: ProjectionEntry[] = [];
    for (let bit = 0; bit < selected.length; bit += 1) {
      if ((mask & (1 << bit)) !== 0) {
        involved.push(selected[bit]);
      }
    }

    const contributions = new Array(monthsAhead + 1).fill(0);

    involved.forEach((entry) => {
      const expected = entry.expectedDate ? new Date(entry.expectedDate) : null;
      if (!expected || Number.isNaN(expected.getTime())) {
        return;
      }

      const amount = normaliseProjectionAmount(entry, false);
      if (amount <= 0) {
        return;
      }

      const diffMonths = (expected.getFullYear() - now.getFullYear()) * 12 + (expected.getMonth() - now.getMonth());
      const index = diffMonths < 0 ? 0 : Math.min(monthsAhead, diffMonths);
      contributions[index] += amount;
    });

    const key = `scenario_${series.length}`;
    const name = getProjectionLabel(involved) || `Senaryo ${series.length}`;
    const color = scenarioColors[series.length % scenarioColors.length];
    const values: number[] = [];

    let runningExtra = 0;
    baseSeries.forEach((point, index) => {
      runningExtra += contributions[index] ?? 0;
      const value = Number((point.baseline + runningExtra).toFixed(2));
      values.push(value);
      chartData[index][key] = value;
    });

    series.push({ key, name, color, values });
  }

  return { data: chartData, series };
};

export interface MonthlySpendingInsight {
  currentMonthTotal: number;
  lastMonthTotal: number;
  difference: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'flat';
  trendLabel: string;
  trendTone: 'positive' | 'negative' | 'neutral';
  currentMonthLabel: string;
  lastMonthLabel: string;
}

export const buildMonthlySpendingInsight = (entries: SpendingEntry[]): MonthlySpendingInsight => {
  const now = new Date();
  const startOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevious = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevious = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  let currentMonthTotal = 0;
  let lastMonthTotal = 0;

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    const amount = parseAmount(entry.amount);
    if (Number.isNaN(date.getTime()) || amount <= 0) {
      return;
    }

    if (date >= startOfCurrent) {
      currentMonthTotal += amount;
    } else if (date >= startOfPrevious && date <= endOfPrevious) {
      lastMonthTotal += amount;
    }
  });

  const difference = currentMonthTotal - lastMonthTotal;
  const percentageChange = lastMonthTotal > 0 ? (difference / lastMonthTotal) * 100 : currentMonthTotal > 0 ? 100 : 0;
  let trend: MonthlySpendingInsight['trend'] = 'flat';
  let trendTone: MonthlySpendingInsight['trendTone'] = 'neutral';
  if (Math.abs(percentageChange) < 1) {
    trend = 'flat';
    trendTone = 'neutral';
  } else if (percentageChange > 0) {
    trend = 'up';
    trendTone = 'negative';
  } else {
    trend = 'down';
    trendTone = 'positive';
  }

  const trendLabel = `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%`;

  return {
    currentMonthTotal,
    lastMonthTotal,
    difference,
    percentageChange,
    trend,
    trendLabel,
    trendTone,
    currentMonthLabel: monthFormatter.format(startOfCurrent),
    lastMonthLabel: monthFormatter.format(startOfPrevious)
  };
};

export interface CategoryShareInsight {
  category: ExpenseCategory;
  total: number;
  share: number;
}

export const buildCategoryShare = (entries: SpendingEntry[]): CategoryShareInsight | null => {
  if (entries.length === 0) {
    return null;
  }

  const totals = new Map<ExpenseCategory, number>();
  let grandTotal = 0;

  entries.forEach((entry) => {
    const amount = parseAmount(entry.amount);
    if (amount <= 0) {
      return;
    }
    const category = EXPENSE_CATEGORIES.includes(entry.category as ExpenseCategory)
      ? (entry.category as ExpenseCategory)
      : 'Diğer';
    const nextTotal = (totals.get(category) ?? 0) + amount;
    totals.set(category, nextTotal);
    grandTotal += amount;
  });

  if (grandTotal <= 0) {
    return null;
  }

  let topCategory: ExpenseCategory = 'Diğer';
  let topTotal = 0;
  totals.forEach((value, key) => {
    if (value > topTotal) {
      topCategory = key;
      topTotal = value;
    }
  });

  return {
    category: topCategory,
    total: topTotal,
    share: topTotal / grandTotal
  };
};

export interface SuggestionInsight {
  message: string;
  highlight: string;
}

export const buildSuggestion = (entries: SpendingEntry[]): SuggestionInsight | null => {
  const share = buildCategoryShare(entries);
  if (!share) {
    return null;
  }

  const sharePercent = Math.round(share.share * 100);
  const highlight = `${share.category} harcamaları toplamın %${sharePercent}`;
  let message = 'Harcamalarınızı çeşitlendirmek iyi olabilir. Küçük bir değişiklik büyük fark yaratır.';

  if (share.share > 0.4) {
    message = `${share.category} kategorisinde bir hafta boyunca limit koymayı deneyin. Böylece ${formatCurrency(share.total * 0.1)} kadar tasarruf edebilirsiniz.`;
  } else if (share.share > 0.25) {
    message = `${share.category} giderleri bu ay bütçenin önemli bir kısmını kaplıyor. Bir sonraki alışverişte ${formatCurrency(share.total * 0.08)} kenara ayırmayı hedefleyin.`;
  } else {
    message = `${share.category} dengeli gidiyor. Aynı tempoyla devam ederseniz ay sonunda ekstra ${formatCurrency(share.total * 0.05)} birikim mümkün.`;
  }

  return {
    message,
    highlight
  };
};

export const calculateEstimatedGoalDate = (
  netWorth: number,
  goalValue: number,
  weeklyLimit: number,
  weeklySpend: number
): Date | null => {
  const remaining = goalValue - netWorth;
  if (remaining <= 0) {
    return new Date();
  }

  const weeklySavings = Math.max(weeklyLimit - weeklySpend, 0);
  if (weeklySavings <= 0) {
    return null;
  }

  const weeksNeeded = remaining / weeklySavings;
  if (!Number.isFinite(weeksNeeded) || weeksNeeded > 2_000) {
    return null;
  }

  const target = new Date();
  target.setDate(target.getDate() + Math.ceil(weeksNeeded * 7));
  return target;
};

export const buildMotivationMessage = (progress: number): string => {
  if (progress >= 0.7) {
    return 'Hedef neredeyse cebinde 🏆';
  }
  if (progress >= 0.3) {
    return 'İyi ilerliyorsun, temponu koru 🚀';
  }
  return 'Yeni başlıyorsun, disiplinli git 💪';
};

export const formatDate = (date: Date | null): string => {
  if (!date) {
    return '---';
  }
  return date.toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric',
    day: 'numeric'
  });
};

export const formatCurrencyLabel = (value: number): string => formatCurrency(value);

export const buildMonthlyIncomeSummary = (entries: ExtraIncomeEntry[]): number => {
  return entries.reduce((sum, entry) => sum + parseAmount(entry.amount), 0);
};
