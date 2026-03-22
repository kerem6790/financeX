import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jlunpaemozlwmzmpysdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VYTHbcm4v87ty4RoDNtkhw_bxuFhwLc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const USER_ID = 'kerem';

const DEVICE_ID_KEY = 'financex:device_id';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const newId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return 'unknown-device';
  }
};
