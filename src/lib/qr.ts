import type { Card } from '../types';

/**
 * Parse a QR code string (vCard, MeCard, LinkedIn URL, WhatsApp link, or JSON/delimited badge)
 * into a structured Card object for instant zero-latency capture at events & expos.
 */
export function parseQrPayload(raw: string): Card | null {
  const text = raw?.trim();
  if (!text) return null;

  const card: Card = {
    fullName: null,
    firstName: null,
    lastName: null,
    jobTitle: null,
    department: null,
    company: null,
    tagline: null,
    emails: [],
    phones: [],
    website: null,
    domain: null,
    address: null,
    gstin: null,
    cin: null,
    socials: {},
    notes: null,
  };

  // 1) vCard format (BEGIN:VCARD ... END:VCARD)
  if (/BEGIN:VCARD/i.test(text)) {
    const lines = text.replace(/\r\n\s+/g, '').split(/\r?\n/);
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const keyPart = line.slice(0, idx).toUpperCase();
      const val = line.slice(idx + 1).trim().replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ', ');
      if (!val) continue;

      if (keyPart === 'FN' || keyPart.startsWith('FN;')) {
        card.fullName = val;
      } else if (keyPart === 'N' || keyPart.startsWith('N;')) {
        const [last, first] = val.split(';');
        card.lastName = last?.trim() || null;
        card.firstName = first?.trim() || null;
      } else if (keyPart === 'ORG' || keyPart.startsWith('ORG;')) {
        const [org, dept] = val.split(';');
        card.company = org?.trim() || null;
        if (dept?.trim()) card.department = dept.trim();
      } else if (keyPart === 'TITLE' || keyPart.startsWith('TITLE;')) {
        card.jobTitle = val;
      } else if (keyPart.startsWith('TEL')) {
        const type = /CELL|MOBILE/i.test(keyPart) ? 'mobile' : /WORK/i.test(keyPart) ? 'work' : 'other';
        card.phones.push({ type, number: val });
      } else if (keyPart.startsWith('EMAIL')) {
        card.emails.push(val);
      } else if (keyPart.startsWith('URL')) {
        if (/linkedin\.com/i.test(val)) card.socials.linkedin = val;
        else if (!card.website) card.website = val.startsWith('http') ? val : `https://${val}`;
      } else if (keyPart.startsWith('ADR')) {
        const addr = val.split(';').map((s) => s.trim()).filter(Boolean).join(', ');
        if (addr) card.address = addr;
      } else if (keyPart.startsWith('NOTE')) {
        card.notes = val;
      }
    }
    if (!card.fullName && (card.firstName || card.lastName)) {
      card.fullName = [card.firstName, card.lastName].filter(Boolean).join(' ');
    }
    if (card.website) {
      try {
        card.domain = new URL(card.website).hostname.replace(/^www\./, '').toLowerCase();
      } catch { /* ignore */ }
    } else if (card.emails[0]) {
      const dom = card.emails[0].split('@')[1]?.toLowerCase();
      if (dom && !/gmail|yahoo|outlook|hotmail|icloud|rediff/i.test(dom)) {
        card.domain = dom;
        card.website = `https://${dom}`;
      }
    }
    return card.fullName || card.company || card.emails.length || card.phones.length ? card : null;
  }

  // 2) MECARD format (MECARD:N:Last,First;ORG:Company;TEL:+91...;EMAIL:...;;)
  if (/^MECARD:/i.test(text)) {
    const body = text.replace(/^MECARD:/i, '');
    const fields = body.split(';');
    for (const f of fields) {
      const idx = f.indexOf(':');
      if (idx < 0) continue;
      const k = f.slice(0, idx).toUpperCase().trim();
      const v = f.slice(idx + 1).trim();
      if (!v) continue;
      if (k === 'N') {
        const [last, first] = v.split(',');
        card.lastName = last?.trim() || null;
        card.firstName = first?.trim() || null;
        card.fullName = [card.firstName, card.lastName].filter(Boolean).join(' ') || v;
      } else if (k === 'ORG') card.company = v;
      else if (k === 'TITLE') card.jobTitle = v;
      else if (k === 'TEL') card.phones.push({ type: 'mobile', number: v });
      else if (k === 'EMAIL') card.emails.push(v);
      else if (k === 'URL') card.website = v.startsWith('http') ? v : `https://${v}`;
      else if (k === 'ADR') card.address = v;
      else if (k === 'NOTE') card.notes = v;
    }
    if (card.website) {
      try {
        card.domain = new URL(card.website).hostname.replace(/^www\./, '').toLowerCase();
      } catch { /* ignore */ }
    }
    return card.fullName || card.company || card.emails.length || card.phones.length ? card : null;
  }

  // 3) LinkedIn Profile or Company URL
  if (/linkedin\.com\/in\/([^/?#]+)/i.test(text)) {
    const slug = text.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] || '';
    const cleanName = slug
      .replace(/-[0-9a-f]{5,}$/i, '')
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
    card.fullName = cleanName || 'LinkedIn Contact';
    const parts = card.fullName.split(' ');
    card.firstName = parts[0] || null;
    card.lastName = parts.slice(1).join(' ') || null;
    card.socials.linkedin = text.startsWith('http') ? text : `https://${text}`;
    card.linkedinSource = 'card';
    return card;
  }

  // 4) Conference Badge pipe/comma/newline format (common at Indian & global expos: Name | Title | Company | Email | Phone)
  if (text.includes('|') || (text.includes('@') && text.split(/\r?\n/).length >= 2)) {
    const tokens = text.split(/[|\r\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const tok of tokens) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(tok)) {
        card.emails.push(tok);
      } else if (/^\+?[\d\s\-()]{8,16}$/.test(tok)) {
        card.phones.push({ type: 'mobile', number: tok });
      } else if (/^https?:\/\//i.test(tok) || /^www\./i.test(tok)) {
        card.website = tok.startsWith('http') ? tok : `https://${tok}`;
      } else if (!card.fullName) {
        card.fullName = tok;
      } else if (!card.jobTitle) {
        card.jobTitle = tok;
      } else if (!card.company) {
        card.company = tok;
      }
    }
    if (card.fullName) {
      const bits = card.fullName.split(/\s+/);
      card.firstName = bits[0] || null;
      card.lastName = bits.slice(1).join(' ') || null;
    }
    if (card.emails[0] && !card.domain) {
      const d = card.emails[0].split('@')[1]?.toLowerCase();
      if (d && !/gmail|yahoo|outlook|hotmail|icloud|rediff/i.test(d)) {
        card.domain = d;
        card.website ||= `https://${d}`;
      }
    }
    return card.fullName || card.company || card.emails.length ? card : null;
  }

  return null;
}

/**
 * Use browser BarcodeDetector API (supported in Chrome/Edge/Android) to detect a QR code from an image Blob or DataURL.
 */
export async function detectQrFromImageSource(src: Blob | string): Promise<string | null> {
  const BD = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (img: ImageBitmap | HTMLImageElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const detector = new BD({ formats: ['qr_code'] });
    if (typeof src !== 'string' && typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(src);
      const hits = await detector.detect(bmp);
      bmp.close?.();
      return hits?.[0]?.rawValue || null;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
      img.src = url;
    });
    const hits = await detector.detect(img);
    if (typeof src !== 'string') URL.revokeObjectURL(url);
    return hits?.[0]?.rawValue || null;
  } catch {
    return null;
  }
}
