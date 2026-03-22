import { invoke } from '@tauri-apps/api/core';
import {
  getPersistedState,
  hydrateFromPersistedState,
  PersistedState,
  useExpenseStore,
  useFinanceStore,
  usePlanningStore,
  useExtraIncomeStore,
  useProjectionStore
} from './store';
import {
  checkCloudVersion,
  fetchCloudState,
  getLocalVersion,
  isOnline,
  pushStateToCloud,
  setLocalVersion
} from './cloudSync';

interface StorageInfo {
  app_data_dir: string;
  db_path: string;
  exists: boolean;
}

const globalWindow = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
const isTauri = Boolean(
  globalWindow?.__TAURI_INTERNALS__ ||
  globalWindow?.__TAURI_METADATA__
);

let persistenceReady = false;
let saveScheduled = false;

// ─── Local SQLite ─────────────────────────────────────────────────────────────

const saveToLocal = async (snapshot: PersistedState) => {
  if (!isTauri) return;
  try {
    await invoke('save_state', { state: JSON.stringify(snapshot) });
  } catch (error) {
    console.error('[persistence] Local kaydetme hatası:', error);
  }
};

// ─── Cloud sync ───────────────────────────────────────────────────────────────

const syncToCloud = async (snapshot: PersistedState) => {
  const result = await pushStateToCloud(snapshot);

  if (result === 'conflict') {
    console.warn('[persistence] Conflict! Cloud daha yeni, cloud kazanıyor...');
    try {
      const remote = await fetchCloudState();
      if (remote) {
        hydrateFromPersistedState(remote.state);
        await saveToLocal(remote.state);
        console.info('[persistence] Cloud state uygulandı (version:', remote.version, ')');
      }
    } catch (err) {
      console.error('[persistence] Conflict sonrası cloud pull hatası:', err);
    }
  }
};

// ─── Periodic sync ────────────────────────────────────────────────────────────

let periodicSyncHandle: ReturnType<typeof setInterval> | null = null;

const checkAndPullIfNewer = async () => {
  if (!persistenceReady || !isOnline()) return;
  // Don't pull while a save is pending (would overwrite in-flight changes)
  if (saveScheduled) return;

  try {
    const cloudVersion = await checkCloudVersion();
    const localVersion = getLocalVersion();

    if (cloudVersion !== null && cloudVersion > localVersion) {
      console.info('[persistence] Periyodik sync: cloud daha yeni (cloud:', cloudVersion, '> local:', localVersion, ')');
      const remote = await fetchCloudState();
      if (remote) {
        hydrateFromPersistedState(remote.state);
        await saveToLocal(remote.state);
      }
    }
  } catch (err) {
    console.warn('[persistence] Periyodik sync hatası:', err);
  }
};

const startPeriodicSync = () => {
  if (periodicSyncHandle) clearInterval(periodicSyncHandle);
  periodicSyncHandle = setInterval(() => {
    void checkAndPullIfNewer();
  }, 5000);
};

// ─── Save pipeline ────────────────────────────────────────────────────────────

const persistState = async () => {
  const snapshot = getPersistedState();

  // 1. Always write locally first — fast, never blocked by network
  await saveToLocal(snapshot);

  // 2. Push to cloud — fire-and-forget, handles offline/conflict internally
  void syncToCloud(snapshot);
};

const scheduleSave = () => {
  if (!persistenceReady || saveScheduled) return;
  saveScheduled = true;
  queueMicrotask(async () => {
    saveScheduled = false;
    await persistState();
  });
};

const setupSubscriptions = () => {
  useFinanceStore.subscribe(() => scheduleSave());
  usePlanningStore.subscribe(() => scheduleSave());
  useExpenseStore.subscribe(() => scheduleSave());
  useExtraIncomeStore.subscribe(() => scheduleSave());
  useProjectionStore.subscribe(() => scheduleSave());
};

// ─── Init ─────────────────────────────────────────────────────────────────────

export const initPersistence = async () => {
  if (!isTauri) {
    console.log('[persistence] Tauri değil, persistence atlanıyor');
    return;
  }

  try {
    const info = await invoke<StorageInfo>('get_storage_info');
    console.info('[persistence] AppData dizini:', info.app_data_dir);
    console.info('[persistence] DB yolu:', info.db_path, info.exists ? '(mevcut)' : '(oluşturulacak)');
  } catch (error) {
    console.warn('[persistence] Depolama bilgisi alınamadı:', error);
  }

  // 1. Load from local SQLite first (fast, offline-safe)
  let localState: PersistedState | null = null;
  try {
    const rawState = await invoke<string | null>('load_state');
    if (rawState) {
      const parsed = JSON.parse(rawState) as Partial<PersistedState>;
      hydrateFromPersistedState(parsed);
      localState = parsed as PersistedState;
      console.info('[persistence] Local state yüklendi');
    }
  } catch (error) {
    console.warn('[persistence] Local state okunamadı, varsayılan değerler kullanılacak.', error);
  }

  // 2. Check cloud for newer version, pull if needed
  if (isOnline()) {
    try {
      const cloudVersion = await checkCloudVersion();
      const localVersion = getLocalVersion();
      console.info('[persistence] Versiyon karşılaştırması — local:', localVersion, ', cloud:', cloudVersion);

      if (cloudVersion !== null && cloudVersion > localVersion) {
        console.info('[persistence] Cloud daha yeni, çekiliyor...');
        const remote = await fetchCloudState();
        if (remote) {
          hydrateFromPersistedState(remote.state);
          await saveToLocal(remote.state);
          localState = remote.state;
          console.info('[persistence] Cloud state uygulandı (version:', remote.version, ')');
        }
      } else if (localState && cloudVersion === 0) {
        // First run on a new device — push local state to cloud
        console.info('[persistence] Cloud boş, local state cloud\'a yükleniyor...');
        setLocalVersion(0);
        await syncToCloud(localState);
      }
    } catch (err) {
      console.warn('[persistence] Cloud version check hatası (local ile devam ediliyor):', err);
    }
  }

  setupSubscriptions();
  persistenceReady = true;
  startPeriodicSync();
  console.info('[persistence] Persistence hazır');
  scheduleSave();
};
