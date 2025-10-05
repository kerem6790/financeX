import { formatCurrency, parseAmount, SpendingEntry, ExtraIncomeEntry, EXPENSE_CATEGORIES, type ExpenseCategory } from './store';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  day: 'numeric'
});

const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric'
});

export interface TrendPoint {
  label: string;
  value: number;
  date: Date;
}

export const buildNetWorthTrend = (
  currentNetWorth: number,
  weeklyLimit: number,
  weeklySpend: number
): TrendPoint[] => {
  const base = Math.max(currentNetWorth, 0);
  const effectiveWeeklyGrowth = Math.max(weeklyLimit - weeklySpend, base * 0.005);
  const today = new Date();
  const points: TrendPoint[] = [];

  // generate 7 weeks prior + current week (total 8 points)
  for (let idx = 7; idx >= 0; idx -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - (7 - idx) * 7);

    const variation = Math.sin((idx + 1) / 2) * 0.35;
    const projected = base - effectiveWeeklyGrowth * (7 - idx) + effectiveWeeklyGrowth * variation * (idx / 7);
    const value = idx === 7 ? base : Math.max(projected, base * 0.35);

    points.push({
      label: dateFormatter.format(date),
      value,
      date
    });
  }

  return points;
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
