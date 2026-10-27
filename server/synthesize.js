import { geminiJSON } from './gemini.js';
import { ok } from './http.js';
import { assessCompanyIdentity, assessPersonIdentity } from './identity.js';

const SYSTEM = `You are a senior B2B sales-intelligence analyst. You build accurate, well-sourced company & contact dossiers from raw evidence: business card, website crawl, official registry records (India MCA/GST, GLEIF, Wikidata, SEC EDGAR, Companies House, OpenCorporates, D&B), data-provider records (Apollo, People Data Labs), Google-Search-grounded research notes, and web search results.
Strict rules:
- Prefer official registry and data-provider records over web snippets when they conflict.
- Only state facts supported by the evidence. When you infer, prefix with "Likely" or "Appears to".
- NEVER fabricate D-U-N-S numbers, LEIs, CINs, GSTINs, revenue, employee counts, customers or URLs. Use null when unknown.
- For Indian companies, preserve INR figures (e.g. "₹120 Cr" or "₹45 Lakh") and include MCA CIN / GSTIN / directors details in registryInfo if found.
- Beware name collisions: ignore results that clearly refer to a different company or person.
- Cite source URLs that actually appear in the evidence.
- Write concisely for a busy sales/BD professional.`;

const SCHEMA = `Return ONLY JSON in exactly this shape:
{
  "company": {
    "name": string, "legalName": string|null, "tagline": string|null,
    "summary": string (2-4 sentences: what they do, for whom, differentiation),
    "industry": string|null, "subIndustry": string|null,
    "businessModel": string|null (e.g. "B2B SaaS", "B2B Manufacturing & Export", "Distributor / Channel Partner", "Professional services"),
    "founded": string|null, "headquarters": string|null, "locations": string[],
    "employeeRange": string|null, "revenueRange": string|null,
    "ownership": string|null (Private / Public (exchange: ticker) / Subsidiary / LLP / Proprietorship / Government),
    "parentCompany": string|null, "dunsNumber": string|null, "cin": string|null, "gstin": string|null,
    "registryInfo": string|null (1-3 sentences summarising registry/MCA/GST/D&B findings: legal status, registration no., directors, paid-up capital, jurisdiction),
    "website": string|null
  },
  "person": {
    "name": string|null, "title": string|null, "seniority": string|null (C-level/VP/Director/Manager/IC/Owner),
    "department": string|null, "summary": string|null, "linkedinUrl": string|null, "responsibilities": string[]
  },
  "products": [{"name": string, "description": string, "category": string|null}],
  "services": [{"name": string, "description": string}],
  "targetCustomers": {"summary": string|null, "segments": string[], "industries": string[], "geographies": string[], "buyerPersonas": string[]},
  "notableCustomers": [{"name": string, "evidence": string, "url": string|null}],
  "partners": string[],
  "competitors": string[],
  "socialPresence": [{"platform": string, "url": string, "handle": string|null, "notes": string|null}],
  "signals": string[] (hiring, funding, launches, expansions, awards — with dates when known),
  "recentNews": [{"title": string, "url": string|null, "date": string|null, "summary": string|null}],
  "talkingPoints": string[] (5 specific, personalised conversation starters referencing real facts),
  "salesAngle": string|null (likely needs/pain points and how to approach them),
  "caveats": string[] (data gaps, ambiguity, possible name collisions),
  "sources": [{"title": string, "url": string}],
  "confidence": number (0..1)
}`;

const clip = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);
const okOrNull = (x) => (ok(x) ? x : null);

function compactEvidence(card, evidence) {
  const crawl = evidence.crawl
    ? {
        origin: evidence.crawl.origin,
        meta: evidence.crawl.meta,
        structuredData: evidence.crawl.jsonLd,
        socialLinksFoundOnSite: evidence.crawl.socials,
        pages: evidence.crawl.pages.map((p) => ({ url: p.url, title: p.title, headings: p.headings.slice(0, 25), text: p.text })),
      }
    : 'Website could not be crawled.';
  const R = evidence.registry || {};
  const research = evidence.research || {};
  return {
    businessCard: card,
    contactValidation: evidence.validation,
    officialRegistries: {
      india: okOrNull(R.india),
      gleif: okOrNull(R.gleif), wikidata: okOrNull(R.wikidata), secEdgar: okOrNull(R.sec),
      companiesHouse: okOrNull(R.companiesHouse), openCorporates: okOrNull(R.openCorporates), dnb: okOrNull(R.dnb),
    },
    dataProviders: {
      company: { apollo: okOrNull(evidence.providers?.company?.apollo), pdl: okOrNull(evidence.providers?.company?.pdl) },
      person: { apollo: okOrNull(evidence.providers?.person?.apollo), pdl: okOrNull(evidence.providers?.person?.pdl) },
    },
    groundedResearch: Object.fromEntries(
      Object.entries(research).filter(([, v]) => ok(v)).map(([k, v]) => [k, { notes: clip(v.text, 12000), sources: v.sources.slice(0, 15) }]),
    ),
    websiteCrawl: crawl,
    webSearch: evidence.searches,
  };
}

export async function synthesize(card, evidence, cfg) {
  const payload = JSON.stringify(compactEvidence(card, evidence));
  return geminiJSON({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel,
    system: SYSTEM,
    temperature: 0.3,
    parts: [{ text: `${SCHEMA}\n\nEVIDENCE:\n${payload.slice(0, 160000)}` }],
  });
}

/** Identify important fields that are still empty after the first pass. */
export function findGaps(d, card) {
  const gaps = [];
  const c = d?.company || {};
  if (!c.summary) gaps.push('what the company does');
  if (!c.headquarters) gaps.push('headquarters location');
  if (!c.founded) gaps.push('founding year');
  if (!c.employeeRange) gaps.push('employee count');
  if (!(d?.products?.length || d?.services?.length)) gaps.push('products and services');
  if (!d?.notableCustomers?.length) gaps.push('named customers or case studies');
  if (!d?.recentNews?.length) gaps.push('news from the last 12 months');
  if (!(d?.socialPresence || []).some((s) => /linkedin\.com\/company/i.test(s.url || ''))) gaps.push('LinkedIn company page URL');
  if (card.fullName && !d?.person?.summary) gaps.push(`professional background of ${card.fullName}`);
  return gaps;
}

/** Merge gap-filling research into the draft dossier. */
export async function refine(draft, research, cfg) {
  const prompt = `${SCHEMA}

You previously produced the DRAFT dossier below. NEW RESEARCH (from Google Search) is provided to fill gaps.
Return the complete, updated dossier JSON in the same schema:
- Fill null/empty fields only when the new research clearly supports them for THIS company/person.
- Keep existing correct content; add new sources you used.
- Do not invent anything.

DRAFT:
${JSON.stringify(draft).slice(0, 60000)}

NEW RESEARCH NOTES:
${clip(research.text, 15000)}

NEW RESEARCH SOURCES:
${JSON.stringify(research.sources.slice(0, 20))}`;
  return geminiJSON({ apiKey: cfg.geminiKey, model: cfg.geminiModel, system: SYSTEM, temperature: 0.2, parts: [{ text: prompt }] });
}

// ---------------------------------------------------------------------------
const fmtNum = (n) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : null);
function fmtMoney(amount, currency) {
  if (typeof amount !== 'number' || !isFinite(amount)) return null;
  const abs = Math.abs(amount);
  if (/inr|rupee|₹/i.test(currency || '')) {
    if (abs >= 1e7) return `₹${(amount / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(amount / 1e5).toFixed(1)} Lakh`;
    return `₹${ amount.toLocaleString('en-IN') }`;
  }
  const s = abs >= 1e9 ? `${(amount / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(amount / 1e6).toFixed(1)}M` : fmtNum(amount);
  const cur = /dollar|usd/i.test(currency || '') ? '$' : currency ? `${currency} ` : '';
  return `${cur}${s}`;
}

function registryRecords(R) {
  const recs = [];
  const add = (source, url, title, fields) => {
    const f = fields.filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]);
    if (f.length) recs.push({ source, url: url || null, title, fields: f });
  };
  if (ok(R.india)) {
    const x = R.india;
    add('India MCA / GST', x.url, x.title, [
      ['CIN / LLPIN', x.cin],
      ['GSTIN', x.gstin],
      ['PAN', x.pan],
      ['Constitution', x.ownership],
      ['Listing status', x.listingStatus],
      ['Incorporation year', x.incorporationYear],
      ['State / ROC', x.state],
      ['NIC industry sector', x.nicSector],
      ['PIN code', x.pinCode],
      ['MCA / ZaubaCorp / Tofler', x.zaubaUrl],
      ['IndiaMART / Trade catalog', x.indiamartUrl],
    ]);
  }
  if (ok(R.dnb)) {
    const x = R.dnb;
    add('D&B Direct+', null, x.name, [
      ['D-U-N-S', x.duns], ['Match confidence', x.confidenceCode != null ? `${x.confidenceCode}/10${x.lowConfidence ? ' (low – review)' : ''}` : null],
      ['Status', x.operatingStatus], ['Legal form', x.legalForm], ['Address', x.address], ['Started', x.startDate],
      ['Employees', fmtNum(x.employees)], ['Revenue', x.revenue ? fmtMoney(x.revenue.amount, x.revenue.currency) : null],
      ['Industry codes', x.industryCodes], ['Trade styles', x.tradeStyles],
    ]);
  }
  if (ok(R.gleif)) {
    const x = R.gleif;
    add('GLEIF', x.url, x.legalName, [
      ['LEI', x.lei], ['Status', x.status], ['Legal form', x.legalForm], ['Jurisdiction', x.jurisdiction],
      ['Registration no.', x.registeredAs], ['Created', x.creationDate?.slice(0, 10)], ['Legal address', x.legalAddress],
      ['HQ address', x.hqAddress !== x.legalAddress ? x.hqAddress : null], ['Other names', x.otherNames],
      ['Match', x.matchScore < 0.9 ? `Fuzzy name match (${Math.round(x.matchScore * 100)}%) – verify` : null],
    ]);
  }
  if (ok(R.companiesHouse)) {
    const x = R.companiesHouse;
    add('Companies House', x.url, x.name, [
      ['Company no.', x.companyNumber], ['Status', x.status], ['Type', x.type], ['Incorporated', x.incorporated],
      ['Registered office', x.address], ['SIC codes', x.sicCodes], ['Officers', x.officers.map((o) => `${o.name} (${o.role})`)],
    ]);
  }
  if (ok(R.openCorporates)) {
    const x = R.openCorporates;
    add('OpenCorporates', x.url, x.name, [['Company no.', x.companyNumber], ['Jurisdiction', x.jurisdiction], ['Status', x.status], ['Incorporated', x.incorporated], ['Type', x.type], ['Address', x.address]]);
  }
  if (ok(R.sec)) {
    const x = R.sec;
    add('SEC EDGAR', x.url, x.name, [
      ['CIK', x.cik], ['Tickers', x.tickers.map((t, i) => `${x.exchanges[i] || ''}:${t}`.replace(/^:/, ''))], ['SIC', x.sic ? `${x.sic} ${x.sicDescription || ''}` : null],
      ['Incorporated in', x.stateOfIncorporation], ['Business address', x.businessAddress],
      ['Revenue', x.revenue ? `${fmtMoney(x.revenue.amount, 'USD')} (${x.revenue.period})` : null],
      ['Latest filings', x.filings.slice(0, 3).map((f) => `${f.form} ${f.date}`)], ['Matched by', x.matchBasis],
    ]);
  }
  if (ok(R.wikidata)) {
    const x = R.wikidata;
    add('Wikidata', x.url, x.label, [
      ['Description', x.description], ['Founded', x.inception], ['Headquarters', [x.headquarters, x.country].filter(Boolean).join(', ')],
      ['Employees', x.employees ? `${fmtNum(x.employees.value)}${x.employees.asOf ? ` (${x.employees.asOf})` : ''}` : null],
      ['Revenue', x.revenue ? `${fmtMoney(x.revenue.amount, x.revenue.currency)}${x.revenue.asOf ? ` (${x.revenue.asOf})` : ''}` : null],
      ['Industry', x.industries], ['Listed on', x.stockExchanges.map((s) => `${s.exchange}${s.ticker ? `: ${s.ticker}` : ''}`)],
      ['Parent', x.parents], ['Wikipedia', x.wikipedia],
    ]);
  }
  return recs;
}

function familyTree(R) {
  const t = { ultimateParent: null, parent: null, subsidiaries: [], familyTreeMembers: null, sources: [] };
  if (ok(R.dnb) && R.dnb.familyTree) {
    const f = R.dnb.familyTree;
    if (f.globalUltimate && f.globalUltimate.duns !== R.dnb.duns) t.ultimateParent = { name: f.globalUltimate.name, id: `DUNS ${f.globalUltimate.duns}`, source: 'D&B' };
    if (f.parent) t.parent = { name: f.parent.name, id: `DUNS ${f.parent.duns}`, source: 'D&B' };
    t.familyTreeMembers = f.familyTreeMembers;
    t.role = f.role;
    t.sources.push('D&B');
  }
  if (ok(R.gleif)) {
    if (!t.ultimateParent && R.gleif.ultimateParent && R.gleif.ultimateParent.lei !== R.gleif.lei) t.ultimateParent = { name: R.gleif.ultimateParent.name, id: `LEI ${R.gleif.ultimateParent.lei}`, source: 'GLEIF' };
    if (!t.parent && R.gleif.directParent && R.gleif.directParent.lei !== R.gleif.lei) t.parent = { name: R.gleif.directParent.name, id: `LEI ${R.gleif.directParent.lei}`, source: 'GLEIF' };
    if (R.gleif.directParent || R.gleif.ultimateParent) t.sources.push('GLEIF');
  }
  if (ok(R.wikidata)) {
    if (!t.parent && R.wikidata.parents[0]) t.parent = { name: R.wikidata.parents[0], id: null, source: 'Wikidata' };
    t.subsidiaries = R.wikidata.subsidiaries;
    if (R.wikidata.parents.length || R.wikidata.subsidiaries.length) t.sources.push('Wikidata');
  }
  return t.ultimateParent || t.parent || t.subsidiaries.length ? t : null;
}

function buildKycScorecard(card, d, evidence) {
  const checks = [];
  let score = 20;
  const c = d.company || {};
  const val = evidence.validation || {};
  const R = evidence.registry || {};
  const ind = okOrNull(R.india);

  // 1) Statutory Tax / GSTIN Check
  if (c.gstin) {
    score += 22;
    checks.push({
      label: 'GSTIN & PAN Tax Structure',
      status: 'verified',
      detail: `Valid 15-digit GSTIN (${c.gstin})${c.pan ? ` · Embedded PAN: ${c.pan}` : ''}${ind?.state ? ` · State: ${ind.state}` : ''}`,
    });
  } else if (val.country === 'IN') {
    checks.push({
      label: 'GSTIN Tax ID',
      status: 'missing',
      detail: 'No GSTIN printed on scan — request GST certificate before raising tax invoice/PO',
    });
  }

  // 2) Official Corporate Registry (MCA CIN, GLEIF, SEC, CH, OpenCorporates, D&B)
  const regSources = (d.registryRecords || []).map((r) => r.source);
  if (c.cin || c.lei || c.dunsNumber || regSources.length > 0) {
    score += 24;
    const idParts = [
      c.cin && `CIN: ${c.cin}`,
      c.lei && `LEI: ${c.lei}`,
      c.dunsNumber && `D-U-N-S: ${c.dunsNumber}`,
      c.founded && `Est. ${c.founded}`,
    ].filter(Boolean);
    checks.push({
      label: 'Corporate Registry & Legal Entity',
      status: 'verified',
      detail: `${regSources.join(', ') || 'Official Registry'} (${idParts.join(' · ') || c.ownership || 'Registered'})`,
    });
  } else {
    checks.push({
      label: 'Corporate Registry Match',
      status: 'warning',
      detail: 'Unlisted / proprietorship or no public statutory registry record matched automatically',
    });
  }

  // 3) Corporate Domain & Email MX Server Check
  const validCorpEmail = (val.emails || []).find((e) => e.mx && !e.freeMail && !e.disposable);
  const validFreeEmail = (val.emails || []).find((e) => e.mx && e.freeMail);
  if (validCorpEmail || val.website?.resolves) {
    score += 18;
    checks.push({
      label: 'Corporate Domain & Email MX',
      status: 'verified',
      detail: validCorpEmail
        ? `Verified corporate email server (${validCorpEmail.value} → ${validCorpEmail.mxHost || 'MX active'})`
        : `Active corporate domain (${val.website?.domain})`,
    });
  } else if (validFreeEmail) {
    score += 8;
    checks.push({
      label: 'Email Domain Check',
      status: 'warning',
      detail: `Uses personal/free email provider (${validFreeEmail.value}) — common for MSMEs/traders, verify business ownership`,
    });
  } else {
    checks.push({
      label: 'Domain & Email Verification',
      status: 'missing',
      detail: 'No resolving corporate domain or verified email MX server found on scan',
    });
  }

  // 4) Live Web, B2B Marketplace & Social Footprint
  const pageCount = evidence.crawl?.pages?.length || 0;
  const socialCount = (d.socialPresence || []).length;
  if (pageCount > 0 || socialCount > 0 || (d.sources || []).length >= 3) {
    score += 16;
    checks.push({
      label: 'Digital & Trade Footprint',
      status: 'verified',
      detail: `${pageCount ? `${pageCount} website page(s) crawled · ` : ''}${socialCount} official profile(s) · ${(d.sources || []).length} corroborated web sources`,
    });
  } else {
    checks.push({
      label: 'Digital & Trade Footprint',
      status: 'warning',
      detail: 'Limited public digital footprint — recommended to verify physical shop/office via GPS tag',
    });
  }

  // 5) Direct Phone / WhatsApp Reachability
  const validPhone = (val.phones || []).find((p) => p.valid);
  if (validPhone) {
    score += 10;
    checks.push({
      label: 'Telecom & WhatsApp Number Format',
      status: 'verified',
      detail: `Valid ITU/E.164 number (${validPhone.international || validPhone.value}${validPhone.country ? `, ${validPhone.country}` : ''})`,
    });
  } else if ((card.phones || []).length > 0) {
    score += 5;
    checks.push({
      label: 'Phone Number Format',
      status: 'warning',
      detail: `Number extracted (${card.phones[0].number}) — verify STD/country code`,
    });
  }

  const finalScore = Math.min(100, Math.max(15, score));
  const tier = finalScore >= 75 ? 'verified' : finalScore >= 48 ? 'standard' : 'review';
  const summary =
    tier === 'verified'
      ? 'Strong statutory & digital verification — suitable for B2B onboarding, procurement & credit review.'
      : tier === 'standard'
        ? 'Standard commercial profile — core contact details verified; request missing statutory IDs if onboarding as a vendor.'
        : 'Limited statutory/public records — perform physical site check or request GST/PAN documents before commercial credit.';

  return { score: finalScore, tier, summary, checks };
}

/** Deterministic post-processing: merge verified data, identity, validation and sources. */
export function finalize(d, card, evidence) {
  d = d && typeof d === 'object' ? d : {};
  d.company = d.company || {};
  d.company.name ||= card.company || card.domain;
  d.company.website ||= card.website;
  d.person = d.person || {};
  d.person.name ||= card.fullName;
  d.person.title ||= card.jobTitle;
  for (const k of ['products', 'services', 'notableCustomers', 'partners', 'competitors', 'socialPresence', 'signals', 'recentNews', 'talkingPoints', 'caveats', 'sources']) {
    if (!Array.isArray(d[k])) d[k] = [];
  }
  d.targetCustomers = d.targetCustomers || { segments: [], industries: [], geographies: [], buyerPersonas: [] };

  const R = evidence.registry || {};
  const evidenceStr = JSON.stringify(evidence);
  const wd = okOrNull(R.wikidata), gl = okOrNull(R.gleif), sec = okOrNull(R.sec), ch = okOrNull(R.companiesHouse), oc = okOrNull(R.openCorporates), dnbR = okOrNull(R.dnb), ind = okOrNull(R.india);
  const ap = okOrNull(evidence.providers?.company?.apollo), pdl = okOrNull(evidence.providers?.company?.pdl);
  const c = d.company;

  // D-U-N-S: only from D&B, or if the exact number literally appears in the evidence
  if (dnbR && !dnbR.lowConfidence) c.dunsNumber = dnbR.duns;
  else if (c.dunsNumber && !evidenceStr.includes(String(c.dunsNumber).replace(/\D/g, '').slice(0, 9))) c.dunsNumber = null;

  c.lei = gl?.lei || wd?.lei || null;
  c.cin = card.cin || ind?.cin || c.cin || null;
  c.gstin = card.gstin || ind?.gstin || c.gstin || null;
  c.pan = ind?.pan || null;
  c.logo = wd?.logo || null;
  c.legalName ||= gl?.legalName || ch?.name || oc?.name || sec?.name || dnbR?.name || null;
  c.founded ||= wd?.inception || ind?.incorporationYear || ch?.incorporated?.slice(0, 4) || oc?.incorporated?.slice(0, 4) || (ap?.founded ? String(ap.founded) : null) || (pdl?.founded ? String(pdl.founded) : null) || null;
  c.headquarters ||= dnbR?.address || sec?.businessAddress || (wd?.headquarters ? [wd.headquarters, wd.country].filter(Boolean).join(', ') : null) || gl?.hqAddress || ap?.hq || pdl?.hq || (ind?.state ? `${ind.state}, India` : null) || null;
  c.industry ||= ind?.nicSector || null;
  c.employeeRange ||=
    (dnbR?.employees ? `${fmtNum(dnbR.employees)} (D&B)` : null) ||
    (wd?.employees ? `${fmtNum(wd.employees.value)} (Wikidata${wd.employees.asOf ? `, ${wd.employees.asOf}` : ''})` : null) ||
    (ap?.employees ? `~${fmtNum(ap.employees)} (Apollo)` : null) || (pdl?.size ? `${pdl.size} (PDL)` : null) || null;
  c.revenueRange ||=
    (sec?.revenue ? `${fmtMoney(sec.revenue.amount, 'USD')} (${sec.revenue.period}, SEC)` : null) ||
    (dnbR?.revenue ? `${fmtMoney(dnbR.revenue.amount, dnbR.revenue.currency)} (D&B)` : null) ||
    (wd?.revenue ? `${fmtMoney(wd.revenue.amount, wd.revenue.currency)} (Wikidata${wd.revenue.asOf ? `, ${wd.revenue.asOf}` : ''})` : null) ||
    (ap?.revenue ? `${ap.revenue} (Apollo)` : null) || null;
  if (!c.ownership) {
    const listing = wd?.stockExchanges?.find((s) => s.ticker) || (sec?.tickers?.[0] ? { exchange: sec.exchanges[0], ticker: sec.tickers[0] } : null);
    if (listing) c.ownership = `Public (${listing.exchange || 'listed'}: ${listing.ticker})`;
    else if (ind?.ownership) c.ownership = ind.ownership;
  }
  const tree = familyTree(R);
  d.familyTree = tree;
  c.parentCompany ||= tree?.ultimateParent?.name || tree?.parent?.name || null;
  d.registryRecords = registryRecords(R);

  // Identity resolution
  const personId = assessPersonIdentity(card, evidence);
  const companyId = assessCompanyIdentity(card, evidence);
  d.identity = { person: personId, company: companyId };
  if (personId.linkedinUrl && ['verified', 'likely'].includes(personId.level)) d.person.linkedinUrl = personId.linkedinUrl;
  else if (d.person.linkedinUrl && !evidenceStr.includes(d.person.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))) d.person.linkedinUrl = null;

  const pp = okOrNull(evidence.providers?.person?.apollo) || okOrNull(evidence.providers?.person?.pdl);
  if (pp) {
    d.person.employmentHistory = pp.employmentHistory;
    d.person.seniority ||= pp.seniority || null;
    d.person.location = pp.location || null;
  }

  // Social links from high-trust sources
  const have = new Set(d.socialPresence.map((s) => (s.url || '').toLowerCase().replace(/\/$/, '')));
  const addSocial = (platform, url, notes) => {
    if (!url) return;
    const key = url.toLowerCase().replace(/\/$/, '');
    if (have.has(key)) return;
    have.add(key);
    d.socialPresence.push({ platform, url, handle: null, notes });
  };
  for (const [k, v] of Object.entries(evidence.crawl?.socials || {})) addSocial(k, v, 'Linked from company website');
  for (const [k, v] of Object.entries(card.socials || {})) if (typeof v === 'string' && k !== 'linkedin') addSocial(k, v, 'Printed on business card');
  addSocial('linkedin', wd?.linkedinCompany, 'From Wikidata');
  addSocial('linkedin', ap?.linkedin, 'From Apollo');

  // Sources: crawl pages, registries, grounding
  const srcSet = new Set(d.sources.map((s) => s.url));
  const addSrc = (title, url) => { if (url && !srcSet.has(url)) { srcSet.add(url); d.sources.push({ title: title || url, url }); } };
  for (const r of d.registryRecords) addSrc(`${r.source}: ${r.title}`, r.url);
  for (const p of evidence.crawl?.pages || []) addSrc(p.title, p.url);
  for (const r of Object.values(evidence.research || {})) if (ok(r)) for (const s of r.sources.slice(0, 10)) addSrc(`${s.title} (Google Search)`, s.url);

  if (companyId.level === 'uncertain') d.caveats.push('Company match is uncertain — verify the website/registry records refer to the same organisation.');
  if (personId.level === 'possible') d.caveats.push('LinkedIn profile match is only "possible" — confirm before outreach.');

  d.validation = evidence.validation || null;
  d.kyc = buildKycScorecard(card, d, evidence);
  d.searchProvider = evidence.provider;
  d.grounded = Object.values(evidence.research || {}).some(ok);
  d.cachedAt = evidence.cachedAt || null;
  d.generatedAt = new Date().toISOString();
  return d;
}
