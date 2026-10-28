import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIndianIdsFromText, decodeGstin, decodeCin } from './server/india.js';
import { buildKycScorecard } from './server/synthesize.js';
import { renderExecutiveHtmlReport } from './server/report.js';
import {
  upsertRecord,
  getRecordById,
  getAllRecords,
  deleteRecord,
  getAnalytics,
} from './server/db.js';

test('PERSONA 1: Sales & BD Executive Workflow', async () => {
  const recordId = 'test-sales-rep-' + Date.now();
  const salesRecord = {
    id: recordId,
    createdAt: Date.now(),
    tenantId: 'tenant-sales-rep',
    card: {
      fullName: 'Vikram Mehta',
      jobTitle: 'VP of Engineering',
      company: 'TechFlow Automations Pvt Ltd',
      emails: ['vikram.mehta@techflow.in'],
      phones: [{ type: 'whatsapp', number: '+91 98201 12345' }],
      website: 'https://techflow.in',
      gstin: '27AABCT3518Q1Z6',
      cin: 'U72200MH2018PTC309876',
    },
    event: 'Bharat Mobility Expo 2026',
    booth: 'Hall 4, B-18',
    location: { label: 'Pragati Maidan, New Delhi', lat: 28.61, lng: 77.24 },
    contactRole: 'buyer',
    priority: 'hot',
    dealValue: '₹50 Lakh',
    actionItems: ['Send Catalog / Brochure', 'Book Demo', 'WhatsApp Intro'],
    meetingNotes: [{ id: 'n1', text: 'Met at Booth B-18. Looking to automate 5 manufacturing plants.', createdAt: Date.now() }],
    associatedContacts: [{ id: 'c1', name: 'Pooja Shah', role: 'Head of Procurement', email: 'pooja@techflow.in' }],
    status: 'done',
  };

  // 1. Persistence
  const saved = upsertRecord(salesRecord, 'tenant-sales-rep');
  assert.equal(saved.id, recordId);
  assert.equal(saved.priority, 'hot');
  assert.equal(saved.dealValue, '₹50 Lakh');

  // 2. Retrieval
  const fetched = getRecordById(recordId, 'tenant-sales-rep');
  assert.ok(fetched);
  assert.equal(fetched.card.fullName, 'Vikram Mehta');
  assert.equal(fetched.associatedContacts.length, 1);
  assert.equal(fetched.actionItems.length, 3);

  // 3. Clean up
  deleteRecord(recordId, 'tenant-sales-rep');
  assert.equal(getRecordById(recordId, 'tenant-sales-rep'), null);
});

test('PERSONA 2: Vendor Onboarding & Procurement KYC Audit', async () => {
  const rawGstin = '27 AABCB 4512 R 1 Z 6';
  const rawCin = 'U 72200 MH 2018 PTC 309876';

  // 1. Indian Statutory Extractors
  const extracted = extractIndianIdsFromText(`Tax Invoice GSTIN: ${rawGstin} CIN: ${rawCin}`);
  assert.equal(extracted.gstin, '27AABCB4512R1Z6');
  assert.equal(extracted.cin, 'U72200MH2018PTC309876');

  const gstinDecoded = decodeGstin(extracted.gstin);
  assert.equal(gstinDecoded.state, 'Maharashtra');

  const cinDecoded = decodeCin(extracted.cin);
  assert.equal(cinDecoded.state, 'Maharashtra');

  // 2. 5-Point KYC Scorecard
  const card = { gstin: extracted.gstin, cin: extracted.cin };
  const d = {
    company: { name: 'Acme Bharat Components Pvt Ltd', legalName: 'Acme Bharat Components Pvt Ltd', gstin: extracted.gstin, cin: extracted.cin },
    identity: { company: { level: 'verified', score: 95 } },
  };
  const evidence = {
    validation: {
      emails: [{ value: 'sales@acmebharat.in', status: 'valid', matchesCompanyDomain: true }],
      website: { domain: 'acmebharat.in', resolves: true },
    },
    registry: { india: { gstin: extracted.gstin } },
  };
  const kyc = buildKycScorecard(card, d, evidence);

  assert.ok(kyc.score >= 80, `KYC score should be >= 80, got ${kyc.score}`);
  assert.equal(kyc.tier, 'verified');
  assert.equal(kyc.checks.length, 5);

  // 3. Executive PDF / HTML Report Generation
  const dummyRecord = {
    id: 'rec-kyc-test',
    createdAt: Date.now(),
    card: { fullName: 'Rajesh Sharma', company: 'Acme Bharat Components Pvt Ltd', emails: ['rajesh@acmebharat.in'], phones: [{ number: '+91 98200 55555' }], gstin: extracted.gstin, cin: extracted.cin },
    dossier: {
      company: { name: 'Acme Bharat Components Pvt Ltd', legalName: 'Acme Bharat Components Pvt Ltd', industry: 'Automotive Components', gstin: extracted.gstin, cin: extracted.cin },
      kyc,
    },
    priority: 'hot',
    dealValue: '₹1.5 Cr',
    event: 'Auto Expo 2026',
    booth: 'Hall 3, Stall A-12',
    actionItems: ['Approve Vendor Onboarding', 'Verify GST & PAN'],
  };

  const html = renderExecutiveHtmlReport(dummyRecord);
  assert.ok(html.includes('Acme Bharat Components Pvt Ltd'), 'Report must contain company name');
  assert.ok(html.includes('27AABCB4512R1Z6'), 'Report must contain GSTIN');
  assert.ok(html.includes('Vendor KYC & Trust Scorecard'), 'Report must contain KYC section');
  assert.ok(html.includes('Auto Expo 2026'), 'Report must contain event context');
});

test('PERSONA 3: Founder & Executive Intelligence & Analytics', async () => {
  const tenant = 'tenant-cxo-' + Date.now();
  const r1 = {
    id: 'cxo-1',
    createdAt: Date.now(),
    tenantId: tenant,
    card: { company: 'FinTech Alpha' },
    event: 'SaaSBoomi 2026',
    priority: 'hot',
    dealValue: '₹50 Lakh',
    contactRole: 'buyer',
    status: 'done',
  };
  const r2 = {
    id: 'cxo-2',
    createdAt: Date.now(),
    tenantId: tenant,
    card: { company: 'Solar Tech' },
    event: 'Elecrama 2026',
    priority: 'warm',
    dealValue: '₹25 Lakh',
    contactRole: 'partner',
    status: 'done',
  };

  upsertRecord(r1, tenant);
  upsertRecord(r2, tenant);

  const analytics = getAnalytics(tenant);
  assert.equal(analytics.totalScans, 2);
  assert.equal(analytics.priorityBreakdown.hot, 1);
  assert.equal(analytics.priorityBreakdown.warm, 1);
  assert.equal(analytics.roleBreakdown.buyer, 1);
  assert.equal(analytics.roleBreakdown.partner, 1);
  assert.equal(analytics.events.length, 2);

  // Clean up
  deleteRecord('cxo-1', tenant);
  deleteRecord('cxo-2', tenant);
});

test('PERSONA 4: Multi-Tenant Isolation & Admin Configurable Features', async () => {
  const tenantA = 'tenant-mumbai-sales';
  const tenantB = 'tenant-delhi-procurement';

  const recA = { id: 'mumbai-rec-1', card: { fullName: 'Aarav Patel', company: 'Mumbai Traders' }, tenantId: tenantA };
  const recB = { id: 'delhi-rec-1', card: { fullName: 'Sanjay Verma', company: 'Delhi Logistics' }, tenantId: tenantB };

  upsertRecord(recA, tenantA);
  upsertRecord(recB, tenantB);

  // Verify Tenant A only sees Tenant A's records
  const listA = getAllRecords({ tenantId: tenantA }).records;
  assert.ok(listA.find(r => r.id === 'mumbai-rec-1'));
  assert.equal(listA.find(r => r.id === 'delhi-rec-1'), undefined, 'Tenant A must NOT see Tenant B data');

  // Verify Tenant B only sees Tenant B's records
  const listB = getAllRecords({ tenantId: tenantB }).records;
  assert.ok(listB.find(r => r.id === 'delhi-rec-1'));
  assert.equal(listB.find(r => r.id === 'mumbai-rec-1'), undefined, 'Tenant B must NOT see Tenant A data');

  // Clean up
  deleteRecord('mumbai-rec-1', tenantA);
  deleteRecord('delhi-rec-1', tenantB);
});
