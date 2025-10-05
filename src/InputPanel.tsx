import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import './InputPanel.css';

const CREDIT_CARD_LIMITS = {
  qnb: 282_000,
  akbank: 31_700
} as const;

type RowType = 'Borç' | 'Alacak' | 'Nakit' | 'Kripto';

type Unit = 'TL' | 'USD';

interface FinanceRow {
  id: string;
  name: string;
  amount: string;
  type: RowType;
  unit: Unit;
}

interface CreditCardMeta {
  issuer: 'QNB' | 'Akbank';
  limit: number;
  debt: number;
}

const ROW_TYPE_OPTIONS: RowType[] = ['Borç', 'Alacak', 'Nakit', 'Kripto'];
const UNIT_OPTIONS: Unit[] = ['TL', 'USD'];

const TL_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2
});

const NUMBER_FORMATTER = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0
});

const parseAmount = (value: string): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number): string => TL_FORMATTER.format(value);

const formatNumber = (value: number): string => NUMBER_FORMATTER.format(value);

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `row-${Math.random().toString(36).slice(2, 9)}`;
};

const createRow = (overrides?: Partial<FinanceRow>): FinanceRow => ({
  id: generateId(),
  name: '',
  amount: '',
  type: 'Nakit',
  unit: 'TL',
  ...overrides
});

const getCreditCardMeta = (name: string, availableAmountTl: number): CreditCardMeta | null => {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('qnb')) {
    const limit = CREDIT_CARD_LIMITS.qnb;
    return {
      issuer: 'QNB',
      limit,
      debt: Math.max(limit - availableAmountTl, 0)
    };
  }

  if (normalized.includes('akbank')) {
    const limit = CREDIT_CARD_LIMITS.akbank;
    return {
      issuer: 'Akbank',
      limit,
      debt: Math.max(limit - availableAmountTl, 0)
    };
  }

  return null;
};

const InputPanel = () => {
  const [rows, setRows] = useState<FinanceRow[]>([
    createRow({ name: 'QNB', type: 'Borç', unit: 'TL' }),
    createRow({ name: 'Akbank', type: 'Borç', unit: 'TL' })
  ]);
  const [usdRate, setUsdRate] = useState<string>('');
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);

  const handleRowChange = <Key extends keyof FinanceRow>(id: string, key: Key, value: FinanceRow[Key]) => {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () => {
    setRows((previous) => [...previous, createRow({ type: 'Nakit', unit: 'TL' })]);
  };

  const convertToTl = useCallback(
    (amount: number, unit: Unit) => {
      if (unit === 'USD') {
        const parsedRate = parseAmount(usdRate);
        return parsedRate > 0 ? amount * parsedRate : 0;
      }

      return amount;
    },
    [usdRate]
  );

  const removeRow = useCallback((id: string) => {
    setRows((previous) => previous.filter((row) => row.id !== id));
  }, []);

  const moveRow = useCallback(
    (fromId: string, toId: string) => {
      setRows((previous) => {
        const fromIndex = previous.findIndex((row) => row.id === fromId);
        const toIndex = previous.findIndex((row) => row.id === toId);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return previous;
        }

        const updated = [...previous];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        return updated;
      });
    },
    []
  );

  const handleDragStart = useCallback((id: string) => {
    setDraggedRowId(id);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (draggedRowId) {
        moveRow(draggedRowId, targetId);
      }
      setDraggedRowId(null);
    },
    [draggedRowId, moveRow]
  );

  const numericUsdRate = parseAmount(usdRate);

  const totals = useMemo(() => {
    let totalDebt = 0;
    let totalAssets = 0;

    rows.forEach((row) => {
      const amount = parseAmount(row.amount);
      const amountInTl = convertToTl(amount, row.unit);
      const creditCard = getCreditCardMeta(row.name, amountInTl);

      if (row.type === 'Borç') {
        if (creditCard) {
          totalDebt += creditCard.debt;
        } else {
          totalDebt += amountInTl;
        }
      } else if (row.type === 'Alacak' || row.type === 'Nakit' || row.type === 'Kripto') {
        totalAssets += amountInTl;
      }
    });

    return {
      debt: totalDebt,
      assets: totalAssets,
      netWorth: totalAssets - totalDebt
    };
  }, [convertToTl, rows]);

  const showUsdHint = useMemo(() => {
    const containsUsdRow = rows.some((row) => row.unit === 'USD');
    return containsUsdRow && numericUsdRate === 0;
  }, [rows, numericUsdRate]);

  return (
    <div className="input-panel-card">
      <div className="input-panel-card__inner">
        <div className="input-panel-rate">
          <div className="input-panel-rate__label">USD/TL kuru</div>
          <div className="input-panel-rate__control">
            <input
              className="input-panel-rate__input"
              type="number"
              step="0.0001"
              min="0"
              placeholder="örn. 33.45"
              value={usdRate}
              onChange={(event) => setUsdRate(event.target.value)}
            />
            <span className="input-panel-rate__hint">USD içeriklerin TL hesaba katılması için kuru manuel girin.</span>
          </div>
        </div>

        <table className="input-panel-table">
          <thead>
            <tr>
              <th>Kalem</th>
              <th>Tutar</th>
              <th>Tür</th>
              <th>Birim</th>
              <th className="input-panel-table__th--actions" aria-label="İşlemler" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const amount = parseAmount(row.amount);
              const amountInTl = convertToTl(amount, row.unit);
              const creditCardMeta = getCreditCardMeta(row.name, amountInTl);

              return (
                <tr
                  key={row.id}
                  draggable
                  onDragStart={() => handleDragStart(row.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(row.id)}
                  className={`input-panel-table__row${draggedRowId === row.id ? ' input-panel-table__row--dragging' : ''}`}
                >
                  <td>
                    <input
                      className="input-panel-table__input"
                      value={row.name}
                      onChange={(event) => handleRowChange(row.id, 'name', event.target.value)}
                      type="text"
                      placeholder="örn. QNB"
                    />
                  </td>
                  <td>
                    <div className="input-panel-table__value">
                      <input
                        className="input-panel-table__input"
                        value={row.amount}
                        onChange={(event) => handleRowChange(row.id, 'amount', event.target.value)}
                        type="number"
                        step="any"
                        placeholder="örn. 15000"
                      />
                      {creditCardMeta ? (
                        <span className="input-panel-table__credit-info">
                          {creditCardMeta.issuer} kredi kartı borcu: {formatNumber(creditCardMeta.debt)} TL
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <select
                      className="input-panel-table__select"
                      value={row.type}
                      onChange={(event) => handleRowChange(row.id, 'type', event.target.value as RowType)}
                    >
                      {ROW_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input-panel-table__select input-panel-table__select--unit"
                      value={row.unit}
                      onChange={(event) => handleRowChange(row.id, 'unit', event.target.value as Unit)}
                    >
                      {UNIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="input-panel-table__actions">
                    <button
                      type="button"
                      className="input-panel-table__delete"
                      onClick={() => removeRow(row.id)}
                      aria-label={`${row.name || 'Kalem'} satırını sil`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <span className="input-panel-hint">Satırları sürükleyerek sıralayabilir, gereksiz satırları silebilirsiniz.</span>

        <button type="button" className="input-panel-add" onClick={addRow}>
          + Yeni Kalem Ekle
        </button>
      </div>

      <div className="input-panel-totals">
        <div className="input-panel-totals__card">
          <div className="input-panel-totals__row">
            <span className="input-panel-totals__label">Toplam Borç</span>
            <span className="input-panel-totals__value">{formatCurrency(totals.debt)}</span>
          </div>
          <div className="input-panel-totals__row">
            <span className="input-panel-totals__label">Toplam Varlık</span>
            <span className="input-panel-totals__value">{formatCurrency(totals.assets)}</span>
          </div>
          <div className="input-panel-totals__row input-panel-totals__row--net">
            <span className="input-panel-totals__label">Net Worth</span>
            <span
              className={`input-panel-totals__value input-panel-totals__value--${
                totals.netWorth >= 0 ? 'positive' : 'negative'
              }`}
            >
              {formatCurrency(totals.netWorth)}
            </span>
          </div>
          {showUsdHint ? (
            <span className="input-panel-totals__hint">
              USD kalemlerinin TL karşılığı için geçerli bir kur girmeniz gerekir.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default InputPanel;
