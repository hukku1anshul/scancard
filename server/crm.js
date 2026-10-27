// CRM sync: HubSpot (private-app token) and Salesforce (instance URL + OAuth access token).

function summaryText(record) {
  const d = record.dossier;
  const parts = [
    record.event ? `Event / Conference: ${record.event}` : null,
    record.booth ? `Hall / Stall: ${record.booth}` : null,
    record.location?.label ? `Location (GPS): ${record.location.label}` : null,
    record.priority ? `Priority: ${String(record.priority).toUpperCase()}` : null,
    record.contactRole ? `Contact Role: ${record.contactRole}` : null,
    record.dealValue ? `Estimated Deal Value: ${record.dealValue}` : null,
    record.followUpDate ? `Follow-Up Date: ${record.followUpDate}` : null,
    record.actionItems?.length ? `Action Items:\n- ${record.actionItems.join('\n- ')}` : null,
    record.card?.gstin || d?.company?.gstin ? `GSTIN: ${record.card?.gstin || d?.company?.gstin}` : null,
    record.card?.cin || d?.company?.cin ? `CIN (MCA): ${record.card?.cin || d?.company?.cin}` : null,
    record.associatedContacts?.length
      ? `Additional People Spoken To at Company:\n- ${record.associatedContacts
          .map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}${c.email ? ` · ${c.email}` : ''}${c.phone ? ` · ${c.phone}` : ''}${c.notes ? ` — ${c.notes}` : ''}`)
          .join('\n- ')}`
      : null,
    record.meetingNotes?.length
      ? `Meeting Notes:\n- ${record.meetingNotes.map((n) => n.text).join('\n- ')}`
      : null,
    d?.company?.summary,
    d?.products?.length ? `Products: ${d.products.map((p) => p.name).join(', ')}` : null,
    d?.services?.length ? `Services: ${d.services.map((p) => p.name).join(', ')}` : null,
    d?.targetCustomers?.summary ? `Target customers: ${d.targetCustomers.summary}` : null,
    d?.salesAngle ? `Sales angle: ${d.salesAngle}` : null,
    d?.talkingPoints?.length ? `Talking points:\n- ${d.talkingPoints.join('\n- ')}` : null,
    d?.company?.dunsNumber ? `D-U-N-S: ${d.company.dunsNumber}` : null,
    d?.company?.lei ? `LEI: ${d.company.lei}` : null,
    'Source: CardIntel business-card scan',
  ];
  return parts.filter(Boolean).join('\n\n');
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const phoneOf = (card, type) => card.phones?.find((p) => p.type === type)?.number;
const companyLinkedIn = (d) => d?.socialPresence?.find((s) => /linkedin\.com\/company\//i.test(s.url || ''))?.url;

// ---------------------------------------------------------------- HubSpot ----
export async function pushHubSpot(record, token) {
  const api = async (p, method = 'GET', body) => {
    const r = await fetch('https://api.hubapi.com' + p, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`HubSpot ${r.status}: ${d.message || r.statusText}`);
    return d;
  };
  const search = (obj, prop, value) =>
    api(`/crm/v3/objects/${obj}/search`, 'POST', { filterGroups: [{ filters: [{ propertyName: prop, operator: 'EQ', value }] }], limit: 1 }).then((d) => d.results?.[0]?.id || null);

  const { card, dossier: d } = record;
  let companyId = null;
  if (card.company || card.domain) {
    const props = clean({
      name: d?.company?.name || card.company,
      domain: card.domain,
      website: card.website,
      description: d?.company?.summary?.slice(0, 1000),
      linkedin_company_page: companyLinkedIn(d),
    });
    const existing = card.domain ? await search('companies', 'domain', card.domain) : null;
    companyId = existing
      ? (await api(`/crm/v3/objects/companies/${existing}`, 'PATCH', { properties: props })).id
      : (await api('/crm/v3/objects/companies', 'POST', { properties: props })).id;
  }

  const contactProps = clean({
    firstname: card.firstName,
    lastname: card.lastName,
    email: card.emails?.[0],
    phone: phoneOf(card, 'work') || card.phones?.[0]?.number,
    mobilephone: phoneOf(card, 'mobile'),
    jobtitle: card.jobTitle,
    company: card.company,
    website: card.website,
    address: card.address,
  });
  const existingContact = card.emails?.[0] ? await search('contacts', 'email', card.emails[0]) : null;
  const contactId = existingContact
    ? (await api(`/crm/v3/objects/contacts/${existingContact}`, 'PATCH', { properties: contactProps })).id
    : (await api('/crm/v3/objects/contacts', 'POST', { properties: contactProps })).id;

  if (companyId) await api(`/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`, 'PUT');

  const note = summaryText(record);
  if (note) {
    await api('/crm/v3/objects/notes', 'POST', {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: note.replace(/\n/g, '<br>') },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
    });
  }
  return { ok: true, provider: 'hubspot', contactId, companyId, updated: !!existingContact, message: `${existingContact ? 'Updated' : 'Created'} HubSpot contact${companyId ? ' + company' : ''}` };
}

// ------------------------------------------------------------- Salesforce ----
export async function pushSalesforce(record, instanceUrl, token) {
  const instance = instanceUrl.replace(/\/$/, '');
  const base = `${instance}/services/data/v60.0`;
  const api = async (p, method = 'GET', body) => {
    const r = await fetch(base + p, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return {};
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Salesforce ${r.status}: ${Array.isArray(d) ? d[0]?.message : d.message || r.statusText}`);
    return d;
  };
  const { card, dossier: d } = record;
  const lead = clean({
    FirstName: card.firstName,
    LastName: card.lastName || card.fullName || 'Unknown',
    Company: card.company || d?.company?.name || card.domain || 'Unknown',
    Title: card.jobTitle,
    Email: card.emails?.[0],
    Phone: phoneOf(card, 'work') || card.phones?.[0]?.number,
    MobilePhone: phoneOf(card, 'mobile'),
    Website: card.website,
    Street: card.address,
    Description: summaryText(record).slice(0, 31000),
  });
  let existing = null;
  if (lead.Email) {
    const q = `SELECT Id FROM Lead WHERE Email = '${lead.Email.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' LIMIT 1`;
    existing = (await api(`/query?q=${encodeURIComponent(q)}`)).records?.[0]?.Id || null;
  }
  let id = existing;
  if (existing) await api(`/sobjects/Lead/${existing}`, 'PATCH', lead);
  else id = (await api('/sobjects/Lead', 'POST', lead)).id;
  return { ok: true, provider: 'salesforce', id, url: `${instance}/lightning/r/Lead/${id}/view`, updated: !!existing, message: `${existing ? 'Updated' : 'Created'} Salesforce lead` };
}
