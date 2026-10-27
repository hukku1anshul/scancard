// Central configuration: merges per-request client settings (x-ci-config header,
// base64 JSON from the app's Settings screen) with server environment variables.

const ENV_MAP = {
  geminiKey: 'GEMINI_API_KEY',
  geminiModel: 'GEMINI_MODEL',
  tavilyKey: 'TAVILY_API_KEY',
  serpapiKey: 'SERPAPI_KEY',
  companiesHouseKey: 'COMPANIES_HOUSE_KEY',
  openCorporatesToken: 'OPENCORPORATES_TOKEN',
  dnbKey: 'DNB_KEY',
  dnbSecret: 'DNB_SECRET',
  apolloKey: 'APOLLO_API_KEY',
  pdlKey: 'PDL_API_KEY',
  hubspotToken: 'HUBSPOT_TOKEN',
  sfInstanceUrl: 'SF_INSTANCE_URL',
  sfAccessToken: 'SF_ACCESS_TOKEN',
};

export function resolveConfig(req) {
  let client = {};
  const raw = req.get('x-ci-config');
  if (raw) {
    try {
      client = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch { /* ignore malformed header */ }
  }
  const cfg = {};
  for (const [k, env] of Object.entries(ENV_MAP)) {
    const v = typeof client[k] === 'string' ? client[k].trim() : '';
    cfg[k] = v || process.env[env] || '';
  }
  cfg.geminiModel ||= 'gemini-2.5-flash';
  cfg.grounding = typeof client.grounding === 'boolean' ? client.grounding : process.env.GROUNDING !== 'off';
  return cfg;
}

export function searchProviderName(cfg) {
  return cfg.tavilyKey ? 'tavily' : cfg.serpapiKey ? 'serpapi' : 'duckduckgo+bing';
}

export function capabilities(cfg) {
  return {
    ok: true,
    gemini: Boolean(cfg.geminiKey),
    model: cfg.geminiModel,
    grounding: Boolean(cfg.geminiKey && cfg.grounding),
    search: searchProviderName(cfg),
    registries: ['gleif', 'wikidata', 'sec-edgar', cfg.companiesHouseKey && 'companies-house', cfg.openCorporatesToken && 'opencorporates'].filter(Boolean),
    providers: [cfg.dnbKey && cfg.dnbSecret && 'dnb', cfg.apolloKey && 'apollo', cfg.pdlKey && 'pdl'].filter(Boolean),
    crm: [cfg.hubspotToken && 'hubspot', cfg.sfInstanceUrl && cfg.sfAccessToken && 'salesforce'].filter(Boolean),
  };
}

/** Signature of enabled data sources — part of the cache key so new keys bust stale cache. */
export function providerSignature(cfg) {
  const c = capabilities(cfg);
  return [...c.registries, ...c.providers, c.grounding ? 'g' : ''].join(',');
}
