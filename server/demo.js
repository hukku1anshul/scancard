// Demo mode: used when no Gemini API key is configured. Simulates the full
// pipeline with a fictional company so the UI can be explored end-to-end.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO_CARD = {
  fullName: 'Priya Raman',
  firstName: 'Priya',
  lastName: 'Raman',
  jobTitle: 'VP, Strategic Partnerships',
  department: 'Business Development',
  company: 'Northwind Robotics',
  tagline: 'Autonomy for every warehouse',
  emails: ['priya.raman@northwind-robotics.example'],
  phones: [
    { type: 'mobile', number: '+1 415 555 0142' },
    { type: 'work', number: '+1 415 555 0100' },
  ],
  website: 'https://northwind-robotics.example',
  domain: 'northwind-robotics.example',
  address: '500 Harbor Blvd, Suite 300, San Francisco, CA 94107, USA',
  socials: { linkedin: 'https://www.linkedin.com/in/priya-raman-demo', twitter: null, facebook: null, instagram: null, other: [] },
  language: 'English',
  notes: null,
  confidence: 0.97,
};

const DEMO_DOSSIER = {
  company: {
    name: 'Northwind Robotics',
    legalName: 'Northwind Robotics, Inc.',
    tagline: 'Autonomy for every warehouse',
    summary:
      'Northwind Robotics builds autonomous mobile robots (AMRs) and fleet-orchestration software that automate picking, replenishment and pallet moves in mid-size warehouses. It sells a Robots-as-a-Service subscription aimed at 3PLs and e-commerce fulfilment centres that cannot justify fixed automation.',
    industry: 'Industrial Automation & Robotics',
    subIndustry: 'Warehouse autonomous mobile robots',
    businessModel: 'B2B hardware + SaaS (Robots-as-a-Service)',
    founded: '2017',
    headquarters: 'San Francisco, CA, USA',
    locations: ['San Francisco, CA', 'Austin, TX', 'Rotterdam, NL'],
    employeeRange: '201–500',
    revenueRange: 'Likely $50M–$100M',
    ownership: 'Private (venture-backed)',
    parentCompany: null,
    dunsNumber: '00-000-0000 (demo)',
    lei: '5493000DEMO00000000X',
    logo: null,
    registryInfo: 'Delaware C-Corp, active. Business directory lists SIC 3569 (General industrial machinery) and NAICS 333922. (Demo data)',
    website: 'https://northwind-robotics.example',
  },
  person: {
    name: 'Priya Raman',
    title: 'VP, Strategic Partnerships',
    seniority: 'VP',
    department: 'Business Development',
    summary:
      'Leads channel and integration partnerships, including WMS vendors and systems integrators. Previously held partnership roles at a supply-chain SaaS company. Frequently speaks about RaaS economics at logistics conferences.',
    linkedinUrl: 'https://www.linkedin.com/in/priya-raman-demo',
    responsibilities: ['WMS/ERP integration partnerships', 'Systems-integrator channel program', 'Co-marketing & joint GTM', 'Partner revenue targets'],
  },
  products: [
    { name: 'Northwind Pick AMR', description: 'Collaborative picking robot with 150 kg payload that follows pickers and reduces walking by up to 60%.', category: 'Hardware' },
    { name: 'Northwind Lift', description: 'Autonomous pallet mover for dock-to-stock and replenishment moves.', category: 'Hardware' },
    { name: 'FleetOS', description: 'Cloud orchestration platform for mixed robot fleets with WMS connectors, analytics and task allocation.', category: 'Software' },
  ],
  services: [
    { name: 'Robots-as-a-Service', description: 'Monthly per-robot subscription including maintenance, software and remote monitoring.' },
    { name: 'Deployment & Site Mapping', description: '4–6 week deployment with simulation-based ROI modelling.' },
    { name: '24/7 Remote Fleet Support', description: 'Remote operations centre that monitors and recovers robots.' },
  ],
  targetCustomers: {
    summary: 'Mid-size warehouses (50k–500k sq ft) operated by 3PLs, e-commerce brands and wholesale distributors facing labour shortages.',
    segments: ['Mid-market', 'Enterprise'],
    industries: ['Third-party logistics (3PL)', 'E-commerce fulfilment', 'Wholesale distribution', 'Retail'],
    geographies: ['North America', 'Western Europe'],
    buyerPersonas: ['VP Operations', 'Director of Distribution', 'Head of Supply Chain Innovation', 'CFO (for RaaS economics)'],
  },
  notableCustomers: [
    { name: 'Contoso Logistics', evidence: 'Case study: 2.1x picks per hour across 3 sites (demo).', url: null },
    { name: 'Fabrikam Outdoor', evidence: 'Logo on website customer page (demo).', url: null },
  ],
  partners: ['Major WMS vendors (integration marketplace)', 'Regional systems integrators'],
  competitors: ['Locus Robotics', '6 River Systems', 'Geek+', 'Fetch (Zebra)'],
  socialPresence: [
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/company/northwind-robotics-demo', handle: 'northwind-robotics', notes: '≈18k followers; posts weekly customer stories (demo)' },
    { platform: 'YouTube', url: 'https://www.youtube.com/@northwindrobotics-demo', handle: '@northwindrobotics', notes: 'Product demo videos' },
    { platform: 'X / Twitter', url: 'https://x.com/northwind_demo', handle: '@northwind_demo', notes: 'Low activity' },
  ],
  signals: ['Hiring 12 field deployment engineers in EU (Q3)', 'Opened Rotterdam office for European expansion', 'Launched FleetOS 3.0 with multi-vendor robot support'],
  recentNews: [
    { title: 'Northwind Robotics expands to Europe with Rotterdam hub', url: null, date: '2026-09', summary: 'New EU HQ to support Benelux and German 3PL customers.' },
    { title: 'FleetOS 3.0 adds mixed-fleet orchestration', url: null, date: '2026-06', summary: 'Supports third-party robots through an open API.' },
  ],
  talkingPoints: [
    'Congrats on the Rotterdam launch — how are you prioritising EU partners versus direct sales?',
    'FleetOS 3.0 now orchestrates third-party robots. Is the partner programme moving toward a platform/ecosystem play?',
    'Your Contoso case study showed 2.1x picks per hour. Which integrations had the most impact on time-to-value?',
    'As VP Partnerships, how do you measure partner-sourced versus partner-influenced pipeline?',
    'RaaS shifts the buying conversation to OpEx. Do partners help shape the CFO business case?',
  ],
  salesAngle:
    'Northwind is scaling a partner-led EU expansion while hiring deployment engineers. Lead with ways to speed up partner onboarding, integration and co-selling, and back it with ROI evidence that fits their RaaS model.',
  caveats: ['DEMO MODE: all data is fictional. Add a Gemini API key in Settings to scan real cards.'],
  sources: [
    { title: 'Northwind Robotics — About (demo)', url: 'https://northwind-robotics.example/about' },
    { title: 'LinkedIn company page (demo)', url: 'https://www.linkedin.com/company/northwind-robotics-demo' },
  ],
  confidence: 0.9,
  searchProvider: 'demo',
  grounded: true,
  registryRecords: [
    {
      source: 'D&B Direct+',
      url: null,
      title: 'Northwind Robotics, Inc.',
      fields: [['D-U-N-S', '00-000-0000 (demo)'], ['Match confidence', '9/10'], ['Status', 'Active'], ['Employees', '340'], ['Industry codes', 'NAICS 333922 — Conveyor and Conveying Equipment Mfg']],
    },
    {
      source: 'GLEIF',
      url: null,
      title: 'NORTHWIND ROBOTICS, INC.',
      fields: [['LEI', '5493000DEMO00000000X'], ['Status', 'ACTIVE'], ['Jurisdiction', 'US-DE'], ['Legal address', '251 Little Falls Dr, Wilmington, DE, US']],
    },
    {
      source: 'Wikidata',
      url: null,
      title: 'Northwind Robotics',
      fields: [['Founded', '2017'], ['Headquarters', 'San Francisco, United States'], ['Industry', 'robotics, warehouse automation']],
    },
  ],
  familyTree: {
    ultimateParent: { name: 'Northwind Holdings LLC (demo)', id: 'DUNS 00-000-0001', source: 'D&B' },
    parent: null,
    subsidiaries: ['Northwind Robotics B.V.', 'Northwind Robotics UK Ltd'],
    familyTreeMembers: 4,
    sources: ['D&B', 'Wikidata'],
  },
  identity: {
    person: { linkedinUrl: 'https://www.linkedin.com/in/priya-raman-demo', level: 'verified', score: 1, reasons: ['Printed on the business card'], alternatives: [] },
    company: { level: 'verified', score: 0.95, reasons: ['Email domain matches company website', 'D&B match (confidence code 9)', 'Wikidata entity matched by official website'] },
  },
  validation: {
    country: 'US',
    emails: [{ value: 'priya.raman@northwind-robotics.example', syntax: true, mx: true, mxHost: 'mx.demo', freeMail: false, disposable: false, matchesCompanyDomain: true, status: 'valid' }],
    phones: [
      { value: '+1 415 555 0142', e164: '+14155550142', international: '+1 415 555 0142', country: 'US', lineType: 'MOBILE', valid: true, status: 'valid' },
      { value: '+1 415 555 0100', e164: '+14155550100', international: '+1 415 555 0100', country: 'US', lineType: 'FIXED_LINE', valid: true, status: 'valid' },
    ],
    website: { domain: 'northwind-robotics.example', resolves: true },
  },
};

export async function runDemo(body, emit) {
  const step = (id, status, detail) => emit({ type: 'step', step: id, status, detail });
  const card = body.card ? { ...DEMO_CARD, ...body.card } : DEMO_CARD;

  step('extract', 'running', 'Demo: simulating Vision AI…');
  await sleep(900);
  step('extract', 'done', `${card.fullName} · ${card.company}`);
  emit({ type: 'card', card });

  for (const [id, label, done] of [
    ['website', 'Crawling northwind-robotics.example', 'Read 6 page(s) (demo)'],
    ['registry', 'Querying GLEIF, Wikidata, SEC EDGAR, D&B…', 'Verified: D&B, GLEIF, Wikidata (demo)'],
    ['social', 'Searching LinkedIn & social profiles', '7 result(s) (demo)'],
    ['market', 'Finding customers, case studies & news', '11 result(s) (demo)'],
    ['research', 'Gemini + Google Search deep research…', '14 grounded source(s) (demo)'],
  ]) {
    step(id, 'running', label);
    await sleep(550);
    step(id, 'done', done);
  }
  step('synthesize', 'running', 'Building 360° dossier…');
  await sleep(900);
  step('synthesize', 'done', 'Draft dossier ready');
  step('gapfill', 'running', 'Looking for: news from the last 12 months');
  await sleep(600);
  step('gapfill', 'done', 'Filled 1/1 gap(s) (demo)');
  emit({ type: 'result', dossier: { ...DEMO_DOSSIER, generatedAt: new Date().toISOString() }, demo: true });
}
