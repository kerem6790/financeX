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

const globalWindow = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
const isTauri = Boolean(globalWindow?.__TAURI__ ?? globalWindow?.__TAURI_IPC__ ?? globalWindow?.__TAURI_METADATA__);

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
    return;
  }

  try {
    const snapshot = getPersistedState();
    await invoke('save_state', { state: JSON.stringify(snapshot) });
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
    return;
  }

  try {
    const rawState = await invoke<string | null>('load_state');
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as Partial<PersistedState>;
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

  // İlk yükleme sonrasında mevcut durumu kaydedelim.
  scheduleSave();
};
