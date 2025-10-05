import { create } from 'zustand';

export const ROW_TYPE_OPTIONS = ['Borç', 'Alacak', 'Nakit', 'Kripto'] as const;
export type RowType = (typeof ROW_TYPE_OPTIONS)[number];

export const UNIT_OPTIONS = ['TL', 'USD'] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

export interface Entry {
  id: string;
  name: string;
  amount: string;
  type: RowType;
  unit: Unit;
}

export interface Totals {
  debt: number;
  assets: number;
  netWorth: number;
}

export interface CreditCardMeta {
  issuer: 'QNB' | 'Akbank';
  limit: number;
  debt: number;
}

export interface FixedExpense {
  id: string;
  category: string;
  amount: string;
}

export interface PlanningMetrics {
  goalValue: number;
  incomeValue: number;
  fixedTotal: number;
  savingsQuarter: number;
  flexibleSpending: number;
  weeklyLimit: number;
  remainingGoal: number;
  progressToGoal: number;
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
  unit: 'TL',
  ...overrides
});

const createPlanningExpense = (): FixedExpense => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fx-${Math.random().toString(36).slice(2, 9)}`,
  category: '',
  amount: ''
});

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

export const getCreditCardMeta = (name: string, availableAmountTl: number): CreditCardMeta | null => {
  const normalized = name.trim().toLowerCase();

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
  updateEntry: <Key extends keyof Omit<Entry, 'id'>>(id: string, key: Key, value: Entry[Key]) => void;
  addEntry: () => void;
  removeEntry: (id: string) => void;
  reorderEntries: (fromId: string, toId: string) => void;
  setUsdRate: (value: string) => void;
  autoCalculateTotals: () => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  entries: [
    createEntry({ name: 'QNB', type: 'Borç', unit: 'TL' }),
    createEntry({ name: 'Akbank', type: 'Borç', unit: 'TL' })
  ],
  totals: { debt: 0, assets: 0, netWorth: 0 },
  usdRate: '',
  updateEntry: (id, key, value) => {
    set((state) => ({
      entries: state.entries.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry))
    }));
    get().autoCalculateTotals();
  },
  addEntry: () => {
    set((state) => ({ entries: [...state.entries, createEntry()] }));
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

    entries.forEach((entry) => {
      const amount = parseAmount(entry.amount);
      const amountInTl = entry.unit === 'USD' && numericUsdRate > 0 ? amount * numericUsdRate : amount;
      const creditCard = getCreditCardMeta(entry.name, amountInTl);

      if (entry.type === 'Borç') {
        debt += creditCard ? creditCard.debt : amountInTl;
      } else if (entry.type === 'Alacak' || entry.type === 'Nakit' || entry.type === 'Kripto') {
        assets += amountInTl;
      }
    });

    set({
      totals: {
        debt,
        assets,
        netWorth: assets - debt
      }
    });

    triggerPlanningRecalculate();
  }
}));

const emptyMetrics: PlanningMetrics = {
  goalValue: 0,
  incomeValue: 0,
  fixedTotal: 0,
  savingsQuarter: 0,
  flexibleSpending: 0,
  weeklyLimit: 0,
  remainingGoal: 0,
  progressToGoal: 0
};

interface PlanningState {
  goal: string;
  monthlyIncome: string;
  expenses: FixedExpense[];
  metrics: PlanningMetrics;
  setGoal: (value: string) => void;
  setMonthlyIncome: (value: string) => void;
  addExpense: () => void;
  updateExpense: (id: string, key: keyof Omit<FixedExpense, 'id'>, value: string) => void;
  removeExpense: (id: string) => void;
  recalculate: () => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  goal: '',
  monthlyIncome: '',
  expenses: [createPlanningExpense()],
  metrics: emptyMetrics,
  setGoal: (value) => {
    set({ goal: value });
    get().recalculate();
  },
  setMonthlyIncome: (value) => {
    set({ monthlyIncome: value });
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
    const { goal, monthlyIncome, expenses } = get();
    const goalValue = parseAmount(goal);
    const incomeValue = parseAmount(monthlyIncome);
    const fixedTotal = expenses.reduce((sum, expense) => sum + parseAmount(expense.amount), 0);
    const savingsQuarter = goalValue / 4;
    const flexibleSpending = incomeValue - fixedTotal - savingsQuarter;
    const weeklyLimit = flexibleSpending / 4;
    const netWorth = useFinanceStore.getState().totals.netWorth;
    const remainingGoal = goalValue - netWorth;
    const progressRaw = goalValue > 0 ? netWorth / goalValue : 0;
    const progressToGoal = Number.isFinite(progressRaw) ? Math.min(Math.max(progressRaw, 0), 1) : 0;

    set({
      metrics: {
        goalValue,
        incomeValue,
        fixedTotal,
        savingsQuarter,
        flexibleSpending,
        weeklyLimit,
        remainingGoal,
        progressToGoal
      }
    });
  }
}));

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
