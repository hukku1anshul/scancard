import type { ScanRecord, Settings } from '../types';

const HISTORY_KEY = 'cardintel.history.v1';
const SETTINGS_KEY = 'cardintel.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  grounding: true,
  tavilyKey: '',
  serpapiKey: '',
  companiesHouseKey: '',
  openCorporatesToken: '',
  dnbKey: '',
  dnbSecret: '',
  apolloKey: '',
  pdlKey: '',
  hubspotToken: '',
  sfInstanceUrl: '',
  sfAccessToken: '',
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
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
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
