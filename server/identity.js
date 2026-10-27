// Identity-resolution confidence for the person's LinkedIn profile and the company match.
import { normName, ok, hostOf } from './http.js';

const strip = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const level = (s) => (s >= 0.85 ? 'verified' : s >= 0.6 ? 'likely' : s >= 0.4 ? 'possible' : 'unverified');

export function assessPersonIdentity(card, evidence) {
  const li = card.socials?.linkedin;
  if (li && /linkedin\.com\/in\//i.test(li)) {
    const why = { shared: 'Shared by you from LinkedIn', user: 'Entered by you', card: 'Printed on the business card' }[card.linkedinSource] || 'Printed on the business card';
    return { linkedinUrl: li, level: 'verified', score: 1, reasons: [why], alternatives: [] };
  }

  // Data-provider matches (Apollo / PDL) — strongest when matched by email
  for (const p of [evidence.providers?.person?.apollo, evidence.providers?.person?.pdl]) {
    if (ok(p) && p.linkedinUrl) {
      const byEmail = p.matchedBy === 'email';
      return {
        linkedinUrl: p.linkedinUrl,
        level: byEmail ? 'verified' : 'likely',
        score: byEmail ? 0.92 : 0.75,
        reasons: [`Matched by ${p.source} using ${p.matchedBy}`],
        alternatives: [],
      };
    }
  }

  if (!card.fullName) return { linkedinUrl: null, level: 'unverified', score: 0, reasons: ['No name on card'], alternatives: [] };

  const first = strip(card.firstName);
  const last = strip(card.lastName);
  const company = normName(card.company);
  const domainRoot = card.domain?.split('.')[0] || '';
  const titleTokens = strip(card.jobTitle).split(/[^a-z]+/).filter((t) => t.length > 3);

  const seen = new Set();
  const cands = [];
  const results = (evidence.searches?.social || []).flatMap((s) => s.results || []);
  for (const r of results) {
    if (!/linkedin\.com\/in\//i.test(r.url || '')) continue;
    const url = r.url.split('?')[0].replace(/\/$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    const hay = strip(`${r.title} ${r.snippet}`);
    const head = strip(r.title);
    let score = 0;
    const reasons = [];
    if (first && last && head.includes(first) && head.includes(last)) { score += 0.45; reasons.push('Full name matches profile title'); }
    else if (last && head.includes(last)) { score += 0.2; reasons.push('Surname matches'); }
    if ((company && hay.includes(company)) || (domainRoot.length > 3 && hay.includes(domainRoot))) { score += 0.35; reasons.push('Company appears in profile'); }
    const hits = titleTokens.filter((t) => hay.includes(t)).length;
    if (hits) { score += Math.min(0.2, hits * 0.1); reasons.push('Job title keywords match'); }
    cands.push({ url, title: r.title, score: Math.min(1, score), reasons });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  if (!best || best.score < 0.4) {
    return { linkedinUrl: null, level: 'unverified', score: best?.score || 0, reasons: ['No confident LinkedIn match in search results'], alternatives: cands.slice(0, 3).map(({ url, title, score }) => ({ url, title, score })) };
  }
  // Ambiguity penalty: two near-equal candidates means a likely name collision
  const ambiguous = cands[1] && best.score - cands[1].score < 0.1;
  const score = ambiguous ? best.score - 0.15 : best.score;
  return {
    linkedinUrl: best.url,
    level: level(Math.min(score, 0.84)), // search-only evidence is never "verified"
    score,
    reasons: [...best.reasons, ...(ambiguous ? ['Multiple similar profiles found — possible name collision'] : [])],
    alternatives: cands.slice(1, 4).map(({ url, title, score: s }) => ({ url, title, score: s })),
  };
}

export function assessCompanyIdentity(card, evidence) {
  const R = evidence.registry || {};
  const reasons = [];
  let score = 0;
  const emailDomains = (card.emails || []).map((e) => e.split('@')[1]?.toLowerCase());
  if (card.domain && emailDomains.includes(card.domain)) { score += 0.25; reasons.push('Email domain matches company website'); }
  if (evidence.crawl) {
    const t = normName(`${evidence.crawl.meta?.title} ${evidence.crawl.meta?.siteName}`);
    const n = normName(card.company);
    if (n && t.includes(n.split(' ')[0])) { score += 0.25; reasons.push('Website title matches company name'); }
    else { score += 0.1; reasons.push('Company website reachable'); }
  }
  if (ok(R.dnb) && !R.dnb.lowConfidence) { score += 0.4; reasons.push(`D&B match (confidence code ${R.dnb.confidenceCode})`); }
  if (ok(R.wikidata)) { score += 0.3; reasons.push('Wikidata entity matched by official website'); }
  if (ok(R.gleif) && R.gleif.matchScore >= 0.9) { score += 0.2; reasons.push('GLEIF legal-entity name match'); }
  if (ok(R.companiesHouse)) { score += 0.15; reasons.push('Companies House record matched'); }
  if (ok(R.openCorporates)) { score += 0.1; reasons.push('OpenCorporates record matched'); }
  if (ok(R.sec) && R.sec.matchBasis !== 'exact name') { score += 0.2; reasons.push(`SEC EDGAR filer (${R.sec.matchBasis})`); }
  const apollo = evidence.providers?.company?.apollo;
  if (ok(apollo) && hostOf(apollo.website || '') === card.domain) { score += 0.2; reasons.push('Apollo organisation matched by domain'); }
  score = Math.min(1, score);
  return { level: score >= 0.7 ? 'verified' : score >= 0.4 ? 'likely' : 'uncertain', score, reasons };
}
