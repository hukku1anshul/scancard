import * as cheerio from 'cheerio';
import { UA } from './http.js';

export { UA };

/**
 * Pluggable web search: Tavily -> SerpApi -> free DuckDuckGo/Bing HTML (best-effort).
 * @returns {Promise<{title:string,url:string,snippet:string}[]>}
 */
export async function webSearch(query, cfg, max = 6) {
  try {
    if (cfg.tavilyKey) return await tavily(query, cfg.tavilyKey, max);
    if (cfg.serpapiKey) return await serpapi(query, cfg.serpapiKey, max);
    return await queued(() => freeSearch(query, max));
  } catch (err) {
    console.warn(`[search] "${query}" failed: ${err.message}`);
    return [];
  }
}

// Free endpoints rate-limit aggressively: serialise requests with spacing.
let chain = Promise.resolve();
function queued(fn, gapMs = 900) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => new Promise((r) => setTimeout(r, gapMs)),
    () => new Promise((r) => setTimeout(r, gapMs)),
  );
  return run;
}

async function withTimeout(promiseFn, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promiseFn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

async function tavily(query, key, max) {
  return withTimeout(async (signal) => {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ api_key: key, query, max_results: max, search_depth: 'basic' }),
      signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Tavily ${r.status}: ${JSON.stringify(d?.detail || d).slice(0, 200)}`);
    return (d.results || []).map((x) => ({ title: x.title || '', url: x.url, snippet: (x.content || '').slice(0, 600) }));
  });
}

async function serpapi(query, key, max) {
  return withTimeout(async (signal) => {
    const u = new URL('https://serpapi.com/search.json');
    u.search = new URLSearchParams({ engine: 'google', q: query, num: String(max), api_key: key }).toString();
    const r = await fetch(u, { signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(`SerpApi ${r.status}: ${d.error || ''}`);
    return (d.organic_results || []).slice(0, max).map((x) => ({ title: x.title || '', url: x.link, snippet: x.snippet || '' }));
  });
}

/** Free, keyless search: DuckDuckGo HTML -> Bing HTML, with one backoff retry. */
async function freeSearch(query, max) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ddg = await duckduckgo(query, max).catch(() => []);
    if (ddg.length) return ddg;
    const bingRes = await bing(query, max).catch(() => []);
    if (bingRes.length) return bingRes;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return [];
}

async function duckduckgo(query, max) {
  return withTimeout(async (signal) => {
    const r = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
      body: new URLSearchParams({ q: query, kl: 'wt-wt' }).toString(),
      signal,
    });
    if (!r.ok) throw new Error(`DuckDuckGo ${r.status}`);
    const $ = cheerio.load(await r.text());
    const out = [];
    $('.result').each((_, el) => {
      if (out.length >= max) return;
      const a = $(el).find('a.result__a').first();
      let href = a.attr('href') || '';
      if (!href || href.includes('duckduckgo.com/y.js')) return; // ads
      try {
        const u = new URL(href, 'https://duckduckgo.com');
        href = u.searchParams.get('uddg') || u.href;
      } catch { return; }
      out.push({ title: a.text().trim(), url: href, snippet: $(el).find('.result__snippet').text().trim() });
    });
    return out;
  });
}

async function bing(query, max) {
  return withTimeout(async (signal) => {
    const u = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${max}&setlang=en`;
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }, signal });
    if (!r.ok) throw new Error(`Bing ${r.status}`);
    const $ = cheerio.load(await r.text());
    const out = [];
    $('li.b_algo').each((_, el) => {
      if (out.length >= max) return;
      const a = $(el).find('h2 a').first();
      let href = a.attr('href') || '';
      // Bing sometimes wraps links: /ck/a?...&u=a1<base64url>
      if (href.includes('bing.com/ck/a')) {
        try {
          const encU = new URL(href).searchParams.get('u');
          if (encU?.startsWith('a1')) href = Buffer.from(encU.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        } catch { /* keep wrapped */ }
      }
      if (!/^https?:\/\//.test(href)) return;
      out.push({ title: a.text().trim(), url: href, snippet: $(el).find('.b_caption p, .b_lineclamp2, .b_lineclamp3').first().text().trim() });
    });
    return out;
  });
}
