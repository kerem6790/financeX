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

const GENERAL_ROW_TYPES = ROW_TYPE_OPTIONS.filter((option) => option !== 'Kredi Kartı');

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

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
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

  const handleAddAsset = useCallback(() => {
    addEntry({ type: 'Nakit' });
  }, [addEntry]);

  const handleAddDebt = useCallback(() => {
    addEntry({ type: 'Borç' });
  }, [addEntry]);

  const handleAddCreditCard = useCallback(() => {
    addEntry({ type: 'Kredi Kartı', unit: 'TL', creditLimit: '' });
  }, [addEntry]);

  const handleAddCrypto = useCallback(() => {
    addEntry({ type: 'Kripto', unit: 'USD' });
  }, [addEntry]);

  const convertToTl = useCallback(
    (amount: number, unit: Unit) => {
      if (unit === 'USD') {
        return numericUsdRate > 0 ? amount * numericUsdRate : 0;
      }

      return amount;
    },
    [numericUsdRate]
  );

  const assetsAndReceivables = useMemo(
    () => entries.filter((entry) => entry.type === 'Alacak' || entry.type === 'Nakit'),
    [entries]
  );

  const creditCards = useMemo(
    () => entries.filter((entry) => entry.type === 'Kredi Kartı'),
    [entries]
  );

  const debts = useMemo(
    () => entries.filter((entry) => entry.type === 'Borç'),
    [entries]
  );

  const cryptos = useMemo(
    () => entries.filter((entry) => entry.type === 'Kripto'),
    [entries]
  );

  const showUsdHint = useMemo(() => {
    const hasUsdEntry = entries.some((entry) => entry.unit === 'USD');
    return hasUsdEntry && numericUsdRate === 0;
  }, [entries, numericUsdRate]);

  const renderEntry = useCallback(
    (entry: Entry) => {
      const amount = parseAmount(entry.amount);
      const amountInTl = convertToTl(amount, entry.unit);
      const creditCardMeta = getCreditCardMeta(entry, amountInTl);
      const isDragging = draggedRowId === entry.id;

      return (
        <div
          key={entry.id}
          className={`input-panel-item${isDragging ? ' input-panel-item--dragging' : ''}`}
          draggable
          onDragStart={() => handleDragStart(entry.id)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(entry.id)}
          onDragEnd={handleDragEnd}
        >
          <div className="input-panel-item__row">
            <div className="input-panel-field input-panel-field--grow">
              <label>Kaynak</label>
              <input
                className="input-panel-input"
                value={entry.name}
                onChange={(event) => handleRowChange(entry.id, 'name', event.target.value)}
                placeholder="örn. QNB"
              />
            </div>
            <div className="input-panel-field">
              <label>Tutar</label>
              <input
                className="input-panel-input"
                type="number"
                inputMode="decimal"
                value={entry.amount}
                onChange={(event) => handleRowChange(entry.id, 'amount', event.target.value)}
                placeholder="örn. 15000"
              />
            </div>
          </div>
          <div className="input-panel-item__row input-panel-item__row--secondary">
            <div className="input-panel-field">
              <label>Tür</label>
              <select
                className="input-panel-select"
                value={entry.type}
                onChange={(event) => handleRowChange(entry.id, 'type', event.target.value as RowType)}
              >
                {GENERAL_ROW_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-panel-field">
              <label>Birim</label>
              <select
                className="input-panel-select"
                value={entry.unit}
                onChange={(event) => handleRowChange(entry.id, 'unit', event.target.value as Unit)}
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="input-panel-delete"
              onClick={() => removeEntry(entry.id)}
              aria-label={`${entry.name || 'Kalem'} satırını sil`}
            >
              ×
            </button>
          </div>
          {entry.type === 'Borç' && creditCardMeta ? (
            <div className="input-panel-item__meta">
              {creditCardMeta.issuer} kart borcu: {formatNumber(creditCardMeta.debt)} ₺
            </div>
          ) : null}
        </div>
      );
    },
    [convertToTl, draggedRowId, handleDragEnd, handleDragOver, handleDrop, handleDragStart, handleRowChange, removeEntry]
  );

  const renderCreditCardEntry = useCallback(
    (entry: Entry) => {
      const totalLimit = parseAmount(entry.creditLimit ?? '');
      const availableInTl = convertToTl(parseAmount(entry.amount), entry.unit);
      const meta = getCreditCardMeta(entry, availableInTl);
      const isDragging = draggedRowId === entry.id;

      return (
        <div
          key={entry.id}
          className={`input-panel-item${isDragging ? ' input-panel-item--dragging' : ''}`}
          draggable
          onDragStart={() => handleDragStart(entry.id)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(entry.id)}
          onDragEnd={handleDragEnd}
        >
          <div className="input-panel-item__row">
            <div className="input-panel-field input-panel-field--grow">
              <label>Kart</label>
              <input
                className="input-panel-input"
                value={entry.name}
                onChange={(event) => handleRowChange(entry.id, 'name', event.target.value)}
                placeholder="örn. QNB"
              />
            </div>
            <div className="input-panel-field">
              <label>Toplam Limit</label>
              <input
                className="input-panel-input"
                type="number"
                min="0"
                inputMode="decimal"
                value={entry.creditLimit ?? ''}
                onChange={(event) => handleRowChange(entry.id, 'creditLimit', event.target.value)}
                placeholder="örn. 282000"
              />
            </div>
            <div className="input-panel-field">
              <label>Kullanılabilir Limit</label>
              <input
                className="input-panel-input"
                type="number"
                min="0"
                inputMode="decimal"
                value={entry.amount}
                onChange={(event) => handleRowChange(entry.id, 'amount', event.target.value)}
                placeholder="örn. 150000"
              />
            </div>
          </div>
          <div className="input-panel-item__row input-panel-item__row--secondary">
            <div className="input-panel-field">
              <label>Birim</label>
              <input className="input-panel-input" value="TL" disabled />
            </div>
            <button
              type="button"
              className="input-panel-delete"
              onClick={() => removeEntry(entry.id)}
              aria-label={`${entry.name || 'Kredi kartı'} satırını sil`}
            >
              ×
            </button>
          </div>
          <div className="input-panel-item__meta">
            {meta ? (
              <>
                Kart borcu: {formatCurrency(meta.debt)}
                <span className="text-slate-400"> · Limit {formatCurrency(meta.limit)}</span>
              </>
            ) : totalLimit > 0 ? (
              'Limit ve kullanılabilir tutar girildiğinde borç hesaplanır.'
            ) : (
              'Limit girildiğinde borç otomatik hesaplanır.'
            )}
          </div>
        </div>
      );
    },
    [convertToTl, draggedRowId, handleDragEnd, handleDragOver, handleDrop, handleDragStart, handleRowChange, removeEntry]
  );

  return (
    <div className="input-panel-card">
      <div className="input-panel-layout">
        <div className="input-panel-column">
          <div className="input-panel-section input-panel-section--column">
            <div className="input-panel-section__header">
              <h3>Varlıklar & Alacaklar</h3>
              <span>{assetsAndReceivables.length} kalem</span>
            </div>
            <div className="input-panel-section__body">
              {assetsAndReceivables.length === 0 ? (
                <p className="input-panel-empty">Eklenmiş varlık bulunmuyor.</p>
              ) : (
                assetsAndReceivables.map(renderEntry)
              )}
            </div>
            <div className="input-panel-section__footer">
              <button type="button" className="input-panel-add" onClick={handleAddAsset}>
                + Yeni Kalem
              </button>
            </div>
          </div>
        </div>

        <div className="input-panel-column">
          <div className="input-panel-section input-panel-section--column">
            <div className="input-panel-section__header">
              <h3>Kredi Kartları</h3>
              <span>{creditCards.length} kart</span>
            </div>
            <div className="input-panel-section__body">
              {creditCards.length === 0 ? (
                <p className="input-panel-empty">Henüz kredi kartı eklenmedi.</p>
              ) : (
                creditCards.map(renderCreditCardEntry)
              )}
            </div>
            <div className="input-panel-section__footer">
              <button type="button" className="input-panel-add" onClick={handleAddCreditCard}>
                + Kredi Kartı
              </button>
            </div>
          </div>

          <div className="input-panel-section input-panel-section--column">
            <div className="input-panel-section__header">
              <h3>Diğer Borçlar</h3>
              <span>{debts.length} kalem</span>
            </div>
            <div className="input-panel-section__body">
              {debts.length === 0 ? (
                <p className="input-panel-empty">Henüz borç bilgisi eklenmedi.</p>
              ) : (
                debts.map(renderEntry)
              )}
            </div>
            <div className="input-panel-section__footer">
              <button type="button" className="input-panel-add" onClick={handleAddDebt}>
                + Yeni Borç
              </button>
            </div>
          </div>
        </div>

        <div className="input-panel-column">
          <div className="input-panel-section input-panel-section--column">
            <div className="input-panel-section__header">
              <h3>Kripto (USD)</h3>
              <span>{cryptos.length} kalem</span>
            </div>
            <div className="input-panel-section__body">
              {cryptos.length === 0 ? (
                <p className="input-panel-empty">Henüz kripto varlık eklenmedi.</p>
              ) : (
                cryptos.map(renderEntry)
              )}
            </div>
            <div className="input-panel-section__footer">
              <button type="button" className="input-panel-add" onClick={handleAddCrypto}>
                + Yeni Kalem
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="input-panel-support">
        <div className="input-panel-rate">
          <div className="input-panel-rate__header">
            <h3>USD/TL Kuru</h3>
          </div>
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
            <span className="input-panel-rate__hint">
              USD varlıklarını TL hesaplamalarına dahil etmek için geçerli kuru girin.
            </span>
          </div>
          {showUsdHint ? (
            <p className="input-panel-hint">USD kalemlerinin TL karşılığı için geçerli bir kur girmeniz gerekir.</p>
          ) : null}
        </div>

        <div className="input-panel-summary">
          <div className="input-panel-summary__row">
            <span>Toplam Borç</span>
            <span className="input-panel-summary__value input-panel-summary__value--negative">
              {formatCurrency(totals.debt)}
            </span>
          </div>
          <div className="input-panel-summary__row">
            <span>Toplam Varlık</span>
            <span className="input-panel-summary__value input-panel-summary__value--positive">
              {formatCurrency(totals.assets)}
            </span>
          </div>
          <div className="input-panel-summary__row">
            <span>Net Worth</span>
            <span className="input-panel-summary__value">{formatCurrency(totals.netWorth)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputPanel;
