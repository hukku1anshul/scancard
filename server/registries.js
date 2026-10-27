// Free public registries: GLEIF (LEI + corporate parents), Wikidata, SEC EDGAR,
// plus keyed UK Companies House and OpenCorporates.
import { getJSON, enc, nameScore, hostOf } from './http.js';

const SEC_UA = process.env.SEC_USER_AGENT || 'CardIntel/1.0 (business-card enrichment; admin@example.com)';
const WD_HEADERS = { 'User-Agent': 'CardIntel/1.0 (business-card enrichment)', Accept: 'application/json' };
const GLEIF_HEADERS = { Accept: 'application/vnd.api+json' };

// ---------------------------------------------------------------- GLEIF ----
const fmtAddr = (a) => (a ? [...(a.addressLines || []), a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', ') : null);

async function gleifRecord(lei) {
  const d = await getJSON(`https://api.gleif.org/api/v1/lei-records/${lei}`, { headers: GLEIF_HEADERS });
  return d?.data || null;
}

async function gleifParent(lei, kind) {
  const d = await getJSON(`https://api.gleif.org/api/v1/lei-records/${lei}/${kind}`, { headers: GLEIF_HEADERS }).catch(() => null);
  const r = d?.data;
  if (!r?.attributes?.entity) return null;
  return { lei: r.id, name: r.attributes.entity.legalName?.name, country: r.attributes.entity.legalAddress?.country };
}

export async function gleif(company, country, leiHint) {
  let rec = leiHint ? await gleifRecord(leiHint).catch(() => null) : null;
  let matchScore = rec ? 1 : 0;
  if (!rec) {
    const d = await getJSON(`https://api.gleif.org/api/v1/fuzzycompletions?field=entity.legalName&q=${enc(company)}`, { headers: GLEIF_HEADERS });
    const cands = (d?.data || [])
      .map((x) => ({ name: x.attributes?.value, lei: x.relationships?.['lei-records']?.data?.id, s: nameScore(x.attributes?.value, company) }))
      .filter((x) => x.lei && x.s >= 0.6)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
    if (!cands.length) return null;
    const recs = (await Promise.all(cands.map((c) => gleifRecord(c.lei).catch(() => null)))).filter(Boolean);
    const scored = recs.map((r) => {
      const e = r.attributes.entity;
      let s = nameScore(e.legalName?.name, company);
      if (country && (e.legalAddress?.country === country || e.headquartersAddress?.country === country)) s += 0.3;
      if (e.status === 'ACTIVE') s += 0.15;
      if (r.attributes.registration?.status === 'ISSUED') s += 0.05;
      return { r, s };
    }).sort((a, b) => b.s - a.s);
    if (!scored.length) return null;
    rec = scored[0].r;
    matchScore = Math.min(1, scored[0].s);
  }
  const e = rec.attributes.entity;
  const reg = rec.attributes.registration || {};
  const [directParent, ultimateParent] = await Promise.all([gleifParent(rec.id, 'direct-parent'), gleifParent(rec.id, 'ultimate-parent')]);
  return {
    source: 'GLEIF',
    url: `https://search.gleif.org/#/record/${rec.id}`,
    lei: rec.id,
    legalName: e.legalName?.name,
    otherNames: (e.otherNames || []).map((n) => n.name).slice(0, 5),
    legalForm: e.legalForm?.other || e.legalForm?.id || null,
    status: e.status,
    jurisdiction: e.jurisdiction,
    registeredAs: e.registeredAs || null,
    legalAddress: fmtAddr(e.legalAddress),
    hqAddress: fmtAddr(e.headquartersAddress),
    country: e.legalAddress?.country || null,
    creationDate: e.creationDate || null,
    registrationStatus: reg.status,
    lastUpdate: reg.lastUpdateDate,
    directParent,
    ultimateParent,
    matchScore,
  };
}

// ------------------------------------------------------------- Wikidata ----
const WD_API = 'https://www.wikidata.org/w/api.php';

function rankedClaims(e, p) {
  const cs = (e.claims?.[p] || []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue);
  const pref = cs.filter((c) => c.rank === 'preferred');
  return pref.length ? pref : cs;
}
const claimVal = (c) => c?.mainsnak?.datavalue?.value;
const pointInTime = (c) => c?.qualifiers?.P585?.[0]?.datavalue?.value?.time || '';
function latest(e, p) {
  return rankedClaims(e, p).sort((a, b) => pointInTime(b).localeCompare(pointInTime(a)))[0];
}
const ids = (e, p, n = 20) => rankedClaims(e, p).map((c) => claimVal(c)?.id).filter(Boolean).slice(0, n);
const strs = (e, p) => rankedClaims(e, p).map((c) => claimVal(c)).filter((v) => typeof v === 'string');
const year = (t) => (t ? t.replace(/^\+/, '').slice(0, 4) : null);

export async function wikidata(company, domain) {
  const s = await getJSON(`${WD_API}?action=wbsearchentities&search=${enc(company)}&language=en&type=item&limit=8&format=json`, { headers: WD_HEADERS });
  const candIds = (s?.search || []).map((x) => x.id);
  if (!candIds.length) return null;
  const ents = await getJSON(`${WD_API}?action=wbgetentities&ids=${candIds.join('|')}&props=labels|descriptions|claims|sitelinks&languages=en&format=json`, { headers: WD_HEADERS });

  let best = null;
  let bestScore = 0;
  for (const id of candIds) {
    const e = ents?.entities?.[id];
    if (!e?.claims) continue;
    const label = e.labels?.en?.value || '';
    const sites = strs(e, 'P856').map(hostOf).filter(Boolean);
    let sc = nameScore(label, company) * 0.6;
    if (domain && sites.some((h) => h === domain || h.endsWith('.' + domain) || domain.endsWith('.' + h))) sc += 1;
    if (!e.claims.P856 && !e.claims.P571 && !e.claims.P159 && !e.claims.P452) sc -= 0.3; // probably not an organisation
    if (sc > bestScore) { best = e; bestScore = sc; }
  }
  // With a domain we require a website match (avoids name collisions); otherwise an exact name.
  if (!best || bestScore < (domain ? 1.0 : 0.6)) return null;
  const e = best;

  const emp = latest(e, 'P1128');
  const rev = latest(e, 'P2139');
  const exchanges = rankedClaims(e, 'P414').map((c) => ({ id: claimVal(c)?.id, ticker: c.qualifiers?.P249?.[0]?.datavalue?.value || null }));
  const refIds = new Set([...ids(e, 'P159', 3), ...ids(e, 'P17', 2), ...ids(e, 'P749', 5), ...ids(e, 'P355', 15), ...ids(e, 'P452', 5), ...exchanges.map((x) => x.id).filter(Boolean)]);
  const unitId = claimVal(rev)?.unit?.split('/').pop();
  if (unitId?.startsWith('Q')) refIds.add(unitId);
  let labels = {};
  if (refIds.size) {
    const l = await getJSON(`${WD_API}?action=wbgetentities&ids=${[...refIds].slice(0, 50).join('|')}&props=labels&languages=en&format=json`, { headers: WD_HEADERS }).catch(() => null);
    for (const [k, v] of Object.entries(l?.entities || {})) labels[k] = v.labels?.en?.value || k;
  }
  const L = (id) => labels[id] || null;
  const logo = strs(e, 'P154')[0];
  const li = strs(e, 'P4264')[0];
  const tw = strs(e, 'P2002')[0];
  const enwiki = e.sitelinks?.enwiki?.title;
  return {
    source: 'Wikidata',
    url: `https://www.wikidata.org/wiki/${e.id}`,
    id: e.id,
    label: e.labels?.en?.value,
    description: e.descriptions?.en?.value || null,
    website: strs(e, 'P856')[0] || null,
    inception: year(claimVal(rankedClaims(e, 'P571')[0])?.time),
    headquarters: ids(e, 'P159', 1).map(L)[0] || null,
    country: ids(e, 'P17', 1).map(L)[0] || null,
    employees: emp ? { value: Number(claimVal(emp).amount), asOf: year(pointInTime(emp)) } : null,
    revenue: rev ? { amount: Number(claimVal(rev).amount), currency: unitId ? L(unitId) : null, asOf: year(pointInTime(rev)) } : null,
    industries: ids(e, 'P452', 5).map(L).filter(Boolean),
    parents: ids(e, 'P749', 5).map(L).filter(Boolean),
    subsidiaries: ids(e, 'P355', 15).map(L).filter(Boolean),
    stockExchanges: exchanges.map((x) => ({ exchange: L(x.id), ticker: x.ticker })).filter((x) => x.exchange),
    lei: strs(e, 'P1278')[0] || null,
    secCik: strs(e, 'P5531')[0] || null,
    linkedinCompany: li ? `https://www.linkedin.com/company/${li}` : null,
    twitter: tw ? `https://x.com/${tw}` : null,
    logo: logo ? `https://commons.wikimedia.org/wiki/Special:FilePath/${enc(logo)}?width=160` : null,
    wikipedia: enwiki ? `https://en.wikipedia.org/wiki/${enc(enwiki.replace(/ /g, '_'))}` : null,
  };
}

// ------------------------------------------------------------ SEC EDGAR ----
let tickerCache = null;
async function secTickers() {
  if (tickerCache && Date.now() - tickerCache.ts < 86400000) return tickerCache.data;
  const d = await getJSON('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': SEC_UA } });
  tickerCache = { ts: Date.now(), data: Object.values(d || {}) };
  return tickerCache.data;
}

async function secRevenue(pad) {
  for (const concept of ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']) {
    const d = await getJSON(`https://data.sec.gov/api/xbrl/companyconcept/CIK${pad}/us-gaap/${concept}.json`, { headers: { 'User-Agent': SEC_UA } }).catch(() => null);
    const usd = d?.units?.USD;
    if (!usd?.length) continue;
    const annual = usd.filter((x) => x.form === '10-K' && /^CY\d{4}$/.test(x.frame || ''));
    const pick = (annual.length ? annual : usd.filter((x) => x.form === '10-K')).sort((a, b) => b.end.localeCompare(a.end))[0];
    if (pick) return { amount: pick.val, currency: 'USD', period: pick.frame || pick.end };
  }
  return null;
}

export async function secEdgar(company, { cik, tickers = [] } = {}) {
  let basis = cik ? 'Wikidata CIK' : null;
  if (!cik) {
    const list = await secTickers();
    let m = tickers.length ? list.find((x) => tickers.includes(x.ticker)) : null;
    if (m) basis = 'ticker';
    // Name-only matching across ~10k filers is collision-prone: require an exact normalised match.
    if (!m) {
      m = list.find((x) => nameScore(x.title, company) >= 0.97);
      if (m) basis = 'exact name';
    }
    if (!m) return null;
    cik = m.cik_str;
  }
  const pad = String(cik).padStart(10, '0');
  const sub = await getJSON(`https://data.sec.gov/submissions/CIK${pad}.json`, { headers: { 'User-Agent': SEC_UA } });
  if (!sub) return null;
  const recent = sub.filings?.recent || {};
  const filings = [];
  for (let i = 0; i < (recent.form || []).length && filings.length < 5; i++) {
    if (['10-K', '10-Q', '8-K', '20-F', 'S-1', '6-K'].includes(recent.form[i])) {
      filings.push({
        form: recent.form[i],
        date: recent.filingDate[i],
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
      });
    }
  }
  const b = sub.addresses?.business;
  return {
    source: 'SEC EDGAR',
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${pad}`,
    matchBasis: basis,
    cik: pad,
    name: sub.name,
    tickers: sub.tickers || [],
    exchanges: sub.exchanges || [],
    sic: sub.sic,
    sicDescription: sub.sicDescription,
    stateOfIncorporation: sub.stateOfIncorporation || null,
    fiscalYearEnd: sub.fiscalYearEnd || null,
    businessAddress: b ? [b.street1, b.street2, b.city, b.stateOrCountry, b.zipCode].filter(Boolean).join(', ') : null,
    phone: sub.phone || null,
    formerNames: (sub.formerNames || []).map((f) => f.name).slice(0, 3),
    filings,
    revenue: await secRevenue(pad).catch(() => null),
  };
}

// ------------------------------------------------------ Companies House ----
export async function companiesHouse(company, key) {
  const headers = { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') };
  const base = 'https://api.company-information.service.gov.uk';
  const s = await getJSON(`${base}/search/companies?q=${enc(company)}&items_per_page=8`, { headers });
  const top = (s?.items || [])
    .map((i) => ({ i, s: nameScore(i.title, company) + (i.company_status === 'active' ? 0.1 : 0) }))
    .sort((a, b) => b.s - a.s)[0];
  if (!top || top.s < 0.85) return null;
  const num = top.i.company_number;
  const [prof, off] = await Promise.all([
    getJSON(`${base}/company/${num}`, { headers }),
    getJSON(`${base}/company/${num}/officers?items_per_page=15`, { headers }).catch(() => null),
  ]);
  if (!prof) return null;
  const a = prof.registered_office_address || {};
  return {
    source: 'Companies House',
    url: `https://find-and-update.company-information.service.gov.uk/company/${num}`,
    companyNumber: num,
    name: prof.company_name,
    status: prof.company_status,
    type: prof.type,
    incorporated: prof.date_of_creation || null,
    address: [a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country].filter(Boolean).join(', '),
    sicCodes: prof.sic_codes || [],
    officers: (off?.items || []).filter((o) => !o.resigned_on).slice(0, 8).map((o) => ({ name: o.name, role: o.officer_role, appointed: o.appointed_on })),
  };
}

// ------------------------------------------------------- OpenCorporates ----
export async function openCorporates(company, token, country) {
  const p = new URLSearchParams({ q: company, per_page: '8', api_token: token });
  if (country) p.set('country_code', country.toLowerCase());
  const d = await getJSON(`https://api.opencorporates.com/v0.4/companies/search?${p}`);
  const best = (d?.results?.companies || [])
    .map((x) => x.company)
    .map((c) => ({ c, s: nameScore(c.name, company) + (/active/i.test(c.current_status || '') ? 0.1 : 0) }))
    .sort((a, b) => b.s - a.s)[0];
  if (!best || best.s < 0.85) return null;
  const c = best.c;
  return {
    source: 'OpenCorporates',
    url: c.opencorporates_url,
    name: c.name,
    companyNumber: c.company_number,
    jurisdiction: c.jurisdiction_code,
    status: c.current_status || null,
    incorporated: c.incorporation_date || null,
    type: c.company_type || null,
    address: c.registered_address_in_full || null,
  };
}
