// Domain-level file cache for company research (website crawl, registries,
// company searches and grounded research). Person-specific data is never cached.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normName } from './http.js';

const DIR = process.env.CACHE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cache');
const TTL_MS = (Number(process.env.CACHE_TTL_HOURS) || 72) * 3600 * 1000;

const file = (key) => path.join(DIR, crypto.createHash('sha1').update(key).digest('hex') + '.json');

export function companyCacheKey(card, signature) {
  const id = card.domain || normName(card.company || '');
  return id ? `${id}|${signature}` : null;
}

export async function cacheGet(key) {
  if (!key) return null;
  try {
    const d = JSON.parse(await fs.readFile(file(key), 'utf8'));
    if (Date.now() - d.ts > TTL_MS) return null;
    return d;
  } catch {
    return null;
  }
}

export async function cacheSet(key, data) {
  if (!key) return;
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file(key), JSON.stringify({ ts: Date.now(), key, data }));
  } catch (e) {
    console.warn('[cache] write failed:', e.message);
  }
}
