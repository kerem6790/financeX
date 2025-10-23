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

interface StorageInfo {
  app_data_dir: string;
  db_path: string;
  exists: boolean;
}

const globalWindow = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
// Tauri v2 environment detection
const isTauri = Boolean(
  globalWindow?.__TAURI_INTERNALS__ || 
  globalWindow?.__TAURI_METADATA__
);

console.log('[persistence] isTauri:', isTauri);
console.log('[persistence] window.__TAURI_INTERNALS__:', globalWindow?.__TAURI_INTERNALS__);
console.log('[persistence] window.__TAURI_METADATA__:', globalWindow?.__TAURI_METADATA__);

let persistenceReady = false;
let saveScheduled = false;

const scheduleSave = () => {
  if (!persistenceReady) {
    return;
  }

  if (saveScheduled) {
    return;
  }

  saveScheduled = true;
  queueMicrotask(async () => {
    saveScheduled = false;
    await persistState();
  });
};

const persistState = async () => {
  if (!isTauri) {
    console.log('[persistence] Tauri değil, kaydetme atlanıyor');
    return;
  }

  try {
    const snapshot = getPersistedState();
    console.log('[persistence] Durum kaydediliyor:', snapshot);
    
    // invoke fonksiyonunu kontrol et
    if (typeof invoke === 'undefined') {
      console.error('[persistence] invoke fonksiyonu tanımlı değil');
      return;
    }
    
    await invoke('save_state', { state: JSON.stringify(snapshot) });
    console.log('[persistence] Durum başarıyla kaydedildi');
  } catch (error) {
    console.error('Durum kaydedilirken hata oluştu:', error);
  }
};

const setupSubscriptions = () => {
  useFinanceStore.subscribe(() => scheduleSave());
  usePlanningStore.subscribe(() => scheduleSave());
  useExpenseStore.subscribe(() => scheduleSave());
  useExtraIncomeStore.subscribe(() => scheduleSave());
  useProjectionStore.subscribe(() => scheduleSave());
};

export const initPersistence = async () => {
  if (!isTauri) {
    console.log('[persistence] Tauri değil, persistence atlanıyor');
    return;
  }

  try {
    const info = await invoke<StorageInfo>('get_storage_info');
    console.info('[persistence] AppData dizini:', info.app_data_dir);
    console.info('[persistence] Veritabanı yolu:', info.db_path, info.exists ? '(mevcut)' : '(oluşturulacak)');
  } catch (error) {
    console.warn('[persistence] Depolama bilgisi alınamadı:', error);
  }

  try {
    console.log('[persistence] Veriler yükleniyor...');
    const rawState = await invoke<string | null>('load_state');
    console.log('[persistence] Ham veri:', rawState ? 'var' : 'yok');
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as Partial<PersistedState>;
        console.log('[persistence] Veriler parse edildi:', parsed);
        hydrateFromPersistedState(parsed);
      } catch (error) {
        console.warn('Kaydedilmiş durum çözümlenemedi, varsayılan değerler kullanılacak.', error);
      }
    }
  } catch (error) {
    console.warn('Kaydedilmiş durum okunamadı, varsayılan değerler kullanılacak.', error);
  }

  setupSubscriptions();
  persistenceReady = true;
  console.log('[persistence] Persistence hazır');

  // İlk yükleme sonrasında mevcut durumu kaydedelim.
  scheduleSave();
};
