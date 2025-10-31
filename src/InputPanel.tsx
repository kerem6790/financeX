import type { DragEvent } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ROW_TYPE_OPTIONS,
  formatCurrency,
  getCreditCardMeta,
  parseAmount,
  useFinanceStore,
  type Entry,
  type CategoryPoint,
  type RowType,
  type Unit
} from './store';
import './InputPanel.css';
import CategoryChart from './CategoryChart';

const GENERAL_ROW_TYPES = ROW_TYPE_OPTIONS.filter((option) => option !== 'Kredi Kartı');
const UNIT_BADGE_BY_TYPE: Record<RowType, Unit> = {
  Borç: 'TL',
  'Kredi Kartı': 'TL',
  Alacak: 'TL',
  Nakit: 'TL',
  Kripto: 'USD'
};

type SectionKey = 'assets' | 'cards' | 'debts' | 'crypto';

type EntryDraft = {
  name: string;
  amount: string;
  type: RowType;
  unit: Unit;
  creditLimit: string;
};

const createEmptyDraft = (): EntryDraft => ({
  name: '',
  amount: '',
  type: 'Nakit',
  unit: 'TL',
  creditLimit: ''
});

const createDraftFromEntry = (entry: Entry): EntryDraft => ({
  name: entry.name,
  amount: entry.amount,
  type: entry.type,
  unit: entry.unit,
  creditLimit: entry.creditLimit ?? ''
});

const areEntryAndDraftEqual = (entry: Entry, draft: EntryDraft): boolean => {
  const creditLimitActual = entry.creditLimit ?? '';
  return (
    entry.name === draft.name &&
    entry.amount === draft.amount &&
    entry.type === draft.type &&
    entry.unit === draft.unit &&
    creditLimitActual === draft.creditLimit
  );
};

const InputPanel = () => {
  const entries = useFinanceStore((state) => state.entries);
  const totals = useFinanceStore((state) => state.totals);
  const usdRate = useFinanceStore((state) => state.usdRate);
  const categoryHistory = useFinanceStore((state) => state.categoryHistory);
  const removeCategoryPoint = useFinanceStore((state) => state.removeCategoryPoint);
  const clearCategoryHistory = useFinanceStore((state) => state.clearCategoryHistory);
  const applyEntryUpdates = useFinanceStore((state) => state.applyEntryUpdates);
  const addEntry = useFinanceStore((state) => state.addEntry);
  const removeEntry = useFinanceStore((state) => state.removeEntry);
  const reorderEntries = useFinanceStore((state) => state.reorderEntries);
  const setUsdRate = useFinanceStore((state) => state.setUsdRate);

  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    assets: false,
    cards: false,
    debts: false,
    crypto: false
  });
  const [activeChartSection, setActiveChartSection] = useState<SectionKey | null>(null);

  const [draftEntries, setDraftEntries] = useState<Record<string, EntryDraft>>({});

  useEffect(() => {
    setDraftEntries((previous) => {
      const next: Record<string, EntryDraft> = {};
      entries.forEach((entry) => {
        const existing = previous[entry.id];
        if (!existing) {
          next[entry.id] = createDraftFromEntry(entry);
          return;
        }

        next[entry.id] = areEntryAndDraftEqual(entry, existing) ? createDraftFromEntry(entry) : existing;
      });
      return next;
    });
  }, [entries]);

  const handleDraftChange = useCallback(
    <Key extends keyof EntryDraft>(id: string, key: Key, value: EntryDraft[Key]) => {
      setDraftEntries((previous) => {
        const sourceEntry = entries.find((item) => item.id === id);
        const base = previous[id] ?? (sourceEntry ? createDraftFromEntry(sourceEntry) : createEmptyDraft());

        let nextDraft: EntryDraft = { ...base, [key]: value };

        if (key === 'type') {
          const nextType = value as RowType;
          nextDraft = {
            ...nextDraft,
            type: nextType,
            unit: UNIT_BADGE_BY_TYPE[nextType]
          };
        }

        return { ...previous, [id]: nextDraft };
      });
    },
    [entries]
  );

  const handleSaveEntry = useCallback(
    (id: string) => {
      const source = entries.find((item) => item.id === id);
      const draft = draftEntries[id];
      if (!source || !draft || areEntryAndDraftEqual(source, draft)) {
        return;
      }

      const updates: Partial<Entry> = {};

      if (draft.name !== source.name) {
        updates.name = draft.name;
      }
      if (draft.amount !== source.amount) {
        updates.amount = draft.amount;
      }
      if (draft.type !== source.type) {
        updates.type = draft.type;
      }
      if (draft.unit !== source.unit) {
        updates.unit = draft.unit;
      }

      if (source.type === 'Kredi Kartı') {
        const currentCredit = source.creditLimit ?? '';
        if (draft.type !== 'Kredi Kartı') {
          updates.creditLimit = '';
        } else if (draft.creditLimit !== currentCredit) {
          updates.creditLimit = draft.creditLimit;
        }
      }

      applyEntryUpdates(id, updates);
    },
    [applyEntryUpdates, draftEntries, entries]
  );

  const handleDragStart = useCallback((id: string) => {
    setDraggedRowId(id);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
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

  const toggleSection = useCallback((section: SectionKey) => {
    setCollapsedSections((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);
  const openChart = useCallback((section: SectionKey) => {
    setActiveChartSection(section);
  }, []);

  const closeChart = useCallback(() => {
    setActiveChartSection(null);
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

  const isAssetsCollapsed = collapsedSections.assets;
  const isCardsCollapsed = collapsedSections.cards;
  const isDebtsCollapsed = collapsedSections.debts;
  const isCryptoCollapsed = collapsedSections.crypto;
  const activeChartHistory = activeChartSection ? categoryHistory[activeChartSection] : [];
  const CHART_META: Record<SectionKey, { label: string; color: string; description: string }> = {
    assets: {
      label: 'Varlıklar & Alacaklar',
      color: '#0ea5e9',
      description: 'Nakit ve alacak kalemlerinizin TL karşılığı bu grafikte takip edilir.'
    },
    cards: {
      label: 'Kredi Kartları',
      color: '#f97316',
      description: 'Kredi kartı borçlarınız (limit - kullanılabilir tutar) otomatik izlenir.'
    },
    debts: {
      label: 'Diğer Borçlar',
      color: '#e11d48',
      description: 'Kart dışındaki borç kalemlerinin toplamı.'
    },
    crypto: {
      label: 'Kripto Varlıklar',
      color: '#10b981',
      description: 'Kripto varlıklarınızın TL karşılığı (girilen USD kuru üzerinden) kayıt altına alınır.'
    }
  };

  const renderGeneralEntry = useCallback(
    (entry: Entry, colSpan: number, amountLabel: string, amountPlaceholder: string) => {
      const draft = draftEntries[entry.id] ?? createDraftFromEntry(entry);
      const preview: Entry = { ...entry, ...draft };
      const amount = parseAmount(draft.amount);
      const amountInTl = convertToTl(amount, draft.unit);
      const creditCardMeta = getCreditCardMeta(preview, amountInTl);
      const isDragging = draggedRowId === entry.id;
      const isDirty = !areEntryAndDraftEqual(entry, draft);
      const showDebtHint = draft.type === 'Borç' && creditCardMeta !== null;
      const badgeLabel = UNIT_BADGE_BY_TYPE[draft.type];
      const rowClassName = `input-table__row${isDragging ? ' input-table__row--dragging' : ''}${isDirty ? ' input-table__row--dirty' : ''}`;

      return (
        <Fragment key={entry.id}>
          <tr
            className={rowClassName}
            draggable
            onDragStart={() => handleDragStart(entry.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(entry.id)}
            onDragEnd={handleDragEnd}
          >
            <td className="input-table__cell-wrapper input-table__cell-wrapper--grow">
              <input
                className="input-table__cell input-table__cell--grow"
                value={draft.name}
                onChange={(event) => handleDraftChange(entry.id, 'name', event.target.value)}
                placeholder="örn. QNB"
                aria-label="Kaynak"
              />
            </td>
            <td className="input-table__cell-wrapper">
              <div className="input-table__input-group">
                <input
                  className="input-table__cell input-table__cell--number"
                  type="number"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => handleDraftChange(entry.id, 'amount', event.target.value)}
                  placeholder={amountPlaceholder}
                  aria-label={amountLabel}
                />
                <span className="input-table__badge">{badgeLabel}</span>
              </div>
            </td>
            <td className="input-table__cell-wrapper">
              <select
                className="input-table__cell"
                value={draft.type}
                onChange={(event) => handleDraftChange(entry.id, 'type', event.target.value as RowType)}
                aria-label="Tür"
              >
                {GENERAL_ROW_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </td>
            <td className="input-table__actions">
              <div className="input-table__action-buttons">
                <button
                  type="button"
                  className="input-table__save"
                  onClick={() => handleSaveEntry(entry.id)}
                  disabled={!isDirty}
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  className="input-table__delete"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${entry.name || 'Kalem'} satırını sil`}
                >
                  ×
                </button>
              </div>
            </td>
          </tr>
          {showDebtHint ? (
            <tr className="input-table__meta-row">
              <td colSpan={colSpan} className="input-table__meta input-table__meta--warning">
                Tanınan limit borcu: {formatCurrency(creditCardMeta!.debt)}
              </td>
            </tr>
          ) : null}
        </Fragment>
      );
    },
    [
      convertToTl,
      draggedRowId,
      draftEntries,
      handleDraftChange,
      handleDragEnd,
      handleDragOver,
      handleDrop,
      handleDragStart,
      handleSaveEntry,
      removeEntry
    ]
  );

  const renderCreditCardEntry = useCallback(
    (entry: Entry, colSpan: number) => {
      const draft = draftEntries[entry.id] ?? createDraftFromEntry(entry);
      const preview: Entry = { ...entry, ...draft };
      const totalLimit = parseAmount(draft.creditLimit);
      const availableInTl = convertToTl(parseAmount(draft.amount), draft.unit);
      const meta = getCreditCardMeta(preview, availableInTl);
      const isDragging = draggedRowId === entry.id;
      const isDirty = !areEntryAndDraftEqual(entry, draft);
      const badgeLabel = UNIT_BADGE_BY_TYPE[draft.type];
      const rowClassName = `input-table__row${isDragging ? ' input-table__row--dragging' : ''}${isDirty ? ' input-table__row--dirty' : ''}`;

      const metaContent = meta ? (
        <>
          Kart borcu: {formatCurrency(meta.debt)}
          <span className="input-table__meta-divider"> · Limit {formatCurrency(meta.limit)}</span>
        </>
      ) : totalLimit > 0 ? (
        'Limit ve kullanılabilir tutar girildiğinde borç hesaplanır.'
      ) : (
        'Limit girildiğinde borç otomatik hesaplanır.'
      );

      return (
        <Fragment key={entry.id}>
          <tr
            className={rowClassName}
            draggable
            onDragStart={() => handleDragStart(entry.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(entry.id)}
            onDragEnd={handleDragEnd}
          >
            <td className="input-table__cell-wrapper input-table__cell-wrapper--grow">
              <input
                className="input-table__cell input-table__cell--grow"
                value={draft.name}
                onChange={(event) => handleDraftChange(entry.id, 'name', event.target.value)}
                placeholder="örn. QNB"
                aria-label="Kart"
              />
            </td>
            <td className="input-table__cell-wrapper">
              <div className="input-table__input-group">
                <input
                  className="input-table__cell input-table__cell--number"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={draft.creditLimit}
                  onChange={(event) => handleDraftChange(entry.id, 'creditLimit', event.target.value)}
                  placeholder="örn. 282000"
                  aria-label="Toplam Limit"
                />
                <span className="input-table__badge">{badgeLabel}</span>
              </div>
            </td>
            <td className="input-table__cell-wrapper">
              <div className="input-table__input-group">
                <input
                  className="input-table__cell input-table__cell--number"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => handleDraftChange(entry.id, 'amount', event.target.value)}
                  placeholder="örn. 150000"
                  aria-label="Kullanılabilir Limit"
                />
                <span className="input-table__badge">{badgeLabel}</span>
              </div>
            </td>
            <td className="input-table__actions">
              <div className="input-table__action-buttons">
                <button
                  type="button"
                  className="input-table__save"
                  onClick={() => handleSaveEntry(entry.id)}
                  disabled={!isDirty}
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  className="input-table__delete"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${entry.name || 'Kredi kartı'} satırını sil`}
                >
                  ×
                </button>
              </div>
            </td>
          </tr>
          <tr className="input-table__meta-row">
            <td colSpan={colSpan} className="input-table__meta">
              {metaContent}
            </td>
          </tr>
        </Fragment>
      );
    },
    [convertToTl, draftEntries, draggedRowId, handleDraftChange, handleDragEnd, handleDragOver, handleDrop, handleDragStart, handleSaveEntry, removeEntry]
  );

  const generalColSpan = 4;
  const creditCardColSpan = 4;

  return (
    <>
      <div className="input-panel-card">
        <div className="finance-grid">
          <section className={`finance-table-card${isAssetsCollapsed ? ' finance-table-card--collapsed' : ''}`}>
          <div className="finance-table-card__header">
            <div className="finance-table-card__title-group">
              <span className="finance-table-card__title">Varlıklar &amp; Alacaklar</span>
              <span className="finance-table-card__count">{assetsAndReceivables.length} satır</span>
            </div>
            <div className="finance-table-card__controls">
              <button type="button" className="finance-table__chart" onClick={() => openChart('assets')}>
                Grafiği Aç
              </button>
              <button
                type="button"
                className="finance-table__toggle"
                onClick={() => toggleSection('assets')}
                aria-expanded={!isAssetsCollapsed}
                aria-controls="finance-table-assets"
              >
                {isAssetsCollapsed ? 'Göster' : 'Daralt'}
              </button>
              <button type="button" className="finance-table__add" onClick={handleAddAsset}>
                + Yeni Kalem
              </button>
            </div>
          </div>
          <table className="input-table" id="finance-table-assets" hidden={isAssetsCollapsed}>
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Tutar</th>
                <th>Tür</th>
                <th className="input-table__actions-header">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {assetsAndReceivables.length === 0 ? (
                <tr className="input-table__empty-row">
                  <td colSpan={generalColSpan}>Eklenmiş varlık bulunmuyor.</td>
                </tr>
              ) : (
                assetsAndReceivables.map((entry) => renderGeneralEntry(entry, generalColSpan, 'Tutar', 'örn. 15000'))
              )}
            </tbody>
          </table>
        </section>

        <section className={`finance-table-card${isCardsCollapsed ? ' finance-table-card--collapsed' : ''}`}>
          <div className="finance-table-card__header">
            <div className="finance-table-card__title-group">
              <span className="finance-table-card__title">Kredi Kartları</span>
              <span className="finance-table-card__count">{creditCards.length} satır</span>
            </div>
            <div className="finance-table-card__controls">
              <button type="button" className="finance-table__chart" onClick={() => openChart('cards')}>
                Grafiği Aç
              </button>
              <button
                type="button"
                className="finance-table__toggle"
                onClick={() => toggleSection('cards')}
                aria-expanded={!isCardsCollapsed}
                aria-controls="finance-table-cards"
              >
                {isCardsCollapsed ? 'Göster' : 'Daralt'}
              </button>
              <button type="button" className="finance-table__add" onClick={handleAddCreditCard}>
                + Kredi Kartı
              </button>
            </div>
          </div>
          <table className="input-table" id="finance-table-cards" hidden={isCardsCollapsed}>
            <thead>
              <tr>
                <th>Kart</th>
                <th>Toplam Limit</th>
                <th>Kullanılabilir</th>
                <th className="input-table__actions-header">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {creditCards.length === 0 ? (
                <tr className="input-table__empty-row">
                  <td colSpan={creditCardColSpan}>Henüz kredi kartı eklenmedi.</td>
                </tr>
              ) : (
                creditCards.map((entry) => renderCreditCardEntry(entry, creditCardColSpan))
              )}
            </tbody>
          </table>
        </section>

        <section className={`finance-table-card${isDebtsCollapsed ? ' finance-table-card--collapsed' : ''}`}>
          <div className="finance-table-card__header">
            <div className="finance-table-card__title-group">
              <span className="finance-table-card__title">Diğer Borçlar</span>
              <span className="finance-table-card__count">{debts.length} satır</span>
            </div>
            <div className="finance-table-card__controls">
              <button type="button" className="finance-table__chart" onClick={() => openChart('debts')}>
                Grafiği Aç
              </button>
              <button
                type="button"
                className="finance-table__toggle"
                onClick={() => toggleSection('debts')}
                aria-expanded={!isDebtsCollapsed}
                aria-controls="finance-table-debts"
              >
                {isDebtsCollapsed ? 'Göster' : 'Daralt'}
              </button>
              <button type="button" className="finance-table__add" onClick={handleAddDebt}>
                + Yeni Borç
              </button>
            </div>
          </div>
          <table className="input-table" id="finance-table-debts" hidden={isDebtsCollapsed}>
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Tutar</th>
                <th>Tür</th>
                <th className="input-table__actions-header">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {debts.length === 0 ? (
                <tr className="input-table__empty-row">
                  <td colSpan={generalColSpan}>Henüz borç bilgisi eklenmedi.</td>
                </tr>
              ) : (
                debts.map((entry) => renderGeneralEntry(entry, generalColSpan, 'Tutar', 'örn. 15000'))
              )}
            </tbody>
          </table>
        </section>

        <section className={`finance-table-card${isCryptoCollapsed ? ' finance-table-card--collapsed' : ''}`}>
          <div className="finance-table-card__header">
            <div className="finance-table-card__title-group">
              <span className="finance-table-card__title">Kripto (USD)</span>
              <span className="finance-table-card__count">{cryptos.length} satır</span>
            </div>
            <div className="finance-table-card__controls">
              <button type="button" className="finance-table__chart" onClick={() => openChart('crypto')}>
                Grafiği Aç
              </button>
              <button
                type="button"
                className="finance-table__toggle"
                onClick={() => toggleSection('crypto')}
                aria-expanded={!isCryptoCollapsed}
                aria-controls="finance-table-crypto"
              >
                {isCryptoCollapsed ? 'Göster' : 'Daralt'}
              </button>
              <button type="button" className="finance-table__add" onClick={handleAddCrypto}>
                + Yeni Kalem
              </button>
            </div>
          </div>
          <table className="input-table" id="finance-table-crypto" hidden={isCryptoCollapsed}>
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Miktar</th>
                <th>Tür</th>
                <th className="input-table__actions-header">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {cryptos.length === 0 ? (
                <tr className="input-table__empty-row">
                  <td colSpan={generalColSpan}>Henüz kripto varlık eklenmedi.</td>
                </tr>
              ) : (
                cryptos.map((entry) => renderGeneralEntry(entry, generalColSpan, 'Miktar', 'örn. 0.5'))
              )}
            </tbody>
          </table>
        </section>
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
      {activeChartSection ? (
        <div className="chart-overlay" role="dialog" aria-modal="true">
          <div className="chart-overlay__backdrop" onClick={closeChart} aria-hidden="true" />
          <div className="chart-overlay__panel">
            <header className="chart-overlay__header">
              <div>
                <h2>{CHART_META[activeChartSection].label}</h2>
                <p>{CHART_META[activeChartSection].description}</p>
              </div>
              <button type="button" className="chart-overlay__close" onClick={closeChart} aria-label="Grafiği kapat">
                ×
              </button>
            </header>
            <div className="chart-overlay__body">
              <CategoryChart
                history={activeChartHistory}
                color={CHART_META[activeChartSection].color}
                label={CHART_META[activeChartSection].label}
              />
              <CategoryHistoryList
                history={activeChartHistory}
                onRemove={(id) => removeCategoryPoint(activeChartSection, id)}
                onClear={() => clearCategoryHistory(activeChartSection)}
              />
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
};

export default InputPanel;

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

interface CategoryHistoryListProps {
  history: CategoryPoint[];
  onRemove: (pointId: string) => void;
  onClear: () => void;
}

const CategoryHistoryList = ({ history, onRemove, onClear }: CategoryHistoryListProps) => {
  const latestItems = history.slice(-50).reverse();

  return (
    <div className="chart-overlay__history">
      <div className="chart-overlay__history-header">
        <span>Hoşunuza gitmeyen kayıtları silebilirsiniz.</span>
        {history.length > 0 ? (
          <button type="button" className="chart-overlay__clear" onClick={onClear}>
            Hepsini sil
          </button>
        ) : null}
      </div>
      {history.length === 0 ? (
        <p className="chart-overlay__history-empty">
          Henüz kayıt alınmadı. Tabloya veri ekleyerek grafiği oluşturun.
        </p>
      ) : (
        <ul>
          {latestItems.map((point) => (
            <li key={point.id} className="chart-overlay__history-item">
              <div className="chart-overlay__history-meta">
                <span className="chart-overlay__history-value">{formatCurrency(point.value)}</span>
                <span className="chart-overlay__history-date">
                  {HISTORY_DATE_FORMATTER.format(new Date(point.capturedAt))}
                </span>
              </div>
              <button
                type="button"
                className="chart-overlay__history-delete"
                onClick={() => onRemove(point.id)}
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
