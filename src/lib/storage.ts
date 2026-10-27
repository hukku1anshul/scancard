import type { ScanRecord, ServerDefaults, Settings } from '../types';

const HISTORY_KEY = 'cardintel.history.v1';
const SETTINGS_KEY = 'cardintel.settings.v2';

export const DEFAULT_SETTINGS: Settings = {
  eventMode: false,
  defaultEvent: '',
  autoGeo: true,
  senderName: '',
  senderCompany: '',
  senderPhone: '',
  senderEmail: '',
  senderWebsite: '',
  senderLinkedin: '',
  senderGstin: '',
};

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('cardintel.settings.v1') || '{}');
    return {
      eventMode: typeof raw.eventMode === 'boolean' ? raw.eventMode : DEFAULT_SETTINGS.eventMode,
      defaultEvent: typeof raw.defaultEvent === 'string' ? raw.defaultEvent : DEFAULT_SETTINGS.defaultEvent,
      autoGeo: typeof raw.autoGeo === 'boolean' ? raw.autoGeo : DEFAULT_SETTINGS.autoGeo,
      senderName: typeof raw.senderName === 'string' ? raw.senderName : DEFAULT_SETTINGS.senderName,
      senderCompany: typeof raw.senderCompany === 'string' ? raw.senderCompany : DEFAULT_SETTINGS.senderCompany,
      senderPhone: typeof raw.senderPhone === 'string' ? raw.senderPhone : DEFAULT_SETTINGS.senderPhone,
      senderEmail: typeof raw.senderEmail === 'string' ? raw.senderEmail : DEFAULT_SETTINGS.senderEmail,
      senderWebsite: typeof raw.senderWebsite === 'string' ? raw.senderWebsite : DEFAULT_SETTINGS.senderWebsite,
      senderLinkedin: typeof raw.senderLinkedin === 'string' ? raw.senderLinkedin : DEFAULT_SETTINGS.senderLinkedin,
      senderGstin: typeof raw.senderGstin === 'string' ? raw.senderGstin : DEFAULT_SETTINGS.senderGstin,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applyServerDefaults(current: Settings, defaults?: ServerDefaults): Settings {
  if (!defaults) return current;
  return {
    ...current,
    defaultEvent: current.defaultEvent || defaults.defaultEvent || '',
    senderName: current.senderName || defaults.senderName || '',
    senderCompany: current.senderCompany || defaults.senderCompany || '',
    senderPhone: current.senderPhone || defaults.senderPhone || '',
    senderEmail: current.senderEmail || defaults.senderEmail || '',
    senderWebsite: current.senderWebsite || defaults.senderWebsite || '',
    senderLinkedin: current.senderLinkedin || defaults.senderLinkedin || '',
    senderGstin: current.senderGstin || defaults.senderGstin || '',
  };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadHistory(): ScanRecord[] {
  try {
    const list: ScanRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    // Queued images live only in memory; anything unfinished after a reload was interrupted.
    return list.map((r) =>
      r.status === 'queued' || r.status === 'processing' ? { ...r, status: 'error', error: 'Interrupted (app was closed) — rescan the card', progress: undefined } : r,
    );
  } catch {
    return [];
  }
}

/** Persist history; trims oldest records if storage quota is exceeded. */
export function saveHistory(history: ScanRecord[]) {
  let list = history.slice(0, 100);
  for (;;) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return;
    } catch {
      if (list.length <= 1) return;
      list = list.slice(0, Math.floor(list.length * 0.7));
    }
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
