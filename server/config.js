// Central server configuration: all API keys, models, search providers,
// registries, CRM tokens, and default event/company settings are loaded
// centrally from the server environment (e.g., Render Environment Variables)
// so individual app users are never asked to enter their own API keys.

const ENV_ALIASES = {
  geminiKey: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_KEY', 'VITE_GEMINI_API_KEY'],
  geminiModel: ['GEMINI_MODEL'],
  tavilyKey: ['TAVILY_API_KEY', 'TAVILY_KEY'],
  serpapiKey: ['SERPAPI_KEY', 'SERP_API_KEY', 'SERPER_API_KEY'],
  companiesHouseKey: ['COMPANIES_HOUSE_KEY', 'COMPANIES_HOUSE_API_KEY'],
  openCorporatesToken: ['OPENCORPORATES_TOKEN', 'OPENCORPORATES_API_KEY'],
  dnbKey: ['DNB_KEY', 'DNB_API_KEY'],
  dnbSecret: ['DNB_SECRET', 'DNB_API_SECRET'],
  apolloKey: ['APOLLO_API_KEY', 'APOLLO_KEY'],
  pdlKey: ['PDL_API_KEY', 'PDL_KEY'],
  hubspotToken: ['HUBSPOT_TOKEN', 'HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_API_KEY'],
  sfInstanceUrl: ['SF_INSTANCE_URL', 'SALESFORCE_INSTANCE_URL'],
  sfAccessToken: ['SF_ACCESS_TOKEN', 'SALESFORCE_ACCESS_TOKEN'],
};

const SERVER_DEFAULTS_ENV = {
  defaultEvent: ['DEFAULT_EVENT', 'ACTIVE_EVENT'],
  senderName: ['SENDER_NAME', 'DEFAULT_SENDER_NAME'],
  senderCompany: ['SENDER_COMPANY', 'COMPANY_NAME', 'DEFAULT_SENDER_COMPANY'],
  senderPhone: ['SENDER_PHONE', 'DEFAULT_SENDER_PHONE'],
  senderEmail: ['SENDER_EMAIL', 'DEFAULT_SENDER_EMAIL'],
  senderWebsite: ['SENDER_WEBSITE', 'COMPANY_WEBSITE', 'DEFAULT_SENDER_WEBSITE'],
  senderLinkedin: ['SENDER_LINKEDIN', 'DEFAULT_SENDER_LINKEDIN'],
  senderGstin: ['SENDER_GSTIN', 'COMPANY_GSTIN', 'DEFAULT_SENDER_GSTIN'],
};

/** Clean env value (strips accidental surrounding quotes or whitespace when pasted into Render dashboard). */
function readEnv(keys) {
  for (const k of keys) {
    const raw = process.env[k];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim().replace(/^['"]+|['"]+$/g, '').trim();
    }
  }
  return '';
}

export function resolveConfig(_req) {
  const cfg = {};
  for (const [k, aliases] of Object.entries(ENV_ALIASES)) {
    cfg[k] = readEnv(aliases);
  }
  const legacyModels = new Set(['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);
  if (!cfg.geminiModel || legacyModels.has(cfg.geminiModel.toLowerCase())) {
    cfg.geminiModel = 'gemini-3-flash-preview';
  }
  const groundingEnv = readEnv(['GROUNDING', 'GEMINI_GROUNDING']).toLowerCase();
  cfg.grounding = groundingEnv !== 'off' && groundingEnv !== 'false' && groundingEnv !== '0';

  const defaults = {};
  for (const [k, aliases] of Object.entries(SERVER_DEFAULTS_ENV)) {
    defaults[k] = readEnv(aliases);
  }
  const eventModeEnv = readEnv(['EVENT_MODE']).toLowerCase();
  defaults.eventMode = eventModeEnv === 'on' || eventModeEnv === 'true' || eventModeEnv === '1';
  const autoGeoEnv = readEnv(['AUTO_GEO']).toLowerCase();
  defaults.autoGeo = autoGeoEnv !== 'off' && autoGeoEnv !== 'false' && autoGeoEnv !== '0';

  cfg.defaults = defaults;
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
    registries: ['india-mca-gst', 'gleif', 'wikidata', 'sec-edgar', cfg.companiesHouseKey && 'companies-house', cfg.openCorporatesToken && 'opencorporates'].filter(Boolean),
    providers: [cfg.dnbKey && cfg.dnbSecret && 'dnb', cfg.apolloKey && 'apollo', cfg.pdlKey && 'pdl'].filter(Boolean),
    crm: [cfg.hubspotToken && 'hubspot', cfg.sfInstanceUrl && cfg.sfAccessToken && 'salesforce'].filter(Boolean),
    defaults: cfg.defaults || {},
  };
}

/** Signature of enabled data sources — part of the cache key so new keys bust stale cache. */
export function providerSignature(cfg) {
  const c = capabilities(cfg);
  return [...c.registries, ...c.providers, c.grounding ? 'g' : ''].join(',');
}
