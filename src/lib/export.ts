import type { AssociatedContact, Card, Dossier, ScanRecord, Settings } from '../types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const TEL_TYPE: Record<string, string> = { mobile: 'CELL', whatsapp: 'CELL', work: 'WORK', fax: 'FAX', other: 'VOICE' };

export function toVCard(card: Card, dossier?: Dossier, record?: ScanRecord): string {
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

  const gstin = card.gstin || dossier?.company?.gstin;
  const cin = card.cin || dossier?.company?.cin;

  const noteParts = [
    record?.event ? `Met at: ${record.event}${record.booth ? ` (${record.booth})` : ''}` : record?.booth ? `Booth: ${record.booth}` : null,
    record?.location?.label ? `Location: ${record.location.label}` : null,
    record?.priority ? `Priority: ${record.priority.toUpperCase()}` : null,
    record?.contactRole ? `Role: ${record.contactRole.toUpperCase()}` : null,
    record?.dealValue ? `Est. Deal Value: ${record.dealValue}` : null,
    record?.actionItems?.length ? `Action Items: ${record.actionItems.join(', ')}` : null,
    gstin ? `GSTIN: ${gstin}` : null,
    cin ? `CIN: ${cin}` : null,
    record?.associatedContacts?.length
      ? `Colleagues met: ${record.associatedContacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}${c.phone ? ` ${c.phone}` : ''}${c.email ? ` ${c.email}` : ''}`).join('; ')}`
      : null,
    record?.meetingNotes?.length ? `Notes:\n${record.meetingNotes.map((n) => `- ${n.text}`).join('\n')}` : null,
    dossier?.company?.summary,
    dossier?.salesAngle ? `Angle: ${dossier.salesAngle}` : null,
  ].filter(Boolean);
  if (noteParts.length) L.push(`NOTE:${esc(noteParts.join('\n\n'))}`);
  L.push('END:VCARD');
  return L.join('\r\n');
}

export function associateToVCard(contact: AssociatedContact, company?: string | null, website?: string | null): string {
  const parts = contact.name.trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ') || '';
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  L.push(`N:${esc(last)};${esc(first)};;;`);
  L.push(`FN:${esc(contact.name)}`);
  if (company) L.push(`ORG:${esc(company)}${contact.department ? ';' + esc(contact.department) : ''}`);
  if (contact.role) L.push(`TITLE:${esc(contact.role)}`);
  if (contact.email) L.push(`EMAIL;TYPE=INTERNET,WORK:${contact.email}`);
  if (contact.phone) L.push(`TEL;TYPE=CELL:${contact.phone}`);
  if (website) L.push(`URL:${website}`);
  if (contact.linkedin) L.push(`X-SOCIALPROFILE;TYPE=linkedin:${contact.linkedin}`);
  if (contact.notes) L.push(`NOTE:${esc(contact.notes)}`);
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

export async function shareOrDownloadVCard(card: Card, dossier?: Dossier, record?: ScanRecord) {
  const vcf = toVCard(card, dossier, record);
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
  out.push(
    `**Scanned:** ${new Date(r.createdAt).toLocaleString()}` +
      `${r.event ? `  \n**Event:** ${r.event}${r.booth ? ` (${r.booth})` : ''}` : ''}` +
      `${r.location?.label ? `  \n**Location:** ${r.location.label}` : ''}` +
      `${r.priority ? `  \n**Priority:** ${r.priority.toUpperCase()}` : ''}` +
      `${r.contactRole ? `  \n**Lead Role:** ${r.contactRole.toUpperCase()}` : ''}` +
      `${r.dealValue ? `  \n**Est. Deal Value:** ${r.dealValue}` : ''}`,
  );
  const gstin = card.gstin || d?.company.gstin;
  const cin = card.cin || d?.company.cin;
  out.push(
    `**Email:** ${list(card.emails)}  \n**Phone:** ${list(card.phones.map((p) => p.number))}  \n**Web:** ${card.website || '—'}` +
      `${gstin ? `  \n**GSTIN:** ${gstin}` : ''}${cin ? `  \n**CIN:** ${cin}` : ''}`,
  );
  if (r.actionItems?.length) {
    out.push('', '## Next Steps / Action Items', ...r.actionItems.map((a) => `- [ ] ${a}`));
  }
  if (r.associatedContacts?.length) {
    out.push('', '## Other People Met at Company');
    r.associatedContacts.forEach((c) => {
      out.push(`- **${c.name}**${c.role ? ` (${c.role}${c.department ? `, ${c.department}` : ''})` : ''}${c.email ? ` · ${c.email}` : ''}${c.phone ? ` · ${c.phone}` : ''}${c.notes ? ` — _${c.notes}_` : ''}`);
    });
  }
  if (r.meetingNotes?.length) {
    out.push('', '## Meeting Notes');
    r.meetingNotes.forEach((n) => {
      out.push(`- (${new Date(n.createdAt).toLocaleString()}) ${n.text}`);
    });
  }
  if (d) {
    if (d.kyc) {
      out.push(
        '',
        `## Vendor KYC & Entity Trust Scorecard (${d.kyc.score}/100 — ${d.kyc.tier.toUpperCase()})`,
        d.kyc.summary,
        ...d.kyc.checks.map((c) => `- [${c.status === 'verified' ? 'x' : ' '}] **${c.label}** (${c.status}): ${c.detail}`),
      );
    }
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
  const cols = [
    'Name', 'Title', 'Company', 'ScanMode', 'KycScore', 'Event', 'Booth/Stall', 'Location', 'Priority', 'LeadRole', 'DealValue', 'ActionItems', 'FollowUpDate', 'Tags',
    'Emails', 'Phones', 'Website', 'Address', 'GSTIN', 'CIN', 'LinkedIn',
    'OtherContactsMet', 'MeetingNotes',
    'Industry', 'HQ', 'Employees', 'Revenue', 'D-U-N-S', 'LEI', 'Parent', 'Summary', 'Scanned',
  ];
  const rows = records.filter((r) => r.dossier || r.status === 'done' || !r.status).map((r) => {
    const c = r.card;
    const d = r.dossier;
    const assoc = (r.associatedContacts || []).map((a) => `${a.name}${a.role ? ` (${a.role})` : ''}${a.email ? ` <${a.email}>` : ''}${a.phone ? ` [${a.phone}]` : ''}`).join(' | ');
    const notes = (r.meetingNotes || []).map((n) => n.text).join(' | ');
    return [
      c.fullName, c.jobTitle, c.company || d?.company.name, r.scanMode || 'card', d?.kyc?.score ?? '', r.event, r.booth, r.location?.label, r.priority, r.contactRole, r.dealValue, (r.actionItems || []).join('; '), r.followUpDate, (r.tags || []).join('; '),
      c.emails.join('; '), c.phones.map((p) => p.number).join('; '), c.website, c.address,
      c.gstin || d?.company.gstin, c.cin || d?.company.cin,
      c.socials?.linkedin || d?.person?.linkedinUrl,
      assoc, notes,
      d?.company.industry, d?.company.headquarters, d?.company.employeeRange,
      d?.company.revenueRange, d?.company.dunsNumber, d?.company.lei, d?.company.parentCompany, d?.company.summary, new Date(r.createdAt).toISOString(),
    ].map(csvCell).join(',');
  });
  return [cols.map(csvCell).join(','), ...rows].join('\r\n');
}

/** Generate an .ics calendar invite for a follow-up reminder. */
export function downloadCalendarReminder(r: ScanRecord) {
  const company = r.dossier?.company.name || r.card.company || 'Company';
  const person = r.card.fullName || company;
  const dateStr = (r.followUpDate || new Date(Date.now() + 86400_000 * 2).toISOString().slice(0, 10)).replace(/-/g, '');
  const summary = `Follow up with ${person} (${company})`;
  const desc = [
    r.event ? `Event: ${r.event}${r.booth ? ` (${r.booth})` : ''}` : null,
    r.location?.label ? `Met at: ${r.location.label}` : null,
    r.actionItems?.length ? `Action Items: ${r.actionItems.join(', ')}` : null,
    r.dealValue ? `Deal Value: ${r.dealValue}` : null,
    r.card.emails[0] ? `Email: ${r.card.emails[0]}` : null,
    r.card.phones[0] ? `Phone: ${r.card.phones[0].number}` : null,
    r.associatedContacts?.length ? `Also met: ${r.associatedContacts.map((c) => c.name).join(', ')}` : null,
    r.meetingNotes?.length ? `Notes: ${r.meetingNotes.map((n) => n.text).join(' | ')}` : null,
    r.dossier?.salesAngle ? `Sales angle: ${r.dossier.salesAngle}` : null,
  ].filter(Boolean).join('\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CardIntel//FollowUp//EN',
    'BEGIN:VEVENT',
    `UID:cardintel-${r.id}@cardintel.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  downloadFile(`followup-${person.replace(/\W+/g, '_')}.ics`, ics, 'text/calendar');
}

export function googleCalendarUrl(r: ScanRecord): string {
  const company = r.dossier?.company.name || r.card.company || 'Company';
  const person = r.card.fullName || company;
  const dateStr = (r.followUpDate || new Date(Date.now() + 86400_000 * 2).toISOString().slice(0, 10)).replace(/-/g, '');
  const title = `Follow up: ${person} (${company})`;
  const details = [
    r.event ? `Event: ${r.event}${r.booth ? ` (${r.booth})` : ''}` : null,
    r.location?.label ? `Location: ${r.location.label}` : null,
    r.actionItems?.length ? `Action Items: ${r.actionItems.join(', ')}` : null,
    r.card.emails[0] ? `Email: ${r.card.emails[0]}` : null,
    r.card.phones[0] ? `Phone: ${r.card.phones[0].number}` : null,
    r.meetingNotes?.length ? `Notes: ${r.meetingNotes.map((n) => n.text).join(' | ')}` : null,
  ].filter(Boolean).join('\n');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateStr}/${dateStr}&details=${encodeURIComponent(details)}`;
}

export type OutreachTone = 'professional' | 'india_b2b' | 'hinglish';

export function generateOutreachDrafts(r: ScanRecord, settings?: Settings, tone: OutreachTone = 'professional') {
  const firstName = r.card.firstName || r.card.fullName?.split(' ')[0] || 'there';
  const company = r.dossier?.company.name || r.card.company || 'your organization';
  const boothStr = r.booth ? ` (${r.booth})` : '';
  const whereMet = r.event
    ? `at ${r.event}${boothStr}${r.location?.label ? ` in ${r.location.label}` : ''}`
    : r.location?.label
    ? `in ${r.location.label}`
    : 'recently';
  const colleagues = r.associatedContacts?.length
    ? ` (and speaking with ${r.associatedContacts.map((c) => c.name).join(' & ')})`
    : '';
  const actionsLine = r.actionItems?.length
    ? ` As discussed, I am following up regarding: ${r.actionItems.join(', ')}.`
    : '';
  const noteContext = r.meetingNotes?.[0]?.text
    ? ` Enjoyed our discussion on ${r.meetingNotes[0].text.replace(/\.$/, '')}.`
    : '';
  const angle = r.dossier?.salesAngle
    ? `\n\n${r.dossier.salesAngle}`
    : r.dossier?.talkingPoints?.[0]
    ? `\n\n${r.dossier.talkingPoints[0]}`
    : '';
  const signOffName = settings?.senderName || 'Warm regards';
  const signOffCompany = settings?.senderCompany ? `\n${settings.senderCompany}` : '';
  const signOffPhone = settings?.senderPhone ? `\n📞 ${settings.senderPhone}` : '';

  if (tone === 'hinglish') {
    const emailSubject = r.event
      ? `Great meeting you at ${r.event}${boothStr} — ${company}`
      : `Lovely connecting — ${company}`;
    const emailBody = `Namaste ${firstName} ji,\n\nIt was a pleasure meeting you ${whereMet}${colleagues}.${noteContext}${actionsLine}\n\nLet's connect this week for a quick 15-min call to take our discussion forward.\n\nWarm regards,\n${signOffName}${signOffCompany}${signOffPhone}`;
    const linkedinNote = `Hi ${firstName} ji, great meeting you ${whereMet}${colleagues}! Really impressed with ${company}'s work. Let's stay connected here.`;
    const whatsappText = `Namaste ${firstName} ji! 🙏 Great meeting you ${whereMet}${colleagues}.${actionsLine}${noteContext} Sharing my contact details here — batayiye kab connect kar sakte hain is week?${settings?.senderName ? `\n— ${settings.senderName}${settings?.senderCompany ? ` (${settings.senderCompany})` : ''}` : ''}`;
    return { emailSubject, emailBody, linkedinNote, whatsappText };
  }

  if (tone === 'india_b2b') {
    const emailSubject = r.event
      ? `Follow-up from ${r.event}${boothStr}: ${company} × ${settings?.senderCompany || 'Our Team'}`
      : `Following up on our discussion — ${company}`;
    const emailBody = `Dear ${firstName},\n\nGreetings! It was wonderful meeting you ${whereMet}${colleagues}.${noteContext}${actionsLine}${angle}\n\nPlease let me know a convenient time this week for a brief call or factory/office visit to take this forward.\n\nWarm regards,\n${signOffName}${signOffCompany}${signOffPhone}`;
    const linkedinNote = `Dear ${firstName}, pleasure meeting you ${whereMet}${colleagues}. Looking forward to staying in touch and exploring synergies with ${company}.`;
    const whatsappText = `Hello ${firstName}, pleasure meeting you ${whereMet}${colleagues}! 🤝${actionsLine}${noteContext} Saving your number here — please let me know a good time to connect this week.${settings?.senderName ? `\n\nRegards,\n${settings.senderName}${settings?.senderCompany ? `\n${settings.senderCompany}` : ''}` : ''}`;
    return { emailSubject, emailBody, linkedinNote, whatsappText };
  }

  const emailSubject = r.event
    ? `Great meeting you at ${r.event}${boothStr} — ${company}`
    : `Great connecting — ${company}`;

  const emailBody = `Hi ${firstName},\n\nIt was great meeting you ${whereMet}${colleagues}.${noteContext}${actionsLine}${angle}\n\nWould you be open to a quick 15-minute catch-up next week to continue the conversation?\n\nBest,\n${signOffName}${signOffCompany}${signOffPhone}`;

  const linkedinNote = `Hi ${firstName}, great meeting you ${whereMet}${colleagues}! Impressed by what ${company} is building${r.dossier?.company.industry ? ` in ${r.dossier.company.industry.toLowerCase()}` : ''}. Would love to stay connected here.`;

  const whatsappText = `Hi ${firstName}! Great meeting you ${whereMet}${colleagues}.${actionsLine}${noteContext} Saving your contact details here — let's catch up soon!${settings?.senderName ? ` — ${settings.senderName}` : ''}`;

  return { emailSubject, emailBody, linkedinNote, whatsappText };
}

/** Generate a shareable End-of-Day Event Report (for WhatsApp / Email / Team update). */
export function generateEventDigest(eventName: string, records: ScanRecord[]): string {
  const hotCount = records.filter((r) => r.priority === 'hot').length;
  const warmCount = records.filter((r) => r.priority === 'warm').length;
  const partnerCount = records.filter((r) => r.priority === 'partner' || r.contactRole === 'distributor' || r.contactRole === 'partner').length;
  const colleaguesCount = records.reduce((a, r) => a + (r.associatedContacts?.length || 0), 0);
  const locations = Array.from(new Set(records.map((r) => r.location?.label).filter(Boolean))).join(', ');

  const lines: string[] = [
    `📊 *EVENT REPORT: ${eventName}*`,
    `📅 Date: ${new Date().toLocaleDateString()}`,
    locations ? `📍 Location: ${locations}` : '',
    `👥 Total Cards Scanned: ${records.length} (+${colleaguesCount} extra colleagues met)`,
    `🔥 Breakdown: ${hotCount} Hot · ${warmCount} Warm · ${partnerCount} Partners/Distributors`,
    '',
    `*KEY CONTACTS & NEXT STEPS:*`,
  ].filter(Boolean);

  records.forEach((r, idx) => {
    const name = r.card.fullName || 'Contact';
    const co = r.dossier?.company.name || r.card.company || 'Company';
    const prio = r.priority ? ` [${r.priority.toUpperCase()}]` : '';
    const role = r.contactRole ? ` (${r.contactRole})` : '';
    const deal = r.dealValue ? ` · Deal: ${r.dealValue}` : '';
    const booth = r.booth ? ` · ${r.booth}` : '';
    const actions = r.actionItems?.length ? `\n   ✅ Next: ${r.actionItems.join(', ')}` : '';
    const note = r.meetingNotes?.[0]?.text ? `\n   📝 Note: ${r.meetingNotes[0].text}` : '';
    const team = r.associatedContacts?.length ? `\n   🤝 Also met: ${r.associatedContacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')}` : '';
    lines.push(`${idx + 1}. *${name}* — ${r.card.jobTitle || ''} @ *${co}*${prio}${role}${deal}${booth}${actions}${team}${note}`);
  });

  return lines.join('\n');
}
