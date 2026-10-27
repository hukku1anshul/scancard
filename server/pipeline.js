import { extractCard, normalizeCard } from './extract.js';
import { crawlSite } from './crawl.js';
import { webSearch } from './search.js';
import { geminiGrounded } from './gemini.js';
import { synthesize, findGaps, refine, finalize } from './synthesize.js';
import { gleif, wikidata, secEdgar, companiesHouse, openCorporates } from './registries.js';
import { buildIndiaRegistryRecord } from './india.js';
import { dnb, apolloOrg, apolloPerson, pdlCompany, pdlPerson } from './providers.js';
import { validateCard, inferCountry } from './validate.js';
import { companyCacheKey, cacheSet, cacheGet } from './cache.js';
import { searchProviderName, providerSignature } from './config.js';
import { settle, ok } from './http.js';
import { runDemo } from './demo.js';

const NON_OFFICIAL = /(linkedin|facebook|twitter|x\.com|instagram|youtube|wikipedia|dnb\.com|zoominfo|crunchbase|bloomberg|glassdoor|indeed|yelp|apollo\.io|rocketreach|opencorporates|craft\.co|owler|pitchbook|amazon|justdial|indiamart|tradeindia|tofler|zaubacorp|falconebiz|thecompanycheck|cleartax)/i;

/**
 * Full scan + enrichment pipeline. Emits NDJSON events via `emit`.
 */
export async function runScan(body, cfg, emit, isClosed = () => false) {
  if (!cfg.geminiKey) return runDemo(body, emit);

  const step = (id, status, detail) => emit({ type: 'step', step: id, status, detail });

  // 1) Card extraction ------------------------------------------------------
  let card;
  if (body.card) {
    card = normalizeCard(body.card);
    step('extract', 'done', 'Using edited card details');
  } else {
    step('extract', 'running', 'Gemini Vision is reading the scan…');
    card = await extractCard(body.images, cfg, body.scanMode);
    step('extract', 'done', [card.fullName, card.company].filter(Boolean).join(' · ') || 'Scan parsed');
  }
  emit({ type: 'card', card });

  if (!card.company && !card.domain && !card.fullName) {
    throw new Error("Couldn't read a name, company or website from this card. Try a sharper, well-lit photo.");
  }
  if (isClosed()) return;

  const evidence = { provider: searchProviderName(cfg), searches: {}, crawl: null, registry: {}, providers: { company: {}, person: {} }, research: {}, validation: null, cachedAt: null };
  const validationP = validateCard(card).then((v) => (evidence.validation = v)).catch(() => null);

  // 2) Resolve website if missing (needed for cache key + crawl) ------------
  const company = () => card.company || card.domain;
  if (!card.website && card.company) {
    step('website', 'running', 'Finding the official website…');
    const res = await webSearch(`${card.company} official website`, cfg, 6);
    const hit = res.find((r) => r.url && !NON_OFFICIAL.test(r.url));
    if (hit) {
      card.website = new URL(hit.url).origin;
      card.domain = new URL(card.website).hostname.replace(/^www\./, '');
      emit({ type: 'card', card });
    }
  }
  const country = inferCountry(card);

  // 3) Company-level cache ----------------------------------------------------
  const cacheKey = companyCacheKey(card, providerSignature(cfg));
  const cached = body.refresh ? null : await cacheGet(cacheKey);
  if (cached) {
    const c = cached.data;
    Object.assign(evidence, { crawl: c.crawl, registry: c.registry, cachedAt: new Date(cached.ts).toISOString() });
    evidence.providers.company = c.providersCompany || {};
    evidence.searches.registry = c.searchesRegistry || [];
    evidence.searches.market = c.searchesMarket || [];
    if (c.researchCompany) evidence.research.company = c.researchCompany;
    const ago = Math.max(1, Math.round((Date.now() - cached.ts) / 3600000));
    for (const id of ['website', 'registry', 'market']) step(id, 'done', `From cache (${ago}h old) — use Refresh for live data`);
  }

  const runQueries = async (queries) => Promise.all(queries.map(async (query) => ({ query, results: await webSearch(query, cfg, 6) })));
  const count = (groups) => groups.reduce((a, g) => a + g.results.length, 0);
  const co = `"${company()}"`;
  const tasks = [];

  if (!cached) {
    // Website crawl
    tasks.push((async () => {
      if (!card.website) return step('website', 'skipped', 'No website found on card or via search');
      step('website', 'running', `Crawling ${card.domain}`);
      evidence.crawl = await crawlSite(card.website);
      if (evidence.crawl) step('website', 'done', `Read ${evidence.crawl.pages.length} page(s) on ${new URL(evidence.crawl.origin).hostname}`);
      else step('website', 'error', `Could not load ${card.website} (blocked or offline)`);
    })().catch((e) => step('website', 'error', e.message)));

    // Registries + company data providers + registry searches
    tasks.push((async () => {
      const isIndia = country === 'IN' || Boolean(card.gstin || card.cin);
      step('registry', 'running', 'Querying GLEIF, Wikidata' + (isIndia ? ', India MCA/GST' : ', SEC EDGAR') + (cfg.dnbKey ? ', D&B' : '') + '…');
      const name = company();
      const wd = await settle(wikidata(name, card.domain));
      const tickers = ok(wd) ? wd.stockExchanges.map((s) => s.ticker).filter(Boolean) : [];
      const regQueries = [
        `${co} ${card.domain || ''} company profile headquarters employees revenue`.trim(),
        isIndia
          ? `${co} CIN GSTIN directors paid up capital site:zaubacorp.com OR site:tofler.in OR site:indiamart.com`
          : `${co} site:dnb.com`,
        `${co} site:opencorporates.com OR site:crunchbase.com`,
      ];
      const [gl, sec, ch, oc, dnbR, ap, pdl, searches] = await Promise.all([
        settle(gleif(name, country, ok(wd) ? wd.lei : null)),
        ok(wd) && (wd.secCik || tickers.length) ? settle(secEdgar(name, { cik: wd.secCik, tickers })) : !country || country === 'US' ? settle(secEdgar(name)) : null,
        cfg.companiesHouseKey && (!country || country === 'GB') ? settle(companiesHouse(name, cfg.companiesHouseKey)) : null,
        cfg.openCorporatesToken ? settle(openCorporates(name, cfg.openCorporatesToken, country)) : null,
        cfg.dnbKey && cfg.dnbSecret ? settle(dnb(card, cfg, country)) : null,
        cfg.apolloKey && card.domain ? settle(apolloOrg(card.domain, cfg.apolloKey)) : null,
        cfg.pdlKey && card.domain ? settle(pdlCompany(card.domain, cfg.pdlKey)) : null,
        runQueries(regQueries),
      ]);
      const indiaReg = isIndia ? buildIndiaRegistryRecord(card, searches) : null;
      if (indiaReg?.cin && !card.cin) card.cin = indiaReg.cin;
      if (indiaReg?.gstin && !card.gstin) card.gstin = indiaReg.gstin;
      evidence.registry = { wikidata: wd, gleif: gl, sec, companiesHouse: ch, openCorporates: oc, dnb: dnbR, india: indiaReg };
      evidence.providers.company = { apollo: ap, pdl };
      evidence.searches.registry = searches;
      const matched = [
        ['India MCA/GST', indiaReg], ['D&B', dnbR], ['GLEIF', gl], ['Wikidata', wd], ['SEC', sec], ['Companies House', ch], ['OpenCorporates', oc], ['Apollo', ap], ['PDL', pdl],
      ].filter(([, v]) => ok(v)).map(([k]) => k);
      const errs = [['D&B', dnbR], ['Apollo', ap], ['PDL', pdl], ['Companies House', ch], ['OpenCorporates', oc]].filter(([, v]) => v?.error).map(([k]) => k);
      step('registry', matched.length || count(searches) ? 'done' : 'error',
        `${matched.length ? `Verified: ${matched.join(', ')}` : 'No registry match'} · ${count(searches)} web results${errs.length ? ` · failed: ${errs.join(', ')}` : ''}`);
    })().catch((e) => step('registry', 'error', e.message)));

    // Market searches
    tasks.push((async () => {
      step('market', 'running', 'Finding customers, case studies & news');
      const year = new Date().getFullYear();
      evidence.searches.market = await runQueries([`${co} customers case study clients`, `${co} products services`, `${co} news ${year}`]);
      const n = count(evidence.searches.market);
      step('market', n ? 'done' : 'error', n ? `${n} result(s) via ${evidence.provider}` : 'No results (search may be rate-limited)');
    })().catch((e) => step('market', 'error', e.message)));
  }

  // Social + person providers (never cached: person-specific)
  tasks.push((async () => {
    step('social', 'running', 'Searching LinkedIn & social profiles' + (cfg.apolloKey || cfg.pdlKey ? ' + people data' : ''));
    const queries = [
      `${co} site:linkedin.com/company`,
      card.fullName && `"${card.fullName}" ${co} site:linkedin.com/in`,
      card.fullName && `"${card.fullName}" ${co}`,
    ].filter(Boolean);
    const [searches, ap, pdl] = await Promise.all([
      runQueries(queries),
      cfg.apolloKey && card.fullName ? settle(apolloPerson(card, cfg.apolloKey)) : null,
      cfg.pdlKey && card.fullName ? settle(pdlPerson(card, cfg.pdlKey)) : null,
    ]);
    evidence.searches.social = searches;
    evidence.providers.person = { apollo: ap, pdl };
    const extra = [ok(ap) && 'Apollo', ok(pdl) && 'PDL'].filter(Boolean);
    const n = count(searches);
    step('social', n || extra.length ? 'done' : 'error', `${n} result(s)${extra.length ? ` · person matched: ${extra.join(', ')}` : ''}`);
  })().catch((e) => step('social', 'error', e.message)));

  // Google Search grounded research
  tasks.push((async () => {
    if (!cfg.grounding) return step('research', 'skipped', 'Google Search grounding disabled in Settings');
    step('research', 'running', 'Gemini + Google Search deep research…');
    const isIndia = country === 'IN' || Boolean(card.gstin || card.cin);
    const where = [
      card.domain && `website ${card.domain}`,
      country && `country ${country}`,
      card.gstin && `GSTIN ${card.gstin}`,
      card.cin && `CIN ${card.cin}`,
    ].filter(Boolean).join(', ');
    const [coR, peR] = await Promise.all([
      evidence.research.company
        ? evidence.research.company
        : settle(geminiGrounded({
            apiKey: cfg.geminiKey,
            model: cfg.geminiModel,
            prompt: `Research the company "${company()}"${where ? ` (${where})` : ''} using Google Search. Report concise bullet points with dates and figures:
1) What they do: products and services
2) Target customers / industries, and named customers or case studies
3) Headquarters, founding year, employee count, revenue or funding (${isIndia ? 'include INR ₹ Cr / Lakh figures, MCA CIN, GSTIN, paid-up capital, directors, and BSE/NSE ticker if Indian' : 'include currency'}), ownership / parent company
4) Notable news from the last 12 months
5) LinkedIn company page URL and other official social profiles
6) Main competitors
If a result may refer to a different company with a similar name, say so explicitly.`,
          })),
      card.fullName
        ? settle(geminiGrounded({
            apiKey: cfg.geminiKey,
            model: cfg.geminiModel,
            prompt: `Using Google Search, find public professional information about ${card.fullName}${card.jobTitle ? `, ${card.jobTitle}` : ''} at ${company()}${card.domain ? ` (${card.domain})` : ''}.
Report: current role and responsibilities, previous roles / DIN directorships, LinkedIn profile URL, talks / articles / press mentions, education if public.
Only include information that clearly refers to this person at this company; state uncertainty otherwise. Bullet points.`,
          }))
        : null,
    ]);
    evidence.research.company = coR;
    if (peR) evidence.research.person = peR;
    const srcs = [coR, peR].filter(ok).reduce((a, r) => a + r.sources.length, 0);
    const failed = [coR, peR].filter((r) => r?.error);
    step('research', [coR, peR].some(ok) ? 'done' : 'error', failed.length && !srcs ? failed[0].error : `${srcs} grounded source(s)${cached ? ' (company research cached)' : ''}`);
  })().catch((e) => step('research', 'error', e.message)));

  await Promise.all(tasks);
  await validationP;
  if (isClosed()) return;

  // Save company-level evidence to cache
  if (!cached && cacheKey && (evidence.crawl || Object.values(evidence.registry).some(ok))) {
    await cacheSet(cacheKey, {
      crawl: evidence.crawl,
      registry: evidence.registry,
      providersCompany: evidence.providers.company,
      searchesRegistry: evidence.searches.registry,
      searchesMarket: evidence.searches.market,
      researchCompany: ok(evidence.research.company) ? evidence.research.company : null,
    });
  }

  // 4) AI synthesis -------------------------------------------------------------
  step('synthesize', 'running', 'Building 360° dossier with Gemini…');
  let dossier = await synthesize(card, evidence, cfg);
  step('synthesize', 'done', 'Draft dossier ready');

  // 5) Gap-filling follow-up research -----------------------------------------
  const gaps = findGaps(dossier, card);
  if (!gaps.length) step('gapfill', 'skipped', 'No important gaps');
  else if (!cfg.grounding) step('gapfill', 'skipped', `Gaps: ${gaps.join(', ')} (enable grounding to fill)`);
  else if (!isClosed()) {
    step('gapfill', 'running', `Looking for: ${gaps.join(', ')}`);
    const r = await settle(geminiGrounded({
      apiKey: cfg.geminiKey,
      model: cfg.geminiModel,
      prompt: `Using Google Search, find the following missing facts about the company "${company()}"${card.domain ? ` (${card.domain})` : ''}${card.fullName ? ` and its employee ${card.fullName} (${card.jobTitle || 'role unknown'})` : ''}:
${gaps.map((g) => `- ${g}`).join('\n')}
Answer each item with facts and dates, or "not found". Ignore results about different companies or people with similar names.`,
    }));
    if (ok(r) && r.text) {
      evidence.research.gapFill = r;
      const refined = await settle(refine(dossier, r, cfg));
      if (ok(refined)) dossier = refined;
      const remaining = findGaps(dossier, card);
      step('gapfill', 'done', `Filled ${gaps.length - remaining.length}/${gaps.length} gap(s) using ${r.sources.length} source(s)`);
    } else {
      step('gapfill', 'error', r?.error || 'No additional information found');
    }
  }

  dossier = finalize(dossier, card, evidence);
  emit({ type: 'card', card });
  emit({ type: 'result', dossier, demo: false });
}
