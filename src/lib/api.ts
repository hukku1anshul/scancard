import type { Card, CrmResult, Health, ScanEvent, ScanMode, ScanRecord, Settings } from '../types';
import { loadSettings } from './storage';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const tenant = loadSettings()?.tenantId || 'default';
  return {
    ...extra,
    'x-tenant-id': tenant,
  };
}

export async function fetchHealth(_settings?: Settings): Promise<Health | null> {
  try {
    const r = await fetch('/api/health', { headers: authHeaders() });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export interface ScanPayload {
  images?: { data: string; mimeType: string }[];
  card?: Card;
  scanMode?: ScanMode;
  refresh?: boolean;
}

/** Streams NDJSON progress events from the server using server-configured API keys. */
export async function streamScan(
  payload: ScanPayload,
  _settings: Settings,
  onEvent: (e: ScanEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Server error ${res.status}. Is the API server running?`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf));
}

export async function pushToCrm(provider: 'hubspot' | 'salesforce', record: ScanRecord, _settings?: Settings): Promise<CrmResult> {
  try {
    const { thumb, ...rec } = record; // don't upload image
    const r = await fetch(`/api/crm/${provider}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ record: rec }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok, message: d.message || `HTTP ${r.status}`, url: d.url };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// -------------------------------------------------------- Server Database API

export async function fetchServerRecords(params: Record<string, string> = {}): Promise<ScanRecord[]> {
  try {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`/api/records${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.records) ? d.records : [];
  } catch {
    return [];
  }
}

export async function saveServerRecord(record: ScanRecord): Promise<boolean> {
  try {
    const r = await fetch('/api/records', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ record }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function patchServerRecord(id: string, patch: Partial<ScanRecord>): Promise<boolean> {
  try {
    const r = await fetch(`/api/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteServerRecord(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/records/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function syncRecordsWithServer(localRecords: ScanRecord[]): Promise<ScanRecord[]> {
  try {
    const r = await fetch('/api/records/sync', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ records: localRecords }),
    });
    if (!r.ok) return localRecords;
    const d = await r.json();
    return Array.isArray(d.records) ? d.records : localRecords;
  } catch {
    return localRecords;
  }
}

export interface AnalyticsData {
  totalScans: number;
  totalActionItems: number;
  priorityBreakdown: Record<string, number>;
  roleBreakdown: Record<string, number>;
  kycBreakdown: Record<string, number>;
  events: { name: string; count: number; hotLeads: number; dealValues: string[]; actionItemsCount: number }[];
}

export async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const r = await fetch('/api/analytics', { headers: authHeaders() });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
