import type { Card, Dossier, ScanRecord } from '../types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const TEL_TYPE: Record<string, string> = { mobile: 'CELL', work: 'WORK', fax: 'FAX', other: 'VOICE' };

export function toVCard(card: Card, dossier?: Dossier): string {
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  L.push(`N:${esc(card.lastName || '')};${esc(card.firstName || '')};;;`);
  L.push(`FN:${esc(card.fullName || card.company || 'Contact')}`);
  if (card.company) L.push(`ORG:${esc(card.company)}${card.department ? ';' + esc(card.department) : ''}`);
  if (card.jobTitle) L.push(`TITLE:${esc(card.jobTitle)}`);
  card.emails.forEach((e) => L.push(`EMAIL;TYPE=INTERNET,WORK:${e}`));
  const intl = new Map((dossier?.validation?.phones || []).filter((p) => p.valid && p.e164).map((p) => [p.value, p.e164!]));
  card.phones.forEach((p) => L.push(`TEL;TYPE=${TEL_TYPE[p.type] || 'VOICE'}:${intl.get(p.number) || p.number}`));
  if (card.website) L.push(`URL:${card.website}`);
  if (card.address) L.push(`ADR;TYPE=WORK:;;${esc(card.address)};;;;`);
  const li = card.socials?.linkedin || dossier?.person?.linkedinUrl;
  if (li) L.push(`X-SOCIALPROFILE;TYPE=linkedin:${li}`);
  const note = [dossier?.company?.summary, dossier?.salesAngle ? `Angle: ${dossier.salesAngle}` : null].filter(Boolean).join('\n\n');
  if (note) L.push(`NOTE:${esc(note)}`);
  L.push('END:VCARD');
  return L.join('\r\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownloadVCard(card: Card, dossier?: Dossier) {
  const vcf = toVCard(card, dossier);
  const name = `${(card.fullName || card.company || 'contact').replace(/[^\w-]+/g, '_')}.vcf`;
  const file = new File([vcf], name, { type: 'text/vcard' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: card.fullName || 'Contact' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  downloadFile(name, vcf, 'text/vcard');
}

const list = (a?: string[]) => (a && a.length ? a.join(', ') : '—');

export function toMarkdown(r: ScanRecord): string {
  const { card, dossier: d } = r;
  const out: string[] = [];
  out.push(`# ${card.fullName || 'Contact'} — ${card.jobTitle || ''} @ ${card.company || d?.company.name || ''}`);
  out.push('');
  out.push(`**Email:** ${list(card.emails)}  \n**Phone:** ${list(card.phones.map((p) => p.number))}  \n**Web:** ${card.website || '—'}`);
  if (d) {
    out.push('', '## Company', d.company.summary || '');
    out.push(`- Industry: ${d.company.industry || '—'}`, `- HQ: ${d.company.headquarters || '—'}`, `- Employees: ${d.company.employeeRange || '—'}`, `- Revenue: ${d.company.revenueRange || '—'}`);
    if (d.products.length) out.push('', '## Products', ...d.products.map((p) => `- **${p.name}**: ${p.description}`));
    if (d.services.length) out.push('', '## Services', ...d.services.map((p) => `- **${p.name}**: ${p.description}`));
    if (d.targetCustomers?.summary) out.push('', '## Target customers', d.targetCustomers.summary);
    if (d.notableCustomers.length) out.push('', '## Notable customers', ...d.notableCustomers.map((c) => `- ${c.name}: ${c.evidence}`));
    if (d.talkingPoints.length) out.push('', '## Talking points', ...d.talkingPoints.map((t) => `- ${t}`));
    if (d.salesAngle) out.push('', '## Sales angle', d.salesAngle);
  }
  return out.join('\n');
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function toCSV(records: ScanRecord[]): string {
  const cols = ['Name', 'Title', 'Company', 'Emails', 'Phones', 'Website', 'Address', 'LinkedIn', 'Industry', 'HQ', 'Employees', 'Revenue', 'D-U-N-S', 'LEI', 'Parent', 'Summary', 'Scanned'];
  const rows = records.filter((r) => r.dossier || r.status === 'done' || !r.status).map((r) => {
    const c = r.card;
    const d = r.dossier;
    return [
      c.fullName, c.jobTitle, c.company, c.emails.join('; '), c.phones.map((p) => p.number).join('; '), c.website, c.address,
      c.socials?.linkedin || d?.person?.linkedinUrl, d?.company.industry, d?.company.headquarters, d?.company.employeeRange,
      d?.company.revenueRange, d?.company.dunsNumber, d?.company.lei, d?.company.parentCompany, d?.company.summary, new Date(r.createdAt).toISOString(),
    ].map(csvCell).join(',');
  });
  return [cols.map(csvCell).join(','), ...rows].join('\r\n');
}
