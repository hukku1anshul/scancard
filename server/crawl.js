import * as cheerio from 'cheerio';
import { UA } from './http.js';

const SOCIAL_PATTERNS = {
  linkedin: /linkedin\.com\/(company|school|showcase|in)\/[^/?#]+/i,
  twitter: /(?:twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]{1,15}(?:[/?#]|$)/i,
  facebook: /facebook\.com\/(?!sharer|share|dialog)[^/?#]+/i,
  instagram: /instagram\.com\/[^/?#]+/i,
  youtube: /youtube\.com\/(?:@|c\/|channel\/|user\/)[^/?#]+/i,
  github: /github\.com\/[^/?#]+/i,
  tiktok: /tiktok\.com\/@[^/?#]+/i,
  crunchbase: /crunchbase\.com\/organization\/[^/?#]+/i,
};

const KEY_PAGES = /(about|company|who-we-are|our-story|product|solution|service|platform|customer|client|case-stud|success-stor|industr|portfolio|leadership|team|what-we-do|offering|partners)/i;
const PRIORITY = ['about', 'product', 'solution', 'service', 'platform', 'customer', 'client', 'case', 'success', 'industr', 'what-we-do', 'leadership', 'team', 'partner'];

export async function fetchHtml(url, timeout = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || !ct.includes('html')) return null;
    return { url: r.url, html: await r.text() };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parsePage(html, baseUrl) {
  const $ = cheerio.load(html);
  const meta = {
    title: $('title').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
    siteName: $('meta[property="og:site_name"]').attr('content') || '',
  };

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).contents().text());
      const items = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j];
      for (const it of items) {
        const type = [].concat(it?.['@type'] || []).join(',');
        if (/Organization|Corporation|LocalBusiness|Product|Service/i.test(type)) jsonLd.push(it);
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  const links = [];
  const socials = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { return; }
    for (const [k, re] of Object.entries(SOCIAL_PATTERNS)) {
      const m = abs.match(re);
      if (m && !socials[k]) socials[k] = 'https://' + m[0].replace(/[/?#]$/, '');
    }
    links.push({ href: abs, text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 60) });
  });

  $('script,style,noscript,svg,iframe,form,nav,footer').remove();
  const headings = $('h1,h2,h3')
    .map((_, e) => $(e).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((h) => h && h.length < 160)
    .slice(0, 40);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return { meta, jsonLd, links, socials, headings, text };
}

function priorityScore(url) {
  const p = new URL(url).pathname.toLowerCase();
  const idx = PRIORITY.findIndex((k) => p.includes(k));
  return (idx === -1 ? 50 : idx) * 10 + p.split('/').length;
}

/**
 * Crawl the homepage and up to (maxPages-1) key internal pages.
 */
export async function crawlSite(website, maxPages = 7) {
  let home = await fetchHtml(website);
  if (!home && !/\/\/www\./.test(website)) home = await fetchHtml(website.replace('://', '://www.'));
  if (!home) return null;

  const homeUrl = new URL(home.url);
  const host = homeUrl.hostname.replace(/^www\./, '');
  const p = parsePage(home.html, home.url);
  const socials = { ...p.socials };
  const pages = [{ url: home.url, title: p.meta.title, headings: p.headings, text: p.text.slice(0, 5000) }];

  const seen = new Set([home.url.replace(/[#?].*$/, '').replace(/\/$/, '')]);
  const candidates = [];
  for (const l of p.links) {
    try {
      const u = new URL(l.href);
      if (u.hostname.replace(/^www\./, '') !== host) continue;
      if (/\.(pdf|jpe?g|png|gif|zip|mp4|svg)$/i.test(u.pathname)) continue;
      if (/\/(blog|news|press|careers|jobs|legal|privacy|terms|login|signin|signup|cart|tag|category)(\/|$)/i.test(u.pathname)) continue;
      if (!KEY_PAGES.test(u.pathname + ' ' + l.text)) continue;
      const clean = (u.origin + u.pathname).replace(/\/$/, '');
      if (seen.has(clean)) continue;
      seen.add(clean);
      candidates.push(clean);
    } catch { /* ignore */ }
  }
  candidates.sort((a, b) => priorityScore(a) - priorityScore(b));

  const results = await Promise.all(candidates.slice(0, maxPages - 1).map((u) => fetchHtml(u)));
  for (const r of results) {
    if (!r) continue;
    const pp = parsePage(r.html, r.url);
    for (const [k, v] of Object.entries(pp.socials)) socials[k] ??= v;
    pages.push({ url: r.url, title: pp.meta.title, headings: pp.headings, text: pp.text.slice(0, 3500) });
  }

  return { origin: homeUrl.origin, meta: p.meta, jsonLd: p.jsonLd.slice(0, 3), socials, pages };
}
