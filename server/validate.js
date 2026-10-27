// Contact-data validation: email syntax + MX records, phone numbers (libphonenumber), domain DNS, and Indian PIN/GST/CIN checks.
import dns from 'node:dns/promises';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { FREE_MAIL } from './extract.js';
import { decodePinCode } from './india.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com']);

const TLD_COUNTRY = {
  uk: 'GB', in: 'IN', de: 'DE', fr: 'FR', au: 'AU', ca: 'CA', jp: 'JP', sg: 'SG', ae: 'AE', nl: 'NL', es: 'ES', it: 'IT', br: 'BR',
  mx: 'MX', za: 'ZA', nz: 'NZ', ie: 'IE', ch: 'CH', se: 'SE', no: 'NO', dk: 'DK', fi: 'FI', cn: 'CN', hk: 'HK', kr: 'KR', be: 'BE',
  at: 'AT', pl: 'PL', pt: 'PT', il: 'IL', sa: 'SA', my: 'MY', id: 'ID', ph: 'PH', th: 'TH', vn: 'VN', tw: 'TW', tr: 'TR', ar: 'AR', cl: 'CL', co: 'CO',
};
const ADDRESS_COUNTRY = [
  [/\b(usa|united states|u\.s\.a?\.?)\b|\b[A-Z]{2}\s\d{5}(-\d{4})?\b/i, 'US'],
  [/united kingdom|\bU\.?K\.?\b|england|scotland|wales|london\b|[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b/i, 'GB'],
  [
    /\bindia\b|bharat|bengaluru|bangalore|mumbai|navi mumbai|thane|new delhi|delhi ncr|hyderabad|secunderabad|chennai|pune|pimpri|chinchwad|gurugram|gurgaon|noida|greater noida|faridabad|ghaziabad|ahmedabad|surat|vadodara|baroda|rajkot|gandhinagar|vapi|ankleshwar|morbi|jaipur|udaipur|jodhpur|kota|bhiwadi|ludhiana|jalandhar|amritsar|chandigarh|mohali|panchkula|baddi|coimbatore|madurai|tiruppur|hosur|salem|tiruchirappalli|visakhapatnam|vizag|vijayawada|guntur|kochi|cochin|thiruvananthapuram|trivandrum|kozhikode|thrissur|kolkata|calcutta|howrah|durgapur|siliguri|bhubaneswar|cuttack|rourkela|indore|bhopal|gwalior|jabalpur|pithampur|nagpur|nashik|aurangabad|chhatrapati sambhajinagar|kolhapur|solapur|satara|lucknow|kanpur|agra|varanasi|prayagraj|meerut|dehradun|haridwar|roorkee|patna|ranchi|jamshedpur|dhanbad|bokaro|raipur|bhilai|guwahati|goa|panaji|maharashtra|karnataka|tamil nadu|telangana|gujarat|rajasthan|uttar pradesh|haryana|punjab|kerala|west bengal|madhya pradesh|andhra pradesh|odisha|bihar|jharkhand|chhattisgarh|assam|uttarakhand|himachal pradesh/i,
    'IN',
  ],
  [/\bcanada\b|ontario|quebec|british columbia|alberta/i, 'CA'],
  [/australia|new south wales|victoria, au|queensland|sydney|melbourne/i, 'AU'],
  [/germany|deutschland|berlin|münchen|munich|frankfurt|hamburg/i, 'DE'],
  [/\bfrance\b|paris\b/i, 'FR'],
  [/singapore/i, 'SG'],
  [/netherlands|nederland|amsterdam|rotterdam/i, 'NL'],
  [/\buae\b|united arab emirates|dubai|abu dhabi/i, 'AE'],
  [/\bjapan\b|tokyo|osaka/i, 'JP'],
  [/ireland|dublin/i, 'IE'],
  [/switzerland|zürich|zurich|geneva/i, 'CH'],
  [/\bspain\b|españa|madrid|barcelona/i, 'ES'],
  [/\bitaly\b|italia|milan|milano|rome\b/i, 'IT'],
];

export function inferCountry(card) {
  if (card.gstin || card.cin) return 'IN';
  if (card.address) {
    for (const [re, cc] of ADDRESS_COUNTRY) if (re.test(card.address)) return cc;
    if (decodePinCode(card.address)) return 'IN';
  }
  for (const p of card.phones || []) {
    if (p.number?.trim().startsWith('+')) {
      const ph = parsePhoneNumberFromString(p.number);
      if (ph?.country) return ph.country;
    }
  }
  const tld = card.domain?.split('.').pop();
  if (tld && TLD_COUNTRY[tld]) return TLD_COUNTRY[tld];
  return null;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);

const mxCache = new Map();
async function mxLookup(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let res;
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    res = mx.length ? { ok: true, host: mx.sort((a, b) => a.priority - b.priority)[0].exchange } : { ok: false };
  } catch (e) {
    res = ['ENODATA', 'ENOTFOUND'].includes(e.code) ? { ok: false } : { ok: null };
  }
  mxCache.set(domain, res);
  return res;
}

export async function validateCard(card) {
  const country = inferCountry(card);

  const emails = await Promise.all(
    (card.emails || []).map(async (value) => {
      const syntax = EMAIL_RE.test(value);
      const domain = value.split('@')[1]?.toLowerCase() || '';
      const mx = syntax ? await mxLookup(domain) : { ok: false };
      return {
        value,
        syntax,
        mx: mx.ok,
        mxHost: mx.host || null,
        freeMail: FREE_MAIL.has(domain),
        disposable: DISPOSABLE.has(domain),
        matchesCompanyDomain: !!(card.domain && (domain === card.domain || domain.endsWith('.' + card.domain))),
        status: !syntax ? 'invalid' : mx.ok === false ? 'no-mx' : mx.ok ? 'valid' : 'unknown',
      };
    }),
  );

  const phones = (card.phones || []).map((p) => {
    const ph = parsePhoneNumberFromString(p.number, country || undefined);
    if (!ph) return { value: p.number, valid: false, status: 'invalid', e164: null, international: null, country: null, lineType: null };
    const valid = ph.isValid();
    return {
      value: p.number,
      e164: ph.number,
      international: ph.formatInternational(),
      country: ph.country || null,
      lineType: p.type === 'whatsapp' ? 'WHATSAPP' : ph.getType() || null,
      valid,
      status: valid ? 'valid' : ph.isPossible() ? 'possible' : 'invalid',
    };
  });

  let website = null;
  if (card.domain) {
    try {
      await withTimeout(dns.lookup(card.domain), 4000);
      website = { domain: card.domain, resolves: true };
    } catch {
      website = { domain: card.domain, resolves: false };
    }
  }
  return { country, emails, phones, website };
}
