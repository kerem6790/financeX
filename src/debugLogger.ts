import { invoke } from '@tauri-apps/api/core';
import {
  getPersistedState,
  PersistedState,
  useExpenseStore,
  useExtraIncomeStore,
  useFinanceStore,
  usePlanningStore,
  useProjectionStore
} from './store';
import { pushChangeEvents, pushLogExport } from './cloudSync';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChangeAction = 'create' | 'update' | 'delete' | 'export_reset';

export interface ChangeEvent {
  event_id: string;
  timestamp: string;
  entity_type: string;
  entity_id: string;
  action: ChangeAction;
  field_path: string;
  old_value: unknown;
  new_value: unknown;
}

export interface ChangeLogRecord {
  event_id: string;
  timestamp: string;
  event_count: number;
  events: ChangeEvent[];
  /** @internal kept for InputPanel entry history — will be removed in a future refactor */
  snapshot: PersistedState;
}

/** Summary returned by logStateSnapshot (used in App.tsx status bar) */
export interface LogResult {
  timestamp: string;
  eventCount: number;
}

/** @deprecated use LogResult */
export type StateLogResult = LogResult;

/** @deprecated use ChangeLogRecord */
export type StateLogRecord = ChangeLogRecord;

export const LOG_WARNING_THRESHOLD = 400;

// ─── Internal state ───────────────────────────────────────────────────────────

const LOG_STORAGE_KEY = 'financex:changeLog';

interface PersistedLogState {
  records: ChangeLogRecord[];
  lastSnapshot: PersistedState | null;
}

let lastSnapshot: PersistedState | null = null;
let autoLoggingEnabled = false;
let autoLogScheduled = false;
let unsubscribeFns: Array<() => void> = [];
const changeLog: ChangeLogRecord[] = [];
const logSubscribers: Array<(records: ChangeLogRecord[]) => void> = [];

// ─── Browser type stubs ───────────────────────────────────────────────────────

type FileSystemWritableFileStream = {
  write: (data: string | Blob | ArrayBufferView | ArrayBuffer) => Promise<void>;
  close: () => Promise<void>;
};
type FileSystemFileHandle = {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};
type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};
type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
};
interface FileSaveOptions {
  description: string;
  mimeType: string;
  extensions: string[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const generateEventId = (): string => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `evt_${ts}_${rand}`;
};

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isTauriEnvironment = () =>
  typeof window !== 'undefined' && Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

// ─── Diff engine ──────────────────────────────────────────────────────────────

interface RawDiff {
  path: string;
  old_value: unknown;
  new_value: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const joinPath = (base: string, segment: string) => (base ? `${base}.${segment}` : segment);
const joinIndex = (base: string, index: number) => (base ? `${base}[${index}]` : `[${index}]`);

const diffStates = (previous: unknown, current: unknown, path = ''): RawDiff[] => {
  if (Object.is(previous, current)) return [];

  if (Array.isArray(previous) && Array.isArray(current)) {
    const length = Math.max(previous.length, current.length);
    const result: RawDiff[] = [];
    for (let i = 0; i < length; i++) {
      const p = joinIndex(path, i);
      if (i >= previous.length) {
        result.push({ path: p, old_value: undefined, new_value: current[i] });
      } else if (i >= current.length) {
        result.push({ path: p, old_value: previous[i], new_value: undefined });
      } else {
        result.push(...diffStates(previous[i], current[i], p));
      }
    }
    return result;
  }

  if (isPlainObject(previous) && isPlainObject(current)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const result: RawDiff[] = [];
    keys.forEach((key) => {
      const p = joinPath(path, key);
      if (!(key in previous)) {
        result.push({ path: p, old_value: undefined, new_value: current[key] });
      } else if (!(key in current)) {
        result.push({ path: p, old_value: previous[key], new_value: undefined });
      } else {
        result.push(...diffStates(previous[key], current[key], p));
      }
    });
    return result;
  }

  return [{ path: path || 'root', old_value: previous, new_value: current }];
};

// ─── Path parser ──────────────────────────────────────────────────────────────

interface ParsedPath {
  entity_type: string;
  entity_id: string;
  field_path: string;
}

/**
 * Resolves an entity's id from a snapshot by traversing the collection path + index.
 * Falls back to `idx:N` if the id cannot be found.
 */
const resolveEntityId = (
  collectionPath: string,
  index: number,
  prevSnap: PersistedState | null,
  currSnap: PersistedState | null
): string => {
  const tryResolve = (snap: PersistedState | null): string | null => {
    if (!snap) return null;
    try {
      const parts = collectionPath.split('.');
      let obj: unknown = snap;
      for (const part of parts) {
        if (obj === null || obj === undefined) return null;
        obj = (obj as Record<string, unknown>)[part];
      }
      if (Array.isArray(obj) && obj[index] && typeof obj[index] === 'object') {
        const id = (obj[index] as { id?: string }).id;
        return id ?? null;
      }
    } catch {
      // fall through
    }
    return null;
  };

  return tryResolve(currSnap) ?? tryResolve(prevSnap) ?? `idx:${index}`;
};

const parseDiffPath = (
  diffPath: string,
  prevSnap: PersistedState | null,
  currSnap: PersistedState | null
): ParsedPath => {
  const bracketIdx = diffPath.indexOf('[');

  if (bracketIdx === -1) {
    // Scalar: "finance.usdRate", "planning.goal"
    const dotIdx = diffPath.lastIndexOf('.');
    if (dotIdx === -1) {
      return { entity_type: diffPath, entity_id: 'global', field_path: '' };
    }
    return {
      entity_type: diffPath.slice(0, dotIdx),
      entity_id: 'global',
      field_path: diffPath.slice(dotIdx + 1)
    };
  }

  // Array access: "finance.entries[0].amount"
  const collectionPath = diffPath.slice(0, bracketIdx);
  const afterBracket = diffPath.slice(bracketIdx);
  const indexMatch = afterBracket.match(/^\[(\d+)\](.*)$/);

  if (!indexMatch) {
    return { entity_type: collectionPath, entity_id: 'unknown', field_path: afterBracket };
  }

  const index = parseInt(indexMatch[1], 10);
  const fieldSuffix = indexMatch[2].startsWith('.') ? indexMatch[2].slice(1) : indexMatch[2];
  const entity_id = resolveEntityId(collectionPath, index, prevSnap, currSnap);

  return { entity_type: collectionPath, entity_id, field_path: fieldSuffix };
};

const detectAction = (old_value: unknown, new_value: unknown): ChangeAction => {
  if (old_value === undefined) return 'create';
  if (new_value === undefined) return 'delete';
  return 'update';
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const persistChangeLog = () => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: PersistedLogState = { records: changeLog, lastSnapshot };
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[financeX][log] Loglar kaydedilirken hata:', error);
  }
};

const clearPersistedLogs = () => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(LOG_STORAGE_KEY);
  } catch (error) {
    console.warn('[financeX][log] Log kaydı silinirken hata:', error);
  }
};

const hydrateChangeLog = () => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(LOG_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedLogState>;
    const records = Array.isArray(parsed.records) ? parsed.records : [];

    // Detect old format (had `diffs` field instead of `events`)
    if (records.length > 0 && 'diffs' in records[0]) {
      console.info('[financeX][log] Eski log formatı tespit edildi, sıfırlanıyor.');
      clearPersistedLogs();
      return;
    }

    changeLog.splice(0, changeLog.length, ...records);
    lastSnapshot = parsed.lastSnapshot ?? null;
  } catch (error) {
    console.warn('[financeX][log] Log kaydı okunamadı, sıfırdan başlayacak.', error);
  }
};

hydrateChangeLog();

// ─── Subscribers ─────────────────────────────────────────────────────────────

const notifySubscribers = () => {
  const snap = changeLog.slice();
  logSubscribers.forEach((listener) => {
    try {
      listener(snap);
    } catch (error) {
      console.warn('[financeX][log] Log dinleyicisi hata verdi:', error);
    }
  });
};

// ─── Core: log a snapshot ────────────────────────────────────────────────────

export const logStateSnapshot = (): LogResult => {
  const currentSnapshot = deepClone(getPersistedState());
  const rawDiffs = lastSnapshot ? diffStates(lastSnapshot, currentSnapshot) : [];
  const timestamp = new Date().toISOString();

  if (rawDiffs.length === 0) {
    lastSnapshot = currentSnapshot;
    return { timestamp, eventCount: 0 };
  }

  const event_id = generateEventId();
  const events: ChangeEvent[] = rawDiffs.map((diff) => {
    const { entity_type, entity_id, field_path } = parseDiffPath(diff.path, lastSnapshot, currentSnapshot);
    return {
      event_id,
      timestamp,
      entity_type,
      entity_id,
      action: detectAction(diff.old_value, diff.new_value),
      field_path,
      old_value: diff.old_value,
      new_value: diff.new_value
    };
  });

  const record: ChangeLogRecord = {
    event_id,
    timestamp,
    event_count: events.length,
    events,
    snapshot: currentSnapshot
  };

  changeLog.push(record);
  lastSnapshot = currentSnapshot;
  persistChangeLog();
  notifySubscribers();

  // Fire-and-forget: sync events to cloud change_log
  void pushChangeEvents(events);

  return { timestamp, eventCount: events.length };
};

// ─── Auto logging ─────────────────────────────────────────────────────────────

const scheduleAutoLog = () => {
  if (autoLogScheduled) return;
  autoLogScheduled = true;
  queueMicrotask(() => {
    autoLogScheduled = false;
    logStateSnapshot();
  });
};

export const ensureAutoStateLogging = () => {
  if (autoLoggingEnabled) return;
  const stores = [useFinanceStore, usePlanningStore, useExpenseStore, useExtraIncomeStore, useProjectionStore];
  unsubscribeFns = stores.map((store) => store.subscribe(() => scheduleAutoLog()));
  autoLoggingEnabled = true;
  console.info('[financeX][log] Otomatik değişiklik loglama aktif.');
};

export const disableAutoStateLogging = () => {
  if (!autoLoggingEnabled) return;
  unsubscribeFns.forEach((fn) => fn());
  unsubscribeFns = [];
  autoLoggingEnabled = false;
  console.info('[financeX][log] Otomatik değişiklik loglama devre dışı.');
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const getChangeLogs = (): ChangeLogRecord[] => changeLog.slice();

/** @deprecated use getChangeLogs */
export const getStateLogs = getChangeLogs;

export const subscribeStateLogs = (listener: (records: ChangeLogRecord[]) => void) => {
  logSubscribers.push(listener);
  listener(changeLog.slice());
  return () => {
    const index = logSubscribers.indexOf(listener);
    if (index >= 0) logSubscribers.splice(index, 1);
  };
};

export const clearStateLogs = () => {
  changeLog.splice(0, changeLog.length);
  lastSnapshot = null;
  clearPersistedLogs();
  notifySubscribers();
  console.info('[financeX][log] Log kayıtları sıfırlandı.');
};

export const hasLogWarning = () => {
  const totalEvents = changeLog.reduce((sum, r) => sum + r.event_count, 0);
  return totalEvents >= LOG_WARNING_THRESHOLD;
};

// ─── JSONL export ─────────────────────────────────────────────────────────────

const buildJsonl = (): string => {
  const lines: string[] = [];
  for (const record of changeLog) {
    for (const event of record.events) {
      lines.push(JSON.stringify(event));
    }
  }
  // Append a system marker so the exported file records when/why it was reset
  lines.push(
    JSON.stringify({
      event_id: generateEventId(),
      timestamp: new Date().toISOString(),
      entity_type: 'system',
      entity_id: 'global',
      action: 'export_reset' satisfies ChangeAction,
      field_path: '',
      old_value: null,
      new_value: null
    })
  );
  return lines.join('\n');
};

const getFilePicker = () => {
  if (typeof window === 'undefined') return null;
  const picker = (
    window as typeof window & {
      showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  return typeof picker === 'function' ? picker : null;
};

const trySaveWithFilePicker = async (
  content: string,
  filename: string,
  options: FileSaveOptions
): Promise<boolean> => {
  const showSaveFilePicker = getFilePicker();
  if (!showSaveFilePicker) return false;
  try {
    const handle = await showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: options.description, accept: { [options.mimeType]: options.extensions } }]
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (error) {
    console.warn('[financeX][log] Dosya seçici hatası:', error);
    return false;
  }
};

const downloadViaAnchor = (content: string, filename: string, mimeType: string): boolean => {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
};

const saveTextWithDialog = async (
  content: string,
  filename: string,
  options: FileSaveOptions
): Promise<boolean> => {
  if (await trySaveWithFilePicker(content, filename, options)) return true;
  return downloadViaAnchor(content, filename, options.mimeType);
};

export const exportChangeLogAsJsonl = async () => {
  if (changeLog.length === 0) {
    console.warn('[financeX][log] Dışa aktarılacak log bulunamadı.');
    return;
  }

  const jsonlContent = buildJsonl();
  const dateSuffix = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `financex-changelog-${dateSuffix}.jsonl`;

  const saved = await saveTextWithDialog(jsonlContent, filename, {
    description: 'JSON Lines Dosyası',
    mimeType: 'application/x-ndjson',
    extensions: ['.jsonl']
  });

  if (!saved) {
    console.warn('[financeX][log] JSONL kaydedilemedi.');
    return;
  }

  console.info('[financeX][log] Change log JSONL olarak indirildi.');

  // Archive export to cloud (fire-and-forget)
  void pushLogExport(filename, jsonlContent);

  clearStateLogs();
  console.info('[financeX][log] Export sonrası log listesi sıfırlandı.');
};

/** @deprecated use exportChangeLogAsJsonl */
export const exportStateLogsAsCsv = exportChangeLogAsJsonl;

// ─── State snapshot export (unchanged) ───────────────────────────────────────

const fetchDatabaseDump = async (): Promise<string | null> => {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<string>('dump_database');
  } catch (error) {
    console.warn('[financeX][log] Veritabanı export edilirken hata:', error);
    return null;
  }
};

export const exportCurrentStateSnapshot = async () => {
  const snapshot = getPersistedState();
  const databaseDump = await fetchDatabaseDump();
  const exportPayload = {
    generatedAt: new Date().toISOString(),
    state: snapshot,
    database:
      databaseDump !== null
        ? { filename: 'financex.db', encoding: 'base64' as const, data: databaseDump }
        : null
  };
  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const dateSuffix = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `financex-state-${dateSuffix}.json`;

  const saved = await saveTextWithDialog(jsonContent, filename, {
    description: 'JSON Dosyası',
    mimeType: 'application/json',
    extensions: ['.json']
  });

  if (!saved) {
    console.warn('[financeX][log] Güncel state kaydedilemedi.');
    return;
  }

  console.info('[financeX][log] Güncel state JSON olarak indirildi.');
};
