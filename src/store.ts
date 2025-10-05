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

const createEntry = (overrides?: Partial<Entry>): Entry => ({
  id: generateId(),
  name: '',
  amount: '',
  type: 'Nakit',
  unit: 'TL',
  ...overrides
});

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
  }
}));

useFinanceStore.getState().autoCalculateTotals();
