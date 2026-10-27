import type { Card, CrmResult, Health, ScanEvent, ScanMode, ScanRecord, Settings } from '../types';

export async function fetchHealth(_settings?: Settings): Promise<Health | null> {
  try {
    const r = await fetch('/api/health');
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
    headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: rec }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok, message: d.message || `HTTP ${r.status}`, url: d.url };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
