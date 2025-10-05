import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ROW_TYPE_OPTIONS,
  UNIT_OPTIONS,
  formatCurrency,
  formatNumber,
  getCreditCardMeta,
  parseAmount,
  useFinanceStore,
  type Entry,
  type RowType,
  type Unit
} from './store';
import './InputPanel.css';

const InputPanel = () => {
  const entries = useFinanceStore((state) => state.entries);
  const totals = useFinanceStore((state) => state.totals);
  const usdRate = useFinanceStore((state) => state.usdRate);
  const updateEntry = useFinanceStore((state) => state.updateEntry);
  const addEntry = useFinanceStore((state) => state.addEntry);
  const removeEntry = useFinanceStore((state) => state.removeEntry);
  const reorderEntries = useFinanceStore((state) => state.reorderEntries);
  const setUsdRate = useFinanceStore((state) => state.setUsdRate);

  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);

  const handleRowChange = useCallback(
    <Key extends keyof Omit<Entry, 'id'>>(id: string, key: Key, value: Entry[Key]) => {
      updateEntry(id, key, value);
    },
    [updateEntry]
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
        reorderEntries(draggedRowId, targetId);
      }
      setDraggedRowId(null);
    },
    [draggedRowId, reorderEntries]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedRowId(null);
  }, []);

  const numericUsdRate = parseAmount(usdRate);

  const convertToTl = useCallback(
    (amount: number, unit: Unit) => {
      if (unit === 'USD') {
        return numericUsdRate > 0 ? amount * numericUsdRate : 0;
      }

      return amount;
    },
    [numericUsdRate]
  );

  const showUsdHint = useMemo(() => {
    const hasUsdEntry = entries.some((entry) => entry.unit === 'USD');
    return hasUsdEntry && numericUsdRate === 0;
  }, [entries, numericUsdRate]);

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
            {entries.map((entry) => {
              const amount = parseAmount(entry.amount);
              const amountInTl = convertToTl(amount, entry.unit);
              const creditCardMeta = getCreditCardMeta(entry.name, amountInTl);

              return (
                <tr
                  key={entry.id}
                  draggable
                  onDragStart={() => handleDragStart(entry.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(entry.id)}
                  onDragEnd={handleDragEnd}
                  className={`input-panel-table__row${draggedRowId === entry.id ? ' input-panel-table__row--dragging' : ''}`}
                >
                  <td>
                    <input
                      className="input-panel-table__input"
                      value={entry.name}
                      onChange={(event) => handleRowChange(entry.id, 'name', event.target.value)}
                      type="text"
                      placeholder="örn. QNB"
                    />
                  </td>
                  <td>
                    <div className="input-panel-table__value">
                      <input
                        className="input-panel-table__input"
                        value={entry.amount}
                        onChange={(event) => handleRowChange(entry.id, 'amount', event.target.value)}
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
                      value={entry.type}
                      onChange={(event) => handleRowChange(entry.id, 'type', event.target.value as RowType)}
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
                      value={entry.unit}
                      onChange={(event) => handleRowChange(entry.id, 'unit', event.target.value as Unit)}
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
                      onClick={() => removeEntry(entry.id)}
                      aria-label={`${entry.name || 'Kalem'} satırını sil`}
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

        <button type="button" className="input-panel-add" onClick={addEntry}>
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
