import { useEffect, useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import EkGelir from './EkGelir';
import Expenses from './Expenses';
import InputPanel from './InputPanel';
import Planning from './Planning';
import LogsPanel from './LogsPanel';
import './App.css';
import appIconUrl from '../src-tauri/icons/icon.png';
import {
  ensureAutoStateLogging,
  exportChangeLogAsJsonl,
  getChangeLogs,
  LOG_WARNING_THRESHOLD,
  LogResult,
  subscribeStateLogs
} from './debugLogger';
import { getSyncStatus, subscribeSyncStatus, SyncStatus } from './cloudSync';

type TabKey = 'inputs' | 'dashboard' | 'expenses' | 'planning' | 'extra-income' | 'logs';

interface TabConfig {
  key: TabKey;
  label: string;
  heading: string;
  subtitle?: string;
  render?: () => JSX.Element;
}

const tabs: TabConfig[] = [
  {
    key: 'inputs',
    label: 'Girdiler',
    heading: 'Girdiler',
    subtitle: 'Finansal kalemlerinizi burada yönetin.'
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    heading: 'Dashboard',
    subtitle: 'Finansal özet ve trendler burada.'
  },
  {
    key: 'expenses',
    label: 'Harcamalar',
    heading: 'Harcamalar',
    subtitle: 'Güncel harcamalarınızın kaydı.'
  },
  {
    key: 'planning',
    label: 'Planlama',
    heading: 'Planlama',
    subtitle: 'Bütçe hedefleri ve projeksiyonları yönetin.'
  },
  {
    key: 'extra-income',
    label: 'Ek Gelir',
    heading: 'Ek Gelir',
    subtitle: 'Teorik gelir projeksiyonlarını inceleyin.',
    render: () => <EkGelir />
  },
  {
    key: 'logs',
    label: 'Loglar',
    heading: 'Durum Logları',
    subtitle: 'Otomatik logları incele ve dışa aktar.',
    render: () => <LogsPanel />
  }
];

// ─── Sync indicator ───────────────────────────────────────────────────────────

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10000) return 'az önce';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s önce`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const SyncIndicator = ({ status }: { status: SyncStatus }) => {
  let dot: 'green' | 'orange' | 'red' | 'grey' | 'blue' = 'grey';
  let label = 'Bekliyor';
  let sub: string | null = null;

  switch (status.type) {
    case 'ok':
      dot = 'green';
      label = 'Senkronize';
      sub = formatRelativeTime(status.at);
      break;
    case 'syncing':
      dot = 'blue';
      label = 'Kaydediliyor…';
      break;
    case 'offline':
      dot = 'orange';
      label = 'Çevrimdışı';
      sub = 'Bağlantı bekleniyor';
      break;
    case 'conflict':
      dot = 'orange';
      label = 'Çakışma çözüldü';
      sub = `cloud v${status.cloudVersion}`;
      break;
    case 'error':
      dot = 'red';
      label = 'Sync hatası';
      sub = status.message.slice(0, 32);
      break;
  }

  return (
    <div className="sidebar__sync">
      <div className="sidebar__sync-row">
        <span className={`sidebar__sync-dot sidebar__sync-dot--${dot}`} />
        <span className="sidebar__sync-label">{label}</span>
      </div>
      {sub && <span className="sidebar__sync-sub">{sub}</span>}
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('inputs');
  const [lastLog, setLastLog] = useState<LogResult | null>(null);
  const [showLogWarning, setShowLogWarning] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus());
  const activeContent = useMemo(() => tabs.find((tab) => tab.key === activeTab) ?? tabs[0], [activeTab]);
  const subtitle = activeContent.subtitle ?? 'finance yönetimi masaüstü deneyimi';
  const isInputs = activeContent.key === 'inputs';
  const isPlanning = activeContent.key === 'planning';
  const isDashboard = activeContent.key === 'dashboard';
  const isExpenses = activeContent.key === 'expenses';
  const isExtraIncome = activeContent.key === 'extra-income';
  const isLogs = activeContent.key === 'logs';
  const bodyClassName = isInputs || isPlanning || isDashboard || isExpenses || isExtraIncome || isLogs
    ? 'workspace__body workspace__body--inputs'
    : 'workspace__body';
  const lastLogSummary = useMemo(() => {
    if (!lastLog) {
      return null;
    }

    const parsed = new Date(lastLog.timestamp);
    const timeLabel = Number.isNaN(parsed.getTime())
      ? lastLog.timestamp
      : parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const diffLabel = lastLog.eventCount === 0 ? 'değişiklik yok' : `${lastLog.eventCount} değişiklik`;

    return `Son log: ${timeLabel} • ${diffLabel}`;
  }, [lastLog]);

  const handleExportClick = async () => {
    await exportChangeLogAsJsonl();
  };

  useEffect(() => {
    ensureAutoStateLogging();
    const initialRecords = getChangeLogs();
    if (initialRecords.length > 0) {
      const latest = initialRecords[initialRecords.length - 1];
      if (latest) {
        setLastLog({ timestamp: latest.timestamp, eventCount: latest.event_count });
      }
    }
    const initialTotal = initialRecords.reduce((s, r) => s + r.event_count, 0);
    setShowLogWarning(initialTotal >= LOG_WARNING_THRESHOLD);

    const unsubscribe = subscribeStateLogs((records) => {
      const latest = records[records.length - 1];
      if (latest) {
        setLastLog({ timestamp: latest.timestamp, eventCount: latest.event_count });
      } else {
        setLastLog(null);
      }
      const total = records.reduce((s, r) => s + r.event_count, 0);
      setShowLogWarning(total >= LOG_WARNING_THRESHOLD);
    });

    const unsubscribeSync = subscribeSyncStatus((status) => setSyncStatus(status));

    return () => {
      unsubscribe();
      unsubscribeSync();
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={appIconUrl} alt="financeX" className="brand__icon" />
          <span className="brand__name">financeX</span>
        </div>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nav__item${tab.key === activeTab ? ' nav__item--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <SyncIndicator status={syncStatus} />
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <div className="workspace__heading">
            <h1 className="workspace__title">{activeContent.heading}</h1>
            <span className="workspace__meta">{subtitle}</span>
          </div>
          {isLogs && lastLogSummary && (
            <span className="log-button__meta">{lastLogSummary}</span>
          )}
        </header>
        {showLogWarning && (
          <div className="log-warning-banner" role="alert">
            <span>
              Log sayısı {LOG_WARNING_THRESHOLD} kayda yaklaştı. CSV indirerek logları sakla; indirme sonrası liste otomatik sıfırlanır.
            </span>
            <div className="log-warning-banner__actions">
              <button type="button" className="log-button log-button--secondary" onClick={handleExportClick}>
                CSV indir &amp; sıfırla
              </button>
            </div>
          </div>
        )}
        <section className={bodyClassName}>
          {isInputs ? (
            <InputPanel />
          ) : isPlanning ? (
            <Planning />
          ) : isDashboard ? (
            <Dashboard />
          ) : isExpenses ? (
            <Expenses />
          ) : activeContent.render ? (
            activeContent.render()
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
