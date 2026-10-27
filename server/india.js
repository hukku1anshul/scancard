// Indian market intelligence: GSTIN & MCA CIN extraction/decoding, 6-digit PIN code state mapping,
// Indian multi-phone slash expansion, and MCA / ZaubaCorp / Tofler / IndiaMART / NSE-BSE search enrichment.

export const GST_STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export const CIN_STATES = {
  AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
  BR: 'Bihar', CH: 'Chandigarh', CT: 'Chhattisgarh', DD: 'Daman & Diu',
  DL: 'Delhi', DN: 'Dadra & Nagar Haveli', GA: 'Goa', GJ: 'Gujarat',
  HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu & Kashmir',
  KA: 'Karnataka', KL: 'Kerala', LD: 'Lakshadweep', MH: 'Maharashtra',
  ML: 'Meghalaya', MN: 'Manipur', MP: 'Madhya Pradesh', MZ: 'Mizoram',
  NL: 'Nagaland', OR: 'Odisha', PB: 'Punjab', PY: 'Puducherry',
  RJ: 'Rajasthan', SK: 'Sikkim', TG: 'Telangana', TN: 'Tamil Nadu',
  TR: 'Tripura', TS: 'Telangana', UK: 'Uttarakhand', UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

const PAN_ENTITY_TYPE = {
  C: 'Company (Pvt Ltd / Public Ltd)',
  F: 'Partnership Firm / LLP',
  P: 'Proprietorship / Individual',
  H: 'Hindu Undivided Family (HUF)',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government Agency',
};

const CIN_OWNERSHIP = {
  PTC: 'Private Limited Company (Pvt. Ltd.)',
  PLC: 'Public Limited Company (Ltd.)',
  OPC: 'One Person Company (OPC)',
  GOI: 'Government of India Company (PSU)',
  SGC: 'State Government Company',
  FTC: 'Subsidiary of Foreign Company',
  GAP: 'General Association Public',
  GAT: 'General Association Private',
  NPL: 'Section 8 Non-Profit Company',
  ULL: 'Unlimited Liability Public Co.',
  ULT: 'Unlimited Liability Private Co.',
};

const NIC_SECTORS = {
  '01': 'Agriculture & Crop Production',
  '10': 'Food Products Manufacturing',
  '13': 'Textiles Manufacturing',
  '14': 'Apparel & Garments',
  '20': 'Chemicals & Chemical Products',
  '21': 'Pharmaceuticals & Medicinal Products',
  '22': 'Rubber & Plastics Products',
  '24': 'Basic Metals & Steel',
  '25': 'Fabricated Metal Products',
  '26': 'Computer, Electronic & Optical Products',
  '27': 'Electrical Equipment Manufacturing',
  '28': 'Machinery & Industrial Equipment',
  '29': 'Motor Vehicles & Auto Components',
  '30': 'Transport & Aerospace Equipment',
  '35': 'Electricity, Gas, Solar & Power Supply',
  '41': 'Real Estate & Building Construction',
  '42': 'Civil Engineering & Infrastructure',
  '45': 'Wholesale & Retail Automotive Trade',
  '46': 'B2B Wholesale Trade & Distribution',
  '47': 'Retail Trade',
  '49': 'Land Transport & Logistics',
  '52': 'Warehousing & Logistics Support',
  '58': 'Publishing & Digital Media',
  '61': 'Telecommunications',
  '62': 'IT Software, SaaS & Consultancy',
  '63': 'Information Services, Data & Cloud Portals',
  '64': 'Financial Services & FinTech',
  '66': 'Insurance & Financial Advisory',
  '68': 'Real Estate Activities',
  '70': 'Management Consultancy & Head Offices',
  '71': 'Architecture, Engineering & Technical Testing',
  '72': 'IT / Scientific R&D & Software Services',
  '73': 'Advertising, Marketing & Market Research',
  '74': 'Design, Industrial & Specialized Services',
  '82': 'Business Support & Event Services',
  '85': 'Education & EdTech',
  '86': 'Healthcare & Hospitals',
};

const GSTIN_RE = /\b([0-3]\d)([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])\b/i;
const CIN_RE = /\b([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})\b/i;
const LLPIN_RE = /\b([A-Z]{3}-\d{4})\b/;

export function extractIndianIdsFromText(text = '') {
  if (!text) return { gstin: null, cin: null };
  const compact = String(text).replace(/\s+/g, ' ');
  const gstMatch = compact.match(GSTIN_RE);
  const cinMatch = compact.match(CIN_RE);
  const llpMatch = !cinMatch ? compact.match(/LLPIN\s*[:#-]?\s*([A-Z]{3}-\d{4})/i) : null;
  return {
    gstin: gstMatch ? gstMatch[0].toUpperCase() : null,
    cin: cinMatch ? cinMatch[0].toUpperCase() : llpMatch ? llpMatch[1].toUpperCase() : null,
  };
}

export function decodeGstin(gstin) {
  if (!gstin) return null;
  const clean = String(gstin).replace(/\s+/g, '').toUpperCase();
  const m = clean.match(GSTIN_RE);
  if (!m) return null;
  const stateCode = m[1];
  const pan = m[2];
  const entityChar = pan[3];
  return {
    gstin: clean,
    stateCode,
    state: GST_STATES[stateCode] || null,
    pan,
    constitution: PAN_ENTITY_TYPE[entityChar] || 'Registered Taxpayer',
  };
}

export function decodeCin(cin) {
  if (!cin) return null;
  const clean = String(cin).replace(/\s+/g, '').toUpperCase();
  const m = clean.match(CIN_RE);
  if (!m) {
    if (LLPIN_RE.test(clean)) {
      return {
        cin: clean,
        listed: false,
        listingStatus: 'Unlisted LLP',
        ownership: 'Limited Liability Partnership (LLP)',
        stateCode: null,
        state: null,
        incorporationYear: null,
        nicCode: null,
        nicSector: null,
        rocNumber: clean,
      };
    }
    return null;
  }
  const [, listChar, nic5, stateCode, year, ownCode, rocNum] = m;
  const nic2 = nic5.slice(0, 2);
  return {
    cin: clean,
    listed: listChar === 'L',
    listingStatus: listChar === 'L' ? 'Listed on Indian Stock Exchange (BSE/NSE)' : 'Unlisted',
    nicCode: nic5,
    nicSector: NIC_SECTORS[nic2] || `NIC ${nic5}`,
    stateCode,
    state: CIN_STATES[stateCode] || stateCode,
    incorporationYear: year,
    ownershipCode: ownCode,
    ownership: CIN_OWNERSHIP[ownCode] || ownCode,
    rocNumber: rocNum,
  };
}

/** Map 6-digit Indian PIN code in an address to its Indian State. */
export function decodePinCode(address = '') {
  if (!address) return null;
  const m = String(address).match(/\b([1-8]\d{5})\b/);
  if (!m) return null;
  const pin = m[1];
  const p2 = Number(pin.slice(0, 2));
  const p3 = Number(pin.slice(0, 3));
  let state = null;
  if (p2 === 11) state = 'Delhi';
  else if (p2 >= 12 && p2 <= 13) state = 'Haryana';
  else if (p2 >= 14 && p2 <= 16) state = 'Punjab / Chandigarh';
  else if (p2 === 17) state = 'Himachal Pradesh';
  else if (p2 >= 18 && p2 <= 19) state = 'Jammu & Kashmir / Ladakh';
  else if (p2 >= 20 && p2 <= 28) state = p3 >= 244 && p3 <= 263 ? 'Uttarakhand / Uttar Pradesh' : 'Uttar Pradesh';
  else if (p2 >= 30 && p2 <= 34) state = 'Rajasthan';
  else if (p2 >= 36 && p2 <= 39) state = 'Gujarat';
  else if (p2 >= 40 && p2 <= 44) state = p3 === 403 ? 'Goa' : 'Maharashtra';
  else if (p2 >= 45 && p2 <= 48) state = 'Madhya Pradesh';
  else if (p2 === 49) state = 'Chhattisgarh';
  else if (p2 === 50) state = 'Telangana';
  else if (p2 >= 51 && p2 <= 53) state = 'Andhra Pradesh';
  else if (p2 >= 56 && p2 <= 59) state = 'Karnataka';
  else if (p2 >= 60 && p2 <= 64) state = 'Tamil Nadu';
  else if (p2 >= 67 && p2 <= 69) state = 'Kerala';
  else if (p2 >= 70 && p2 <= 74) state = 'West Bengal';
  else if (p2 >= 75 && p2 <= 77) state = 'Odisha';
  else if (p2 === 78) state = 'Assam';
  else if (p2 === 79) state = 'North East India';
  else if (p2 >= 80 && p2 <= 85) state = p3 >= 814 && p3 <= 835 ? 'Jharkhand' : 'Bihar';
  if (!state) return null;
  return { pin, state };
}

/**
 * Expand slash-separated Indian phone numbers commonly printed on cards:
 * e.g. "+91 98201 12345 / 98201 67890" or "022-26543210 / 11"
 */
export function expandIndianPhones(phones = []) {
  const out = [];
  for (const p of phones) {
    if (!p?.number) continue;
    const raw = String(p.number).trim();
    if (!raw.includes('/')) {
      out.push(p);
      continue;
    }
    const parts = raw.split('/').map((s) => s.trim()).filter(Boolean);
    const first = parts[0];
    out.push({ ...p, number: first });
    const firstDigits = first.replace(/\D/g, '');
    for (let i = 1; i < parts.length; i++) {
      const sub = parts[i];
      const subDigits = sub.replace(/\D/g, '');
      if (subDigits.length >= 8) {
        // Complete second number; inherit +91 if first had +91 and second is 10 digits
        const num = first.startsWith('+91') && subDigits.length === 10 && !sub.startsWith('+') ? `+91 ${sub}` : sub;
        out.push({ type: p.type || 'other', number: num });
      } else if (subDigits.length >= 2 && subDigits.length <= 4 && firstDigits.length >= 8) {
        // Extension suffix like "022-26543210 / 11"
        const base = first.slice(0, first.length - subDigits.length) + subDigits;
        out.push({ type: p.type || 'work', number: base });
      }
    }
  }
  return out;
}

/**
 * Build decoded Indian corporate & statutory profile from card + web search snippets.
 */
export function buildIndiaRegistryRecord(card, searchGroups = []) {
  const snippetBlob = searchGroups
    .flatMap((g) => g.results || [])
    .map((r) => `${r.title || ''} ${r.snippet || ''} ${r.url || ''}`)
    .join(' ');

  const fromSnippets = extractIndianIdsFromText(`${card.notes || ''} ${card.address || ''} ${snippetBlob}`);
  const gstin = card.gstin || fromSnippets.gstin || null;
  const cin = card.cin || fromSnippets.cin || null;
  const gstInfo = decodeGstin(gstin);
  const cinInfo = decodeCin(cin);
  const pinInfo = decodePinCode(card.address || '');

  // Look for ZaubaCorp / Tofler / IndiaMART / Cleartax links in search results
  const allResults = searchGroups.flatMap((g) => g.results || []);
  const zauba = allResults.find((r) => /zaubacorp\.com|tofler\.in|falconebiz\.com|thecompanycheck\.com/i.test(r.url || ''));
  const indiamart = allResults.find((r) => /indiamart\.com|tradeindia\.com/i.test(r.url || ''));
  const gstLink = allResults.find((r) => /cleartax\.in|gstsearch|knowyourgst|mastersindia/i.test(r.url || ''));

  if (!gstInfo && !cinInfo && !zauba && !indiamart && !pinInfo) return null;

  return {
    source: 'India MCA / GST',
    url: zauba?.url || gstLink?.url || indiamart?.url || 'https://www.mca.gov.in',
    title: card.company || 'Indian Entity Profile',
    cin: cinInfo?.cin || null,
    gstin: gstInfo?.gstin || null,
    pan: gstInfo?.pan || null,
    ownership: cinInfo?.ownership || gstInfo?.constitution || null,
    listingStatus: cinInfo?.listingStatus || null,
    incorporationYear: cinInfo?.incorporationYear || null,
    state: cinInfo?.state || gstInfo?.state || pinInfo?.state || null,
    nicSector: cinInfo?.nicSector || null,
    pinCode: pinInfo?.pin || null,
    zaubaUrl: zauba?.url || null,
    indiamartUrl: indiamart?.url || null,
  };
}
