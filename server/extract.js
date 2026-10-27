import { geminiJSON } from './gemini.js';

const PROMPT = `You are an expert business card parser. Extract every piece of contact information from the business card image(s) (front and/or back side).
Cards can have ANY layout: horizontal, vertical, rotated, multilingual, minimalist, logo-only company names, dark backgrounds, embossed/metallic print, QR codes.
Read logos for the company name when it is not printed as text. If a QR code's content is legible as text/URL, use it.

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
  "phones": [{"type": "mobile"|"work"|"fax"|"other", "number": string}],
  "website": string|null,
  "address": string|null,
  "socials": {"linkedin": string|null, "twitter": string|null, "facebook": string|null, "instagram": string|null, "other": string[]},
  "language": string|null,
  "notes": string|null,
  "confidence": number
}
Rules:
- Never invent data. Use null or [] when absent.
- Keep names in their original script; add a romanized form in "notes" if non-Latin.
- Normalize phone numbers to international format (+CC ...) when the country is inferable from address/website TLD.
- "website" must be a full URL (https://...).
- "confidence" is 0..1 for overall extraction quality.`;

export const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'yandex.com', 'zoho.com', 'gmx.com', 'gmx.de', 'mail.com',
  'qq.com', '163.com', '126.com', 'rediffmail.com', 'web.de',
]);

export async function extractCard(images, cfg) {
  if (!Array.isArray(images) || images.length === 0) throw new Error('No card image provided');
  const parts = images.slice(0, 2).map((img) => ({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.data } }));
  parts.push({ text: PROMPT });
  const raw = await geminiJSON({ apiKey: cfg.geminiKey, model: cfg.geminiModel, parts, temperature: 0.1 });
  const card = normalizeCard(raw);
  if (card.socials.linkedin) card.linkedinSource = 'card';
  return card;
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeCard(c = {}) {
  const socials = c.socials || {};
  const card = {
    fullName: str(c.fullName),
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    jobTitle: str(c.jobTitle),
    department: str(c.department),
    company: str(c.company),
    tagline: str(c.tagline),
    emails: (Array.isArray(c.emails) ? c.emails : []).map(str).filter(Boolean),
    phones: (Array.isArray(c.phones) ? c.phones : [])
      .map((p) => (typeof p === 'string' ? { type: 'other', number: p } : { type: str(p?.type) || 'other', number: str(p?.number) }))
      .filter((p) => p.number),
    website: str(c.website),
    domain: null,
    address: str(c.address),
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
