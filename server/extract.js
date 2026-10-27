import { geminiJSON } from './gemini.js';
import { expandIndianPhones, extractIndianIdsFromText } from './india.js';

const MODE_INSTRUCTIONS = {
  card: `SOURCE TYPE: Business Card or Conference Visitor Badge.
Extract the contact person, job title, company name, tagline, emails, phone/WhatsApp numbers, website, address, and any statutory IDs (GSTIN, CIN).`,

  stall_signboard: `SOURCE TYPE: Expo Stall Fascia / Shop Signboard / Commercial Building Tenant Directory.
- Read the main brand/shop/company name prominently displayed on the signboard, stall banner, or tenant directory row.
- If a proprietor, dealer, or contact person name is listed (e.g. "Prop: ...", "Contact: ..."), extract into "fullName".
- Extract any stall/booth number, shop number, market/industrial area, or floor into "address" and "notes".
- Extract any GSTIN (often printed in the top corners of Indian shop boards), phone/WhatsApp numbers, website, and product/category lines into "tagline".`,

  invoice_kyc: `SOURCE TYPE: Tax Invoice / Company Letterhead / Quotation / Vendor KYC Document.
- Extract the ISSUER / SUPPLIER company name (not the "Billed To / Buyer" company unless only one company is present) into "company".
- Carefully extract statutory & KYC identifiers: 15-char Indian GSTIN ("gstin"), 21-char MCA CIN or LLPIN ("cin"), 10-char PAN, MSME Udyam Registration No., IEC, or TAN (include PAN/Udyam/IEC/bank IFSC in "notes").
- If an authorized signatory, proprietor, or contact person is named, extract into "fullName" and "jobTitle".
- Extract registered office / factory address, emails, phone numbers, and website.`,

  product_pack: `SOURCE TYPE: Product Packaging Label / Industrial Machinery Nameplate / Brochure Back-Cover.
- Look for "Manufactured by", "Marketed by", "Packed by", or "Imported by" blocks and extract the primary manufacturer/brand company into "company".
- Extract customer care / sales phone numbers, emails, website, and factory/registered address.
- Extract technical ratings, model numbers, FSSAI license, BIS/ISI mark, ISO certifications, or product descriptions into "tagline" and "notes".`,

  digital_screenshot: `SOURCE TYPE: Screenshot of an Email Signature, LinkedIn Profile, or WhatsApp Contact / Chat.
- Extract the person's full name, job title/headline, company name, emails, phone/WhatsApp numbers, LinkedIn URL or social handles, and location/address.`,
};

function buildPrompt(scanMode = 'card') {
  const modeHint = MODE_INSTRUCTIONS[scanMode] || MODE_INSTRUCTIONS.card;
  return `You are an expert B2B document, signboard, packaging, and business card Vision AI parser.
${modeHint}

Inputs can have ANY layout: horizontal, vertical, rotated, multilingual (including Hindi, Gujarati, Marathi, Tamil, Telugu, Kannada, Bengali, Arabic, Chinese, Japanese, European scripts), minimalist, logo-only company names, dark backgrounds, metallic nameplates, shop signboards, tax invoices, or QR codes.
Read logos for the company name when it is not printed as standard text. If a QR code's content is legible as text/URL, use it.

Return ONLY JSON in exactly this shape:
{
  "fullName": string|null,
  "firstName": string|null,
  "lastName": string|null,
  "jobTitle": string|null,
  "department": string|null,
  "company": string|null,
  "tagline": string|null,
  "emails": string[],
  "phones": [{"type": "mobile"|"work"|"whatsapp"|"fax"|"other", "number": string}],
  "website": string|null,
  "address": string|null,
  "gstin": string|null,
  "cin": string|null,
  "socials": {"linkedin": string|null, "twitter": string|null, "facebook": string|null, "instagram": string|null, "other": string[]},
  "language": string|null,
  "notes": string|null,
  "confidence": number
}
Rules:
- Never invent data. Use null or [] when absent.
- Keep names in their original script; add an English/romanized transliteration in "notes" if non-Latin.
- Split multiple phone numbers (e.g. "+91 98201 12345 / 98201 67890" or "022-26543210 / 11") into separate entries in "phones". If a number has a WhatsApp icon or "WA", set type="whatsapp".
- Normalize phone numbers to international format (+CC ...) when the country is inferable from address, PIN code, GSTIN, CIN, or website TLD (e.g. +91 for India).
- If an Indian GSTIN (15-character tax ID like 27AABCU9603R1ZM) or Corporate Identity Number (CIN like U72200KA2018PTC112345 or LLPIN) is printed, extract it into "gstin" and "cin".
- If PAN, MSME Udyam number, FSSAI, ISO, IEC, or Stall/Shop number is visible, include it clearly in "notes".
- "website" must be a full URL (https://...).
- "confidence" is 0..1 for overall extraction quality.`;
}

export const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'yandex.com', 'zoho.com', 'zohomail.in', 'gmx.com', 'gmx.de', 'mail.com',
  'qq.com', '163.com', '126.com', 'rediffmail.com', 'sify.com', 'bsnl.in', 'web.de',
]);

export async function extractCard(images, cfg, scanMode = 'card') {
  if (!Array.isArray(images) || images.length === 0) throw new Error('No image provided');
  const parts = images.slice(0, 2).map((img) => ({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.data } }));
  parts.push({ text: buildPrompt(scanMode) });
  const raw = await geminiJSON({ apiKey: cfg.geminiKey, model: cfg.geminiModel, parts, temperature: 0.1 });
  const card = normalizeCard(raw);
  if (card.socials.linkedin) card.linkedinSource = 'card';
  return card;
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeCard(c = {}) {
  const socials = c.socials || {};
  const rawPhones = (Array.isArray(c.phones) ? c.phones : [])
    .map((p) => (typeof p === 'string' ? { type: 'other', number: p } : { type: str(p?.type)?.toLowerCase() || 'other', number: str(p?.number) }))
    .filter((p) => p.number);

  const fallbackIds = extractIndianIdsFromText([c.gstin, c.cin, c.notes, c.address, c.tagline].filter(Boolean).join(' '));

  const card = {
    fullName: str(c.fullName),
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    jobTitle: str(c.jobTitle),
    department: str(c.department),
    company: str(c.company),
    tagline: str(c.tagline),
    emails: (Array.isArray(c.emails) ? c.emails : []).map(str).filter(Boolean),
    phones: expandIndianPhones(rawPhones),
    website: str(c.website),
    domain: null,
    address: str(c.address),
    gstin: str(c.gstin)?.toUpperCase() || fallbackIds.gstin || null,
    cin: str(c.cin)?.toUpperCase() || fallbackIds.cin || null,
    socials: {
      linkedin: str(socials.linkedin),
      twitter: str(socials.twitter),
      facebook: str(socials.facebook),
      instagram: str(socials.instagram),
      other: (Array.isArray(socials.other) ? socials.other : []).map(str).filter(Boolean),
    },
    language: str(c.language),
    notes: str(c.notes),
    confidence: typeof c.confidence === 'number' ? c.confidence : null,
    linkedinSource: ['card', 'shared', 'user'].includes(c.linkedinSource) ? c.linkedinSource : null,
  };
  if (!card.fullName && (card.firstName || card.lastName)) card.fullName = [card.firstName, card.lastName].filter(Boolean).join(' ');
  if (card.fullName && !card.firstName) {
    const bits = card.fullName.split(/\s+/);
    card.firstName = bits[0];
    card.lastName = bits.length > 1 ? bits.slice(1).join(' ') : null;
  }
  if (card.website && !/^https?:\/\//i.test(card.website)) card.website = 'https://' + card.website;
  card.domain = deriveDomain(card);
  if (!card.website && card.domain) card.website = 'https://' + card.domain;
  return card;
}

export function deriveDomain(card) {
  if (card.website) {
    try {
      return new URL(card.website).hostname.replace(/^www\./, '').toLowerCase();
    } catch { /* ignore */ }
  }
  for (const e of card.emails || []) {
    const d = e.split('@')[1]?.toLowerCase();
    if (d && !FREE_MAIL.has(d)) return d;
  }
  return null;
}
