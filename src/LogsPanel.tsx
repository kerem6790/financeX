import { useEffect, useMemo, useState } from 'react';
import {
  ChangeLogRecord,
  exportChangeLogAsJsonl,
  exportCurrentStateSnapshot,
  getChangeLogs,
  subscribeStateLogs
} from './debugLogger';
import { getSyncStatus, subscribeSyncStatus, SyncStatus } from './cloudSync';

const VISIBLE_RECORD_COUNT = 25;

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });
};

const truncate = (value: unknown, maxLen = 40): string => {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
};

const syncStatusLabel = (status: SyncStatus): { text: string; ok: boolean } => {
  switch (status.type) {
    case 'ok':
      return { text: `Buluta kaydediliyor ✓`, ok: true };
    case 'syncing':
      return { text: 'Kaydediliyor…', ok: true };
    case 'offline':
      return { text: 'Çevrimdışı — bulut sync bekliyor', ok: false };
    case 'conflict':
      return { text: 'Çakışma çözüldü (cloud kazandı)', ok: false };
    case 'error':
      return { text: `Sync hatası: ${status.message}`, ok: false };
    default:
      return { text: 'Bekliyor…', ok: true };
  }
};

const LogsPanel = () => {
  const [records, setRecords] = useState<ChangeLogRecord[]>(() => getChangeLogs());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus());

  useEffect(() => {
    const unsubLogs = subscribeStateLogs((nextRecords) => setRecords(nextRecords));
    const unsubSync = subscribeSyncStatus((s) => setSyncStatus(s));
    return () => {
      unsubLogs();
      unsubSync();
    };
  }, []);

  const recentRecords = useMemo(() => records.slice(-VISIBLE_RECORD_COUNT).reverse(), [records]);
  const totalEvents = useMemo(() => records.reduce((sum, r) => sum + r.event_count, 0), [records]);
  const recentEvents = useMemo(
    () => recentRecords.flatMap((r) => r.events).slice(0, VISIBLE_RECORD_COUNT),
    [recentRecords]
  );

  const { text: syncText, ok: syncOk } = syncStatusLabel(syncStatus);

  return (
    <div className="logs-panel">
      <section className="logs-panel__summary">
        <div>
          <h2>Değişiklik Logları</h2>
          <p>Her değişiklik otomatik olarak buluta kaydedilir.</p>
        </div>
        <div className="logs-panel__cta">
          <button type="button" className="log-button" onClick={() => void exportChangeLogAsJsonl()}>
            PC&apos;ye İndir
          </button>
          <button
            type="button"
            className="log-button log-button--secondary"
            onClick={() => void exportCurrentStateSnapshot()}
          >
            State + DB JSON
          </button>
        </div>
      </section>

      <section className="logs-panel__stats">
        <div className="logs-panel__stat-card">
          <span className="logs-panel__stat-label">Olay Grubu</span>
          <strong className="logs-panel__stat-value">{records.length}</strong>
        </div>
        <div className="logs-panel__stat-card">
          <span className="logs-panel__stat-label">Toplam Event</span>
          <strong className="logs-panel__stat-value">{totalEvents}</strong>
        </div>
        <div className={`logs-panel__stat-card logs-panel__stat-card--sync ${syncOk ? '' : 'logs-panel__stat-card--warning'}`}>
          <span className="logs-panel__stat-label">Bulut Sync</span>
          <strong className="logs-panel__stat-value logs-panel__stat-value--sync">{syncText}</strong>
        </div>
      </section>

      <section className="logs-panel__table">
        <div className="logs-panel__table-header">
          <h3>Son {recentEvents.length} Event</h3>
          <span>En son {VISIBLE_RECORD_COUNT} event — tümü bulutta saklanıyor.</span>
        </div>
        {recentEvents.length === 0 ? (
          <div className="logs-panel__empty">
            Henüz log kaydı yok. Uygulamayı kullanmaya başladığında loglar burada görünecek.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Action</th>
                <th>Field</th>
                <th>Eski</th>
                <th>Yeni</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event, i) => (
                <tr key={`${event.event_id}-${i}`}>
                  <td>{formatTimestamp(event.timestamp)}</td>
                  <td>{event.entity_type}</td>
                  <td title={event.entity_id}>{truncate(event.entity_id, 12)}</td>
                  <td>
                    <span className={`logs-panel__action logs-panel__action--${event.action}`}>
                      {event.action}
                    </span>
                  </td>
                  <td>{event.field_path || '—'}</td>
                  <td title={String(event.old_value)}>{truncate(event.old_value)}</td>
                  <td title={String(event.new_value)}>{truncate(event.new_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default LogsPanel;
