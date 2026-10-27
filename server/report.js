/**
 * Executive Printable & PDF Report Generator.
 * Formats a clean, high-density 2-page briefing document for Procurement,
 * Credit/NBFC appraisal, or Executive B2B sales meetings.
 */

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderExecutiveHtmlReport(record) {
  const c = record.card || {};
  const d = record.dossier || {};
  const co = d.company || {};
  const kyc = d.kyc;
  const companyName = co.name || c.company || 'Enterprise Entity';

  const gstin = c.gstin || co.gstin;
  const cin = c.cin || co.cin;
  const pan = co.pan;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Executive Dossier & KYC Report — ${esc(companyName)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 18pt;
      font-weight: 700;
      color: #1e1b4b;
      margin: 0 0 4px 0;
    }
    .company-tagline {
      font-size: 10pt;
      color: #475569;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 9pt;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 8.5pt;
      font-weight: 600;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-verified { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-standard { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-review { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    
    .grid { display: grid; grid-cols: 2; grid-gap: 12px; }
    .col-2 { display: grid; grid-template-columns: 1fr 1fr; grid-gap: 12px; margin-bottom: 14px; }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .card-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4338ca;
      margin: 0 0 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 9.5pt; }
    .stat-label { color: #64748b; }
    .stat-val { font-weight: 600; color: #0f172a; text-align: right; }
    
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1e1b4b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 14px 0 8px 0;
    }
    .prose { font-size: 9.5pt; color: #334155; margin: 0 0 10px 0; }
    .checklist { margin: 6px 0; padding: 0; list-style: none; font-size: 9pt; }
    .checklist li { margin-bottom: 4px; display: flex; align-items: flex-start; gap: 6px; }
    .check-icon { font-weight: bold; color: #16a34a; }
    
    .print-bar {
      background: #1e1b4b;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-radius: 6px;
    }
    .print-btn {
      background: #4f46e5;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      .print-bar { display: none; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span><b>CardIntel 360° Intelligence & KYC Report</b></span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="company-title">${esc(companyName)}</h1>
      <p class="company-tagline">${esc(co.tagline || c.tagline || 'Commercial & Enterprise Entity')}</p>
      ${co.website ? `<p style="margin:2px 0;font-size:9pt;"><a href="${esc(co.website)}" target="_blank" style="color:#4f46e5;text-decoration:none;">${esc(co.website)}</a></p>` : ''}
    </div>
    <div class="meta-box">
      <div><b>Dossier ID:</b> ${esc(record.id)}</div>
      <div><b>Generated:</b> ${new Date(record.createdAt || Date.now()).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
      ${record.event ? `<div><b>Event:</b> ${esc(record.event)}${record.booth ? ` (${esc(record.booth)})` : ''}</div>` : ''}
      ${record.location?.label ? `<div><b>GPS Site Visit:</b> ${esc(record.location.label)}</div>` : ''}
    </div>
  </div>

  <div class="col-2">
    <!-- Statutory & Registry Card -->
    <div class="card">
      <div class="card-title">Statutory Registry & Compliance</div>
      ${gstin ? `<div class="stat-row"><span class="stat-label">GSTIN (India):</span><span class="stat-val">${esc(gstin)}</span></div>` : ''}
      ${pan ? `<div class="stat-row"><span class="stat-label">Permanent Account No (PAN):</span><span class="stat-val">${esc(pan)}</span></div>` : ''}
      ${cin ? `<div class="stat-row"><span class="stat-label">Corporate ID (MCA CIN):</span><span class="stat-val">${esc(cin)}</span></div>` : ''}
      ${co.lei ? `<div class="stat-row"><span class="stat-label">LEI (GLEIF):</span><span class="stat-val">${esc(co.lei)}</span></div>` : ''}
      ${co.dunsNumber ? `<div class="stat-row"><span class="stat-label">D-U-N-S Number:</span><span class="stat-val">${esc(co.dunsNumber)}</span></div>` : ''}
      ${co.founded ? `<div class="stat-row"><span class="stat-label">Incorporation Year:</span><span class="stat-val">${esc(co.founded)}</span></div>` : ''}
      ${co.ownership ? `<div class="stat-row"><span class="stat-label">Constitution:</span><span class="stat-val">${esc(co.ownership)}</span></div>` : ''}
      ${co.headquarters ? `<div class="stat-row"><span class="stat-label">Headquarters:</span><span class="stat-val">${esc(co.headquarters)}</span></div>` : ''}
    </div>

    <!-- KYC & Trust Scorecard -->
    <div class="card">
      <div class="card-title">
        <span>Vendor KYC & Trust Scorecard</span>
        ${kyc ? `<span class="badge ${kyc.tier === 'verified' ? 'badge-verified' : kyc.tier === 'standard' ? 'badge-standard' : 'badge-review'}">${kyc.score}/100 · ${esc(kyc.tier)}</span>` : ''}
      </div>
      ${kyc ? `<p style="font-size:8.5pt;color:#475569;margin:0 0 6px 0;">${esc(kyc.summary)}</p>` : ''}
      <ul class="checklist">
        ${(kyc?.checks || []).map((chk) => `
          <li>
            <span class="check-icon">${chk.status === 'verified' ? '✓' : '!'}</span>
            <div><b>${esc(chk.label)}:</b> ${esc(chk.detail)}</div>
          </li>
        `).join('')}
      </ul>
    </div>
  </div>

  <div class="section-title">Company Overview & Business Model</div>
  <p class="prose">${esc(co.summary || 'Summary unavailable.')}</p>

  <div class="col-2">
    <div>
      <div class="section-title">Products & Core Offerings</div>
      <ul style="margin:4px 0;padding-left:16px;font-size:9pt;color:#334155;">
        ${(d.products || []).slice(0, 5).map((p) => `<li><b>${esc(p.name)}</b>: ${esc(p.description)}</li>`).join('') || '<li>None cataloged</li>'}
      </ul>
    </div>
    <div>
      <div class="section-title">Notable Clients & Market Footprint</div>
      <ul style="margin:4px 0;padding-left:16px;font-size:9pt;color:#334155;">
        ${(d.notableCustomers || []).slice(0, 5).map((cl) => `<li><b>${esc(cl.name)}</b>: ${esc(cl.evidence)}</li>`).join('') || '<li>Standard B2B commercial accounts</li>'}
      </ul>
    </div>
  </div>

  <div class="section-title">Key Executive Contacts & Meeting Record</div>
  <div class="card" style="margin-bottom:12px;">
    <div class="stat-row">
      <span><b>${esc(c.fullName || d.person?.name || 'Contact')}</b> — ${esc(c.jobTitle || d.person?.title || 'Representative')}</span>
      <span>${record.contactRole ? `<span class="badge badge-standard">${esc(record.contactRole)}</span>` : ''}</span>
    </div>
    <div style="font-size:9pt;color:#475569;margin-top:4px;">
      ${(c.emails || []).length ? `Email: <b>${esc(c.emails.join(', '))}</b> &nbsp;|&nbsp; ` : ''}
      ${(c.phones || []).length ? `Phone: <b>${esc(c.phones.map((p) => p.number).join(', '))}</b> &nbsp;|&nbsp; ` : ''}
      ${c.address ? `Address: ${esc(c.address)}` : ''}
    </div>
  </div>

  ${record.actionItems?.length ? `
    <div class="section-title">Follow-Up Action Items</div>
    <ul class="checklist">
      ${record.actionItems.map((act) => `<li><span class="check-icon">☐</span> <b>${esc(act)}</b></li>`).join('')}
    </ul>
  ` : ''}

  ${record.meetingNotes?.length ? `
    <div class="section-title">Meeting Notes</div>
    <div class="prose">
      ${record.meetingNotes.map((n) => `<p style="margin:4px 0;">• ${esc(n.text)}</p>`).join('')}
    </div>
  ` : ''}

  <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:8pt;color:#94a3b8;display:flex;justify-content:space-between;">
    <span>Generated by CardIntel 360° Field Intelligence Platform</span>
    <span>Confidential — Internal Business Use Only</span>
  </div>
</body>
</html>`;
}
