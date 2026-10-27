import type { Card, CrmResult, Health, ScanEvent, ScanRecord, Settings } from '../types';

/** Settings are sent as a single base64 JSON header; empty values are omitted so server .env applies. */
function headers(settings: Settings): Record<string, string> {
  const { eventMode, defaultEvent, autoGeo, senderName, senderCompany, ...rest } = settings;
  const cfg: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === 'boolean' || (typeof v === 'string' && v.trim())) cfg[k] = v;
  }
  const json = JSON.stringify(cfg);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return { 'Content-Type': 'application/json', 'x-ci-config': b64 };
}

export async function fetchHealth(settings: Settings): Promise<Health | null> {
  try {
    const r = await fetch('/api/health', { headers: headers(settings) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export interface ScanPayload {
  images?: { data: string; mimeType: string }[];
  card?: Card;
  refresh?: boolean;
}

/** Streams NDJSON progress events from the server. */
export async function streamScan(
  payload: ScanPayload,
  settings: Settings,
  onEvent: (e: ScanEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: headers(settings),
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

export async function pushToCrm(provider: 'hubspot' | 'salesforce', record: ScanRecord, settings: Settings): Promise<CrmResult> {
  try {
    const { thumb, ...rec } = record; // don't upload image
    const r = await fetch(`/api/crm/${provider}`, { method: 'POST', headers: headers(settings), body: JSON.stringify({ record: rec }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok, message: d.message || `HTTP ${r.status}`, url: d.url };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
