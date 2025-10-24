import { create } from 'zustand';

export const ROW_TYPE_OPTIONS = ['Borç', 'Kredi Kartı', 'Alacak', 'Nakit', 'Kripto'] as const;
export type RowType = (typeof ROW_TYPE_OPTIONS)[number];

export const UNIT_OPTIONS = ['TL', 'USD'] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

export const EXPENSE_CATEGORIES = ['Barınma', 'Ulaşım', 'Yeme-İçme', 'Eğlence', 'Sağlık', 'Fatura', 'Diğer'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Entry {
  id: string;
  name: string;
  amount: string;
  type: RowType;
  unit: Unit;
  creditLimit?: string;
}

export interface NetWorthSnapshot {
  id: string;
  capturedAt: string;
  value: number;
}

export interface Totals {
  debt: number;
  assets: number;
  netWorth: number;
}

export interface CreditCardMeta {
  issuer: string;
  limit: number;
  debt: number;
}

export interface FixedExpense {
  id: string;
  category: string;
  amount: string;
}

export const CATEGORY_KEYS = ['cards', 'debts', 'crypto', 'assets'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface CategoryPoint {
  id: string;
  capturedAt: string;
  value: number;
}

export type CategoryHistory = Record<CategoryKey, CategoryPoint[]>;

export interface CategoryTotals {
  cards: number;
  debts: number;
  crypto: number;
  assets: number;
}

export interface PlanHistoryPoint {
  id: string;
  capturedAt: string;
  value: number;
}

export interface PlanningMetrics {
  goalValue: number;
  incomeValue: number;
  fixedTotal: number;
  monthlySavingTarget: number;
  flexibleSpending: number;
  weeklyLimit: number;
  remainingGoal: number;
  progressToGoal: number;
  weeklySpend: number;
  weeklyProgress: number;
  planDurationMonths: number;
  plannedCompletionDate: string | null;
  monthlyShortfall: number;
  shortfallRatio: number;
  planFeasible: boolean;
}

const CREDIT_CARD_LIMITS = {
  qnb: { issuer: 'QNB', limit: 282_000 },
  akbank: { issuer: 'Akbank', limit: 31_700 }
} as const;

const TL_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2
});

const NUMBER_FORMATTER = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0
});

const getUnitForType = (type: RowType): Unit => (type === 'Kripto' ? 'USD' : 'TL');

const applyUnitForType = (entry: Entry): Entry => {
  const expectedUnit = getUnitForType(entry.type);
  return entry.unit === expectedUnit ? entry : { ...entry, unit: expectedUnit };
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `row-${Math.random().toString(36).slice(2, 9)}`;
};

const createEntry = (overrides?: Partial<Entry>): Entry => ({
  id: generateId(),
  name: '',
  amount: '',
  type: 'Nakit',
  unit: getUnitForType(overrides?.type ?? 'Nakit'),
  creditLimit: '',
  ...overrides
});

export interface SpendingEntry {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  date: string;
  createdAt: number;
}

const createSpendingEntry = (payload: Omit<SpendingEntry, 'id' | 'createdAt'>): SpendingEntry => ({
  id: generateId(),
  createdAt: Date.now(),
  ...payload
});

const MAX_CATEGORY_HISTORY = 200;
const MAX_PLAN_HISTORY = 400;

const createEmptyCategoryHistory = (): CategoryHistory => ({
  cards: [],
  debts: [],
  crypto: [],
  assets: []
});

const normaliseCategoryPoint = (point: Partial<CategoryPoint>): CategoryPoint => {
  const parsedDate = point.capturedAt ? new Date(point.capturedAt) : new Date();
  const capturedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

  return {
    id: point.id ?? generateId(),
    capturedAt,
    value: Number.isFinite(point.value) ? Number(point.value) : 0
  };
};

const normaliseCategoryHistory = (
  history?: Partial<Record<CategoryKey, Partial<CategoryPoint>[]>>
): CategoryHistory => {
  const result = createEmptyCategoryHistory();

  CATEGORY_KEYS.forEach((key) => {
    const list = history?.[key] ?? [];
    result[key] = list.map((item) => normaliseCategoryPoint(item)).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  });

  return result;
};

const normaliseCategoryTotals = (totals?: Partial<CategoryTotals>): CategoryTotals => ({
  cards: Number.isFinite(totals?.cards) ? Number(totals?.cards) : 0,
  debts: Number.isFinite(totals?.debts) ? Number(totals?.debts) : 0,
  crypto: Number.isFinite(totals?.crypto) ? Number(totals?.crypto) : 0,
  assets: Number.isFinite(totals?.assets) ? Number(totals?.assets) : 0
});

const normalisePlanHistory = (history?: Partial<PlanHistoryPoint>[]): PlanHistoryPoint[] =>
  (history ?? [])
    .map((point) => {
      const parsedDate = point.capturedAt ? new Date(point.capturedAt) : new Date();
      const capturedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      return {
        id: point.id ?? generateId(),
        capturedAt,
        value: Number.isFinite(point.value) ? Number(point.value) : 0
      };
    })
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

export type ExtraIncomeType = 'Gerçekleşen' | 'Tahmini';

export interface ExtraIncomeEntry {
  id: string;
  source: string;
  amount: string;
  type: ExtraIncomeType;
  date: string;
  notes?: string;
  createdAt: number;
}

const createExtraIncomeEntry = (payload: Omit<ExtraIncomeEntry, 'id' | 'createdAt'>): ExtraIncomeEntry => ({
  id: generateId(),
  createdAt: Date.now(),
  ...payload
});

const ensureIsoDate = (value: string): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

const isWithinLastSevenDays = (value: string): boolean => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return diffMs >= 0 && diffMs < sevenDaysMs;
};

const calculateWeeklySpend = (entries: SpendingEntry[]): number =>
  entries.reduce((sum, entry) => sum + (isWithinLastSevenDays(entry.date) ? parseAmount(entry.amount) : 0), 0);

const normaliseSpendingEntry = (entry: Partial<SpendingEntry>): SpendingEntry => {
  const category = EXPENSE_CATEGORIES.includes(entry.category as ExpenseCategory)
    ? (entry.category as ExpenseCategory)
    : 'Diğer';

  return {
    id: entry.id ?? generateId(),
    category,
    description: entry.description ?? '',
    amount: entry.amount ?? '',
    date: ensureIsoDate(entry.date ?? ''),
    createdAt: entry.createdAt ?? Date.now()
  };
};

const normaliseExtraIncomeEntry = (entry: Partial<ExtraIncomeEntry>): ExtraIncomeEntry => {
  const type = (entry.type as ExtraIncomeType) === 'Tahmini' ? 'Tahmini' : 'Gerçekleşen';

  return {
    id: entry.id ?? generateId(),
    source: entry.source ?? '',
    amount: entry.amount ?? '',
    type,
    date: ensureIsoDate(entry.date ?? ''),
    notes: entry.notes ?? '',
    createdAt: entry.createdAt ?? Date.now()
  };
};

const createPlanningExpense = (): FixedExpense => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fx-${Math.random().toString(36).slice(2, 9)}`,
  category: '',
  amount: ''
});

const normaliseSnapshot = (snapshot: Partial<NetWorthSnapshot>): NetWorthSnapshot => {
  const parsedDate = snapshot.capturedAt ? new Date(snapshot.capturedAt) : new Date();
  const capturedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

  const value = Number.isFinite(snapshot.value) ? Number(snapshot.value) : 0;

  return {
    id: snapshot.id ?? generateId(),
    capturedAt,
    value
  };
};

const AVERAGE_WEEKS_PER_MONTH = 4.34524;

const parsePositiveFloat = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const calculatePlanDurationMonths = (
  mode: 'duration' | 'date',
  durationValue: string,
  targetDateValue: string
): { months: number; completionDateIso: string | null } => {
  const now = new Date();

  if (mode === 'duration') {
    const parsed = parsePositiveFloat(durationValue);
    const months = parsed ?? 4;
    const completion = new Date(now);
    completion.setDate(completion.getDate() + Math.max(Math.round(months * 30.4375), 1));
    return { months, completionDateIso: completion.toISOString() };
  }

  if (!targetDateValue) {
    return { months: 4, completionDateIso: null };
  }

  const targetDate = new Date(targetDateValue);
  if (Number.isNaN(targetDate.getTime())) {
    return { months: 4, completionDateIso: null };
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
  const months = diffMonths > 0 ? diffMonths : 1;
  return { months, completionDateIso: targetDate.toISOString() };
};

export const parseAmount = (value: string): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value: number): string => TL_FORMATTER.format(value);

export const formatNumber = (value: number): string => NUMBER_FORMATTER.format(value);

export const getCreditCardMeta = (entry: Entry, availableAmountTl: number): CreditCardMeta | null => {
  const limitFromEntry = parseAmount(entry.creditLimit ?? '');

  if (entry.type === 'Kredi Kartı' && limitFromEntry > 0) {
    return {
      issuer: entry.name || 'Kredi Kartı',
      limit: limitFromEntry,
      debt: Math.max(limitFromEntry - availableAmountTl, 0)
    };
  }

  const normalized = entry.name.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('qnb')) {
    const { issuer, limit } = CREDIT_CARD_LIMITS.qnb;
    return {
      issuer,
      limit,
      debt: Math.max(limit - availableAmountTl, 0)
    };
  }

  if (normalized.includes('akbank')) {
    const { issuer, limit } = CREDIT_CARD_LIMITS.akbank;
    return {
      issuer,
      limit,
      debt: Math.max(limit - availableAmountTl, 0)
    };
  }

  return null;
};

interface FinanceState {
  entries: Entry[];
  totals: Totals;
  usdRate: string;
  snapshots: NetWorthSnapshot[];
  categoryTotals: CategoryTotals;
  categoryHistory: CategoryHistory;
  planHistory: PlanHistoryPoint[];
  updateEntry: <Key extends keyof Omit<Entry, 'id'>>(id: string, key: Key, value: Entry[Key]) => void;
  addEntry: (overrides?: Partial<Entry>) => void;
  removeEntry: (id: string) => void;
  reorderEntries: (fromId: string, toId: string) => void;
  setUsdRate: (value: string) => void;
  autoCalculateTotals: () => void;
  captureSnapshot: () => void;
  setSnapshots: (snapshots: Partial<NetWorthSnapshot>[]) => void;
  removeSnapshot: (id: string) => void;
  restoreSnapshot: (snapshot: NetWorthSnapshot) => void;
  removeCategoryPoint: (category: CategoryKey, pointId: string) => void;
  clearCategoryHistory: (category: CategoryKey) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  entries: [],
  totals: { debt: 0, assets: 0, netWorth: 0 },
  usdRate: '',
  snapshots: [],
  categoryTotals: { cards: 0, debts: 0, crypto: 0, assets: 0 },
  categoryHistory: createEmptyCategoryHistory(),
  planHistory: [],
  updateEntry: (id, key, value) => {
    set((state) => ({
      entries: state.entries.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        if (key === 'type') {
          const nextType = value as RowType;
          return applyUnitForType({ ...entry, type: nextType });
        }

        const updated = { ...entry, [key]: value };
        return applyUnitForType(updated);
      })
    }));
    get().autoCalculateTotals();
  },
  addEntry: (overrides) => {
    set((state) => ({ entries: [...state.entries, applyUnitForType(createEntry(overrides))] }));
    get().autoCalculateTotals();
  },
  removeEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
    get().autoCalculateTotals();
  },
  reorderEntries: (fromId, toId) => {
    set((state) => {
      const entries = [...state.entries];
      const fromIndex = entries.findIndex((entry) => entry.id === fromId);
      const toIndex = entries.findIndex((entry) => entry.id === toId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return { entries };
      }

      const [moved] = entries.splice(fromIndex, 1);
      entries.splice(toIndex, 0, moved);

      return { entries };
    });
    get().autoCalculateTotals();
  },
  setUsdRate: (value) => {
    set({ usdRate: value });
    get().autoCalculateTotals();
  },
  autoCalculateTotals: () => {
    const { entries, usdRate } = get();
    const numericUsdRate = parseAmount(usdRate);

    let debt = 0;
    let assets = 0;
    let cardDebt = 0;
    let otherDebt = 0;
    let cryptoAssets = 0;
    let assetAndReceivables = 0;

    entries.forEach((entry) => {
      const amount = parseAmount(entry.amount);
      const amountInTl = entry.unit === 'USD' && numericUsdRate > 0 ? amount * numericUsdRate : amount;
      const creditCard = getCreditCardMeta(entry, amountInTl);

      if (entry.type === 'Kredi Kartı') {
        const value = creditCard ? creditCard.debt : 0;
        debt += value;
        cardDebt += value;
      } else if (entry.type === 'Borç') {
        const value = creditCard ? creditCard.debt : amountInTl;
        debt += value;
        otherDebt += value;
      } else if (entry.type === 'Alacak' || entry.type === 'Nakit' || entry.type === 'Kripto') {
        assets += amountInTl;
        if (entry.type === 'Kripto') {
          cryptoAssets += amountInTl;
        } else {
          assetAndReceivables += amountInTl;
        }
      }
    });

    const categoryTotals: CategoryTotals = {
      cards: cardDebt,
      debts: otherDebt,
      crypto: cryptoAssets,
      assets: assetAndReceivables
    };

    const nowIso = new Date().toISOString();

    set((state) => {
      const nextHistory: CategoryHistory = {
        cards: state.categoryHistory.cards.slice(),
        debts: state.categoryHistory.debts.slice(),
        crypto: state.categoryHistory.crypto.slice(),
        assets: state.categoryHistory.assets.slice()
      };

      const nextPlanHistory = state.planHistory.slice();
      const currentNetWorth = assets - debt;
      const lastPlanPoint = nextPlanHistory[nextPlanHistory.length - 1];

      if (!lastPlanPoint || Math.abs(lastPlanPoint.value - currentNetWorth) >= 0.01) {
        const point: PlanHistoryPoint = {
          id: generateId(),
          capturedAt: nowIso,
          value: Number(currentNetWorth.toFixed(2))
        };
        nextPlanHistory.push(point);
        if (nextPlanHistory.length > MAX_PLAN_HISTORY) {
          nextPlanHistory.shift();
        }
      }

      const appendPoint = (key: CategoryKey, value: number) => {
        const history = nextHistory[key];
        const lastPoint = history[history.length - 1];
        if (lastPoint && lastPoint.value === value) {
          return;
        }

        const updated = [...history, { id: generateId(), capturedAt: nowIso, value }];
        nextHistory[key] = updated.length > MAX_CATEGORY_HISTORY ? updated.slice(updated.length - MAX_CATEGORY_HISTORY) : updated;
      };

      (Object.entries(categoryTotals) as [CategoryKey, number][]).forEach(([key, value]) => appendPoint(key, value));

      return {
        totals: {
          debt,
          assets,
          netWorth: assets - debt
        },
        categoryTotals,
        categoryHistory: nextHistory,
        planHistory: nextPlanHistory
      };
    });

    triggerPlanningRecalculate();
  },
  captureSnapshot: () => {
    const netWorth = get().totals.netWorth;
    if (!Number.isFinite(netWorth)) {
      return;
    }

    const snapshot = normaliseSnapshot({ value: Number(netWorth) });

    set((state) => ({
      snapshots: [...state.snapshots, snapshot].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    }));
  },
  setSnapshots: (snapshots) => {
    set({
      snapshots: snapshots.map(normaliseSnapshot).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    });
  },
  removeSnapshot: (id) => {
    set((state) => ({ snapshots: state.snapshots.filter((snapshot) => snapshot.id !== id) }));
  },
  restoreSnapshot: (snapshot) => {
    const restored = normaliseSnapshot(snapshot);
    set((state) => ({
      snapshots: [...state.snapshots.filter((item) => item.id !== restored.id), restored].sort((a, b) =>
        a.capturedAt.localeCompare(b.capturedAt)
      )
    }));
  },
  removeCategoryPoint: (category, pointId) => {
    set((state) => ({
      categoryHistory: {
        ...state.categoryHistory,
        [category]: state.categoryHistory[category].filter((point) => point.id !== pointId)
      }
    }));
  },
  clearCategoryHistory: (category) => {
    set((state) => ({
      categoryHistory: {
        ...state.categoryHistory,
        [category]: []
      }
    }));
  }
}));

interface ExpenseState {
  entries: SpendingEntry[];
  addExpense: (payload: Omit<SpendingEntry, 'id' | 'createdAt'>) => void;
  removeExpense: (id: string) => void;
  setEntries: (entries: Partial<SpendingEntry>[]) => void;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  entries: [],
  addExpense: (payload) => {
    const entry = createSpendingEntry({
      ...payload,
      date: ensureIsoDate(payload.date)
    });

    set((state) => ({
      entries: [entry, ...state.entries].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)
      )
    }));

    triggerPlanningRecalculate();
  },
  removeExpense: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
    triggerPlanningRecalculate();
  },
  setEntries: (entries) => {
    const normalised = entries.map(normaliseSpendingEntry).sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)
    );

    set({ entries: normalised });
    triggerPlanningRecalculate();
  }
}));

const emptyMetrics: PlanningMetrics = {
  goalValue: 0,
  incomeValue: 0,
  fixedTotal: 0,
  monthlySavingTarget: 0,
  flexibleSpending: 0,
  weeklyLimit: 0,
  remainingGoal: 0,
  progressToGoal: 0,
  weeklySpend: 0,
  weeklyProgress: 0,
  planDurationMonths: 0,
  plannedCompletionDate: null,
  monthlyShortfall: 0,
  shortfallRatio: 0,
  planFeasible: true
};

interface PlanningState {
  goal: string;
  monthlyIncome: string;
  monthlyIncomeDay: string;
  expenses: FixedExpense[];
  metrics: PlanningMetrics;
  targetMode: 'duration' | 'date';
  targetDurationMonths: string;
  targetDate: string;
  setGoal: (value: string) => void;
  setMonthlyIncome: (value: string) => void;
  setMonthlyIncomeDay: (value: string) => void;
  setTargetMode: (mode: 'duration' | 'date') => void;
  setTargetDurationMonths: (value: string) => void;
  setTargetDate: (value: string) => void;
  addExpense: () => void;
  updateExpense: (id: string, key: keyof Omit<FixedExpense, 'id'>, value: string) => void;
  removeExpense: (id: string) => void;
  recalculate: () => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  goal: '',
  monthlyIncome: '',
  monthlyIncomeDay: '1',
  expenses: [createPlanningExpense()],
  metrics: emptyMetrics,
  targetMode: 'duration',
  targetDurationMonths: '4',
  targetDate: '',
  setGoal: (value) => {
    set({ goal: value });
    get().recalculate();
  },
  setMonthlyIncome: (value) => {
    set({ monthlyIncome: value });
    get().recalculate();
  },
  setMonthlyIncomeDay: (value) => {
    const parsed = Number.parseInt(value, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 31) : 1;
    set({ monthlyIncomeDay: String(clamped) });
  },
  setTargetMode: (mode) => {
    set({ targetMode: mode });
    get().recalculate();
  },
  setTargetDurationMonths: (value) => {
    set({ targetDurationMonths: value });
    get().recalculate();
  },
  setTargetDate: (value) => {
    set({ targetDate: value });
    get().recalculate();
  },
  addExpense: () => {
    set((state) => ({ expenses: [...state.expenses, createPlanningExpense()] }));
    get().recalculate();
  },
  updateExpense: (id, key, value) => {
    set((state) => ({
      expenses: state.expenses.map((expense) => (expense.id === id ? { ...expense, [key]: value } : expense))
    }));
    get().recalculate();
  },
  removeExpense: (id) => {
    set((state) => {
      if (state.expenses.length === 1) {
        return state;
      }

      return {
        expenses: state.expenses.filter((expense) => expense.id !== id)
      };
    });
    get().recalculate();
  },
  recalculate: () => {
    const { goal, monthlyIncome, expenses, targetMode, targetDurationMonths, targetDate } = get();
    const goalValue = parseAmount(goal);
    const incomeValue = parseAmount(monthlyIncome);
    const fixedTotal = expenses.reduce((sum, expense) => sum + parseAmount(expense.amount), 0);
    const planMeta = calculatePlanDurationMonths(targetMode, targetDurationMonths, targetDate);
    const planDurationMonths = planMeta.months;
    const netWorth = useFinanceStore.getState().totals.netWorth;
    const remainingGoalRaw = goalValue - netWorth;
    const remainingGoalForPlan = Math.max(remainingGoalRaw, 0);
    const monthlySavingTarget =
      remainingGoalForPlan > 0 ? (planDurationMonths > 0 ? remainingGoalForPlan / planDurationMonths : remainingGoalForPlan) : 0;
    const flexibleSpending = incomeValue - fixedTotal - monthlySavingTarget;
    const monthlyShortfall = flexibleSpending < 0 ? Math.abs(flexibleSpending) : 0;
    const effectiveFlexible = Math.max(flexibleSpending, 0);
    const weeklyLimit = effectiveFlexible / AVERAGE_WEEKS_PER_MONTH;
    const remainingGoal = remainingGoalRaw;
    const progressRaw = goalValue > 0 ? netWorth / goalValue : 0;
    const progressToGoal = Number.isFinite(progressRaw) ? Math.min(Math.max(progressRaw, 0), 1) : 0;
    const weeklySpend = calculateWeeklySpend(useExpenseStore.getState().entries);
    const weeklyProgressRaw = weeklyLimit > 0 ? weeklySpend / weeklyLimit : 0;
    const weeklyProgress = Number.isFinite(weeklyProgressRaw)
      ? Math.min(Math.max(weeklyProgressRaw, 0), 1)
      : 0;

    set({
      metrics: {
        goalValue,
        incomeValue,
        fixedTotal,
        monthlySavingTarget,
        flexibleSpending,
        weeklyLimit,
        remainingGoal,
        progressToGoal,
        weeklySpend,
        weeklyProgress,
        planDurationMonths,
        plannedCompletionDate: planMeta.completionDateIso,
        monthlyShortfall,
        shortfallRatio:
          incomeValue > 0 ? Math.min(monthlyShortfall / incomeValue, 1) : monthlyShortfall > 0 ? 1 : 0,
        planFeasible: monthlyShortfall === 0
      }
    });
  }
}));

interface ExtraIncomeState {
  entries: ExtraIncomeEntry[];
  addEntry: (payload: Omit<ExtraIncomeEntry, 'id' | 'createdAt'>) => void;
  updateEntry: (id: string, updates: Partial<Omit<ExtraIncomeEntry, 'id' | 'createdAt'>>) => void;
  removeEntry: (id: string) => void;
  setEntries: (entries: Partial<ExtraIncomeEntry>[]) => void;
}

export const useExtraIncomeStore = create<ExtraIncomeState>((set) => ({
  entries: [],
  addEntry: (payload) => {
    const entry = createExtraIncomeEntry({ ...payload, date: ensureIsoDate(payload.date) });
    set((state) => ({
      entries: [entry, ...state.entries].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)
      )
    }));
  },
  updateEntry: (id, updates) => {
    set((state) => ({
      entries: state.entries
        .map((entry) => (entry.id === id ? normaliseExtraIncomeEntry({ ...entry, ...updates }) : entry))
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
    }));
  },
  removeEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
  },
  setEntries: (entries) => {
    const normalised = entries.map(normaliseExtraIncomeEntry).sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)
    );
    set({ entries: normalised });
  }
}));

export interface PersistedFinanceState {
  entries: Entry[];
  usdRate: string;
  snapshots: NetWorthSnapshot[];
  categoryTotals?: CategoryTotals;
  categoryHistory?: Partial<Record<CategoryKey, Partial<CategoryPoint>[]>>;
  planHistory?: Partial<PlanHistoryPoint>[];
}

export interface PersistedPlanningState {
  goal: string;
  monthlyIncome: string;
  monthlyIncomeDay: string;
  expenses: FixedExpense[];
  targetMode: 'duration' | 'date';
  targetDurationMonths: string;
  targetDate: string;
}

export interface PersistedExpenseState {
  entries: SpendingEntry[];
}

export interface PersistedExtraIncomeState {
  entries: ExtraIncomeEntry[];
}

export interface ProjectionEntry {
  id: string;
  source: string;
  amount: string;
  expectedDate: string;
  probability: number;
  note?: string;
  createdAt: number;
}

const normaliseProjectionEntry = (entry: Partial<ProjectionEntry>): ProjectionEntry => ({
  id: entry.id ?? generateId(),
  source: entry.source ?? '',
  amount: entry.amount ?? '',
  expectedDate: ensureIsoDate(entry.expectedDate ?? ''),
  probability: Math.min(Math.max(entry.probability ?? 50, 0), 100),
  note: entry.note ?? '',
  createdAt: entry.createdAt ?? Date.now()
});

interface ProjectionState {
  entries: ProjectionEntry[];
  addProjection: (payload: Omit<ProjectionEntry, 'id' | 'createdAt'>) => void;
  removeProjection: (id: string) => void;
  setEntries: (entries: Partial<ProjectionEntry>[]) => void;
}

export const useProjectionStore = create<ProjectionState>((set) => ({
  entries: [],
  addProjection: (payload) => {
    const entry = normaliseProjectionEntry(payload);
    set((state) => ({
      entries: [entry, ...state.entries].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    }));
  },
  removeProjection: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
  },
  setEntries: (entries) => {
    set({
      entries: entries.map(normaliseProjectionEntry).sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    });
  }
}));

export interface PersistedState {
  finance: PersistedFinanceState;
  planning: PersistedPlanningState;
  expenses: PersistedExpenseState;
  extraIncome: PersistedExtraIncomeState;
  projections: { entries: ProjectionEntry[] };
}

export const getPersistedState = (): PersistedState => ({
  finance: {
    entries: useFinanceStore.getState().entries,
    usdRate: useFinanceStore.getState().usdRate,
    snapshots: useFinanceStore.getState().snapshots,
    categoryTotals: useFinanceStore.getState().categoryTotals,
    categoryHistory: useFinanceStore.getState().categoryHistory,
    planHistory: useFinanceStore.getState().planHistory
  },
  planning: {
    goal: usePlanningStore.getState().goal,
    monthlyIncome: usePlanningStore.getState().monthlyIncome,
    monthlyIncomeDay: usePlanningStore.getState().monthlyIncomeDay,
    expenses: usePlanningStore.getState().expenses,
    targetMode: usePlanningStore.getState().targetMode,
    targetDurationMonths: usePlanningStore.getState().targetDurationMonths,
    targetDate: usePlanningStore.getState().targetDate
  },
  expenses: {
    entries: useExpenseStore.getState().entries
  },
  extraIncome: {
    entries: useExtraIncomeStore.getState().entries
  },
  projections: {
    entries: useProjectionStore.getState().entries
  }
});

export const hydrateFromPersistedState = (persisted: Partial<PersistedState>) => {
  const finance = persisted.finance;
  if (finance) {
    useFinanceStore.setState((state) => {
      const nextEntries =
        finance.entries !== undefined
          ? finance.entries.map((entry) => applyUnitForType({ ...entry }))
          : state.entries.map((entry) => applyUnitForType({ ...entry }));

      const nextSnapshots =
        finance.snapshots !== undefined
          ? finance.snapshots.map(normaliseSnapshot).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
          : state.snapshots;

      const nextCategoryHistory =
        finance.categoryHistory !== undefined ? normaliseCategoryHistory(finance.categoryHistory) : state.categoryHistory;

      const nextCategoryTotals =
        finance.categoryTotals !== undefined ? normaliseCategoryTotals(finance.categoryTotals) : state.categoryTotals;

      const nextPlanHistory =
        finance.planHistory !== undefined ? normalisePlanHistory(finance.planHistory) : state.planHistory;

      return {
        entries: nextEntries,
        usdRate: finance.usdRate ?? state.usdRate,
        snapshots: nextSnapshots,
        categoryHistory: nextCategoryHistory,
        categoryTotals: nextCategoryTotals,
        planHistory: nextPlanHistory
      };
    });
  }

  const expenses = persisted.expenses;
  if (expenses) {
    useExpenseStore.getState().setEntries(expenses.entries ?? []);
  }

  const planning = persisted.planning;
  if (planning) {
    usePlanningStore.setState(() => ({
      goal: planning.goal ?? '',
      monthlyIncome: planning.monthlyIncome ?? '',
      monthlyIncomeDay: planning.monthlyIncomeDay ?? '1',
      expenses:
        planning.expenses && planning.expenses.length > 0
          ? planning.expenses
          : [createPlanningExpense()],
      targetMode: planning.targetMode ?? 'duration',
      targetDurationMonths: planning.targetDurationMonths ?? '4',
      targetDate: planning.targetDate ?? ''
    }));
  }

  const extraIncome = persisted.extraIncome;
  if (extraIncome) {
    useExtraIncomeStore.getState().setEntries(extraIncome.entries ?? []);
  }

  const projections = persisted.projections;
  if (projections) {
    useProjectionStore.getState().setEntries(projections.entries ?? []);
  }

  useFinanceStore.getState().autoCalculateTotals();
  usePlanningStore.getState().recalculate();
};

function triggerPlanningRecalculate() {
  try {
    const recalculate = usePlanningStore.getState().recalculate;
    recalculate();
  } catch (error) {
    // Planning store might not be initialised yet; ignore.
  }
}

useFinanceStore.getState().autoCalculateTotals();
usePlanningStore.getState().recalculate();
