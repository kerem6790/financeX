import { invoke } from '@tauri-apps/api/tauri';
import {
  getPersistedState,
  hydrateFromPersistedState,
  PersistedState,
  useExpenseStore,
  useFinanceStore,
  usePlanningStore,
  useExtraIncomeStore
} from './store';

const isTauri = typeof window !== 'undefined' && '__TAURI_IPC__' in window;

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
