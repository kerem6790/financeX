import { supabase, USER_ID, getDeviceId } from './supabase';
import type { PersistedState } from './store';

// ─── Version tracking ─────────────────────────────────────────────────────────

const LOCAL_VERSION_KEY = 'financex:state_version';

export const getLocalVersion = (): number => {
  try {
    return parseInt(localStorage.getItem(LOCAL_VERSION_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
};

export const setLocalVersion = (v: number) => {
  try {
    localStorage.setItem(LOCAL_VERSION_KEY, String(v));
  } catch {}
};

// ─── Sync status ──────────────────────────────────────────────────────────────

export type SyncStatus =
  | { type: 'idle' }
  | { type: 'syncing' }
  | { type: 'ok'; at: string }
  | { type: 'conflict'; cloudVersion: number; localVersion: number }
  | { type: 'offline' }
  | { type: 'error'; message: string };

type SyncListener = (status: SyncStatus) => void;

let currentStatus: SyncStatus = { type: 'idle' };
const listeners: SyncListener[] = [];

export const getSyncStatus = () => currentStatus;

export const subscribeSyncStatus = (fn: SyncListener) => {
  listeners.push(fn);
  fn(currentStatus);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
};

const emit = (status: SyncStatus) => {
  currentStatus = status;
  listeners.forEach((fn) => fn(status));
};

// ─── Online detection ─────────────────────────────────────────────────────────

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

// ─── App state: push ──────────────────────────────────────────────────────────

export const checkCloudVersion = async (): Promise<number | null> => {
  const { data, error } = await supabase
    .from('app_state')
    .select('version')
    .eq('user_id', USER_ID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return 0; // row doesn't exist yet
    throw error;
  }
  return (data as { version: number }).version;
};

/**
 * Push local state to cloud with optimistic locking.
 * Returns 'ok' | 'conflict' | 'offline' | 'error'.
 */
export const pushStateToCloud = async (
  state: PersistedState
): Promise<'ok' | 'conflict' | 'offline' | 'error'> => {
  if (!isOnline()) {
    emit({ type: 'offline' });
    return 'offline';
  }

  emit({ type: 'syncing' });

  try {
    const localVersion = getLocalVersion();
    const cloudVersion = await checkCloudVersion();

    if (cloudVersion === null) {
      emit({ type: 'error', message: 'Cloud version alınamadı' });
      return 'error';
    }

    if (cloudVersion > localVersion) {
      // Another device wrote a newer version
      emit({ type: 'conflict', cloudVersion, localVersion });
      return 'conflict';
    }

    const newVersion = localVersion + 1;
    const { error } = await supabase.from('app_state').upsert(
      {
        user_id: USER_ID,
        device_id: getDeviceId(),
        version: newVersion,
        payload: state,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

    if (error) throw error;

    setLocalVersion(newVersion);
    emit({ type: 'ok', at: new Date().toISOString() });
    return 'ok';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', message: msg });
    console.error('[cloudSync] pushStateToCloud hatası:', err);
    return 'error';
  }
};

// ─── App state: pull ──────────────────────────────────────────────────────────

export const fetchCloudState = async (): Promise<{
  state: PersistedState;
  version: number;
} | null> => {
  if (!isOnline()) return null;

  const { data, error } = await supabase
    .from('app_state')
    .select('version, payload')
    .eq('user_id', USER_ID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const row = data as { version: number; payload: PersistedState };
  setLocalVersion(row.version);
  emit({ type: 'ok', at: new Date().toISOString() });
  return { state: row.payload, version: row.version };
};

// ─── Change log sync ──────────────────────────────────────────────────────────

interface ChangeEventLike {
  event_id: string;
  timestamp: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_path: string;
  old_value: unknown;
  new_value: unknown;
}

export const pushChangeEvents = async (events: ChangeEventLike[]): Promise<void> => {
  if (!isOnline() || events.length === 0) return;
  try {
    const deviceId = getDeviceId();
    const rows = events.map((e) => ({
      user_id: USER_ID,
      device_id: deviceId,
      event_id: e.event_id,
      event_time: e.timestamp,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      action: e.action,
      field_path: e.field_path || null,
      old_value: e.old_value !== undefined ? e.old_value : null,
      new_value: e.new_value !== undefined ? e.new_value : null,
      meta: null
    }));
    const { error } = await supabase.from('change_log').insert(rows);
    if (error) throw error;
  } catch (err) {
    console.warn('[cloudSync] change_log insert hatası:', err);
  }
};

// ─── Log exports sync ─────────────────────────────────────────────────────────

export const pushLogExport = async (exportName: string, payload: string): Promise<void> => {
  if (!isOnline()) return;
  try {
    const { error } = await supabase.from('log_exports').insert({
      user_id: USER_ID,
      device_id: getDeviceId(),
      exported_at: new Date().toISOString(),
      export_name: exportName,
      payload
    });
    if (error) throw error;
  } catch (err) {
    console.warn('[cloudSync] log_exports insert hatası:', err);
  }
};
