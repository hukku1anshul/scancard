// Premium data-provider adapters. Each activates only when its key is configured.
//  - D&B Direct+  : D-U-N-S match (cleanseMatch), firmographics, corporate linkage
//  - Apollo.io    : organisation + person enrichment
//  - People Data Labs: company + person enrichment
import { getJSON, enc } from './http.js';

// ------------------------------------------------------------ D&B Direct+ ----
let dnbToken = { value: null, exp: 0, key: null };

async function dnbAuth(key, secret) {
  if (dnbToken.value && dnbToken.key === key && Date.now() < dnbToken.exp) return dnbToken.value;
  const r = await fetch('https://plus.dnb.com/v2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`D&B auth ${r.status}: ${d?.error?.errorMessage || 'failed'}`);
  dnbToken = { value: d.access_token, exp: Date.now() + ((d.expiresIn || 3600) - 120) * 1000, key };
  return d.access_token;
}

const dnbAddr = (a) =>
  a ? [a.streetAddress?.line1, a.streetAddress?.line2, a.addressLocality?.name, a.addressRegion?.abbreviatedName || a.addressRegion?.name, a.postalCode, a.addressCountry?.isoAlpha2Code].filter(Boolean).join(', ') : null;
const linkOrg = (o) => (o?.duns ? { duns: o.duns, name: o.primaryName, country: o.primaryAddress?.addressCountry?.isoAlpha2Code || null } : null);

export async function dnb(card, cfg, country) {
  const token = await dnbAuth(cfg.dnbKey, cfg.dnbSecret);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const p = new URLSearchParams({ name: card.company || card.domain || '', countryISOAlpha2Code: country || 'US', candidateMaximumQuantity: '3' });
  if (card.website) p.set('url', card.website);
  const phone = card.phones?.[0]?.number?.replace(/[^\d]/g, '');
  if (phone) p.set('telephoneNumber', phone);
  const m = await getJSON(`https://plus.dnb.com/v1/match/cleanseMatch?${p}`, { headers });
  const cand = m?.matchCandidates?.[0];
  if (!cand) return null;
  const confidenceCode = cand.matchQualityInformation?.confidenceCode ?? null;
  const duns = cand.organization?.duns;
  // D&B guidance: confidence codes 8-10 are high quality; < 6 needs review.
  if (confidenceCode !== null && confidenceCode < 6) {
    return { source: 'D&B Direct+', lowConfidence: true, duns, name: cand.organization?.primaryName, confidenceCode };
  }
  const data = await getJSON(`https://plus.dnb.com/v1/data/duns/${duns}?blockIDs=companyinfo_L2_v1,hierarchyconnections_L1_v1`, { headers }).catch((e) => ({ error: e.message }));
  const org = data?.organization || cand.organization || {};
  const link = org.corporateLinkage || {};
  const rev = org.financials?.[0]?.yearlyRevenue?.[0];
  return {
    source: 'D&B Direct+',
    duns,
    confidenceCode,
    name: org.primaryName,
    tradeStyles: (org.tradeStyleNames || []).map((t) => t.name).slice(0, 4),
    address: dnbAddr(org.primaryAddress),
    phone: org.telephone?.[0]?.telephoneNumber || null,
    website: org.websiteAddress?.[0]?.url || null,
    operatingStatus: org.dunsControlStatus?.operatingStatus?.description || null,
    startDate: org.startDate || null,
    incorporatedDate: org.incorporatedDate || null,
    legalForm: org.registeredDetails?.legalForm?.description || org.businessEntityType?.description || null,
    employees: org.numberOfEmployees?.[0]?.value ?? null,
    revenue: rev ? { amount: rev.value, currency: rev.currency } : null,
    industryCodes: (org.industryCodes || []).slice(0, 4).map((c) => `${c.typeDescription || ''} ${c.code} — ${c.description}`.trim()),
    familyTree: {
      parent: linkOrg(link.parent),
      headquarter: linkOrg(link.headQuarter),
      domesticUltimate: linkOrg(link.domesticUltimate),
      globalUltimate: linkOrg(link.globalUltimate),
      familyTreeMembers: link.globalUltimateFamilyTreeMembersCount ?? null,
      role: (link.familytreeRolesPlayed || []).map((r) => r.description).join(', ') || null,
    },
    dataError: data?.error || null,
  };
}

// --------------------------------------------------------------- Apollo ----
const apolloHeaders = (key) => ({ 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });

export async function apolloOrg(domain, key) {
  const d = await getJSON(`https://api.apollo.io/api/v1/organizations/enrich?domain=${enc(domain)}`, { headers: apolloHeaders(key) });
  const o = d?.organization;
  if (!o) return null;
  return {
    source: 'Apollo',
    name: o.name,
    website: o.website_url,
    linkedin: o.linkedin_url,
    twitter: o.twitter_url,
    facebook: o.facebook_url,
    founded: o.founded_year,
    employees: o.estimated_num_employees,
    revenue: o.annual_revenue_printed || o.annual_revenue || null,
    industry: o.industry,
    keywords: (o.keywords || []).slice(0, 15),
    hq: [o.city, o.state, o.country].filter(Boolean).join(', '),
    description: o.short_description,
    technologies: (o.technology_names || []).slice(0, 20),
    totalFunding: o.total_funding_printed || null,
    latestFundingStage: o.latest_funding_stage || null,
    ticker: o.publicly_traded_symbol || null,
  };
}

export async function apolloPerson(card, key) {
  const body = {
    first_name: card.firstName || undefined,
    last_name: card.lastName || undefined,
    organization_name: card.company || undefined,
    domain: card.domain || undefined,
    email: card.emails?.[0] || undefined,
    linkedin_url: card.socials?.linkedin || undefined,
  };
  const r = await fetch('https://api.apollo.io/api/v1/people/match', { method: 'POST', headers: apolloHeaders(key), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Apollo ${r.status}: ${d?.error || ''}`);
  const p = d.person;
  if (!p) return null;
  return {
    source: 'Apollo',
    matchedBy: body.email ? 'email' : body.linkedin_url ? 'linkedin' : 'name+company',
    name: p.name,
    title: p.title,
    headline: p.headline,
    seniority: p.seniority,
    departments: p.departments || [],
    linkedinUrl: p.linkedin_url || null,
    location: [p.city, p.state, p.country].filter(Boolean).join(', '),
    employmentHistory: (p.employment_history || []).slice(0, 6).map((e) => ({ company: e.organization_name, title: e.title, start: e.start_date, end: e.end_date, current: !!e.current })),
  };
}

// ------------------------------------------------------ People Data Labs ----
const withProto = (u) => (u ? (/^https?:/.test(u) ? u : `https://${u}`) : null);

export async function pdlCompany(domain, key) {
  const d = await getJSON(`https://api.peopledatalabs.com/v5/company/enrich?website=${enc(domain)}`, { headers: { 'X-Api-Key': key } });
  if (!d || d.status !== 200) return null;
  return {
    source: 'People Data Labs',
    name: d.display_name || d.name,
    founded: d.founded,
    employees: d.employee_count,
    size: d.size,
    industry: d.industry,
    hq: d.location?.name,
    linkedin: withProto(d.linkedin_url),
    twitter: withProto(d.twitter_url),
    tags: (d.tags || []).slice(0, 15),
    summary: d.summary,
    type: d.type,
    ticker: d.ticker || null,
  };
}

export async function pdlPerson(card, key) {
  const p = new URLSearchParams({ min_likelihood: '6' });
  if (card.socials?.linkedin) p.set('profile', card.socials.linkedin);
  if (card.emails?.[0]) p.set('email', card.emails[0]);
  if (card.fullName) p.set('name', card.fullName);
  if (card.company) p.set('company', card.company);
  const d = await getJSON(`https://api.peopledatalabs.com/v5/person/enrich?${p}`, { headers: { 'X-Api-Key': key } });
  const x = d?.data;
  if (!x) return null;
  return {
    source: 'People Data Labs',
    matchedBy: card.emails?.[0] ? 'email' : card.socials?.linkedin ? 'linkedin' : 'name+company',
    likelihood: d.likelihood,
    name: x.full_name,
    title: x.job_title,
    seniority: (x.job_title_levels || []).join(', ') || null,
    linkedinUrl: withProto(x.linkedin_url),
    location: x.location_name || null,
    skills: (x.skills || []).slice(0, 12),
    employmentHistory: (x.experience || []).slice(0, 6).map((e) => ({ company: e.company?.name, title: e.title?.name, start: e.start_date, end: e.end_date, current: !!e.is_primary })),
  };
}
