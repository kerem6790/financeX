import { useEffect, useMemo, useState } from 'react';
import {
  ChangeLogRecord,
  clearStateLogs,
  exportChangeLogAsJsonl,
  exportCurrentStateSnapshot,
  getChangeLogs,
  hasLogWarning,
  LOG_WARNING_THRESHOLD,
  subscribeStateLogs
} from './debugLogger';

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

const LogsPanel = () => {
  const [records, setRecords] = useState<ChangeLogRecord[]>(() => getChangeLogs());
  const warn = hasLogWarning();

  useEffect(() => {
    const unsubscribe = subscribeStateLogs((nextRecords) => {
      setRecords(nextRecords);
    });
    return unsubscribe;
  }, []);

  const recentRecords = useMemo(() => records.slice(-VISIBLE_RECORD_COUNT).reverse(), [records]);
  const totalEvents = useMemo(() => records.reduce((sum, r) => sum + r.event_count, 0), [records]);

  // Flatten recent records into individual events for the table
  const recentEvents = useMemo(
    () => recentRecords.flatMap((r) => r.events).slice(0, VISIBLE_RECORD_COUNT),
    [recentRecords]
  );

  return (
    <div className="logs-panel">
      <section className="logs-panel__summary">
        <div>
          <h2>Değişiklik Logları</h2>
          <p>Yapısal değişiklik kayıtlarını incele ve dışa aktar (JSONL).</p>
        </div>
        <div className="logs-panel__cta">
          <button type="button" className="log-button" onClick={() => void exportChangeLogAsJsonl()}>
            JSONL İndir &amp; Sıfırla
          </button>
          <button
            type="button"
            className="log-button log-button--secondary"
            onClick={() => void exportCurrentStateSnapshot()}
          >
            State + DB JSON
          </button>
          <button type="button" className="log-button log-button--secondary" onClick={clearStateLogs}>
            Logları Temizle
          </button>
        </div>
      </section>

      <section className="logs-panel__stats">
        <div className="logs-panel__stat-card">
          <span className="logs-panel__stat-label">Toplam Olay Grubu</span>
          <strong className="logs-panel__stat-value">{records.length}</strong>
        </div>
        <div className="logs-panel__stat-card">
          <span className="logs-panel__stat-label">Toplam Event</span>
          <strong className="logs-panel__stat-value">{totalEvents}</strong>
        </div>
        <div className={`logs-panel__stat-card ${warn ? 'logs-panel__stat-card--warning' : ''}`}>
          <span className="logs-panel__stat-label">Uyarı Eşiği</span>
          <strong className="logs-panel__stat-value">
            {totalEvents}/{LOG_WARNING_THRESHOLD}
          </strong>
          <small>(400 event sonrası uyarı)</small>
        </div>
      </section>

      <section className="logs-panel__table">
        <div className="logs-panel__table-header">
          <h3>Son {recentEvents.length} Event</h3>
          <span>En son {VISIBLE_RECORD_COUNT} event gösterilir.</span>
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
                <th>Eski Değer</th>
                <th>Yeni Değer</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event, i) => (
                <tr key={`${event.event_id}-${i}`}>
                  <td>{formatTimestamp(event.timestamp)}</td>
                  <td>{event.entity_type}</td>
                  <td title={event.entity_id}>{truncate(event.entity_id, 12)}</td>
                  <td>{event.action}</td>
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
