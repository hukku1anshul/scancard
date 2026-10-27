export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** fetch JSON with timeout. Returns null on 404, throws on other errors. */
export async function getJSON(url, opts = {}, timeout = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (r.status === 404) return null;
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!r.ok) {
      const msg = data?.message || data?.error?.message || data?.error?.errorMessage || data?.error || text.slice(0, 160);
      throw new Error(`${new URL(url).hostname} ${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

export const enc = encodeURIComponent;

const SUFFIXES = /\b(incorporated|inc|llc|llp|ltd|limited|plc|gmbh|ag|sa|sas|corp|corporation|co|company|pvt|private|pty|bv|nv|srl|spa|oy|ab|as|kk|holdings?|group|the)\b\.?/g;

/** Normalise a company name for fuzzy matching. */
export function normName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0..1 similarity between two company names. */
export function nameScore(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.replace(/ /g, '') === y.replace(/ /g, '')) return 0.97;
  if (x.startsWith(y + ' ') || y.startsWith(x + ' ')) return 0.85;
  const A = new Set(x.split(' '));
  const B = new Set(y.split(' '));
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / Math.max(A.size, B.size);
}

export function hostOf(url) {
  try {
    return new URL(/^https?:/i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export const settle = (p) => Promise.resolve(p).catch((e) => ({ error: e?.message || String(e) }));
export const ok = (x) => x && typeof x === 'object' && !x.error;
