// Demo mode: used when no Gemini API key is configured. Simulates the full
// pipeline with fictional US or Indian companies so the UI can be explored end-to-end.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO_CARD_INDIA = {
  fullName: 'Rajesh Deshmukh',
  firstName: 'Rajesh',
  lastName: 'Deshmukh',
  jobTitle: 'Managing Director',
  department: 'Executive Management',
  company: 'Bharat Precision Engg. Pvt. Ltd.',
  tagline: 'EV Powertrain & CNC Automation · ISO 9001 & IATF 16949',
  emails: ['rajesh.d@bharatprecision.co.in'],
  phones: [
    { type: 'whatsapp', number: '+91 98220 45120' },
    { type: 'work', number: '+91 20 2712 8800' },
  ],
  website: 'https://www.bharatprecision.co.in',
  domain: 'bharatprecision.co.in',
  address: 'Plot E-42, MIDC Bhosari, Pune - 411026, Maharashtra, India',
  gstin: '27AABCB4512R1Z6',
  cin: 'U28100MH2015PTC268901',
  socials: { linkedin: 'https://www.linkedin.com/in/rajesh-deshmukh-demo', twitter: null, facebook: null, instagram: null, other: [] },
  language: 'English / Hindi',
  notes: 'Hall 4, Stall B-18 · Bharat Mobility Global Expo',
  confidence: 0.98,
};

const DEMO_DOSSIER_INDIA = {
  company: {
    name: 'Bharat Precision Engg. Pvt. Ltd.',
    legalName: 'BHARAT PRECISION ENGINEERING PRIVATE LIMITED',
    tagline: 'EV Powertrain & CNC Automation · ISO 9001 & IATF 16949',
    summary:
      'Bharat Precision Engineering Pvt. Ltd. manufactures high-precision CNC machined EV powertrain housings, transmission gears, and robotic welding fixtures for Indian and European automotive OEMs and Tier-1 suppliers from its two plants in MIDC Bhosari and Chakan, Pune.',
    industry: 'Machinery & Industrial Equipment (NIC 28100)',
    subIndustry: 'EV Powertrain Components & Industrial Automation',
    businessModel: 'B2B OEM Manufacturing & Export',
    founded: '2015',
    headquarters: 'Pune, Maharashtra, India',
    locations: ['MIDC Bhosari, Pune (Plant I)', 'Chakan Industrial Area, Pune (Plant II)', 'Gurugram Sales Office'],
    employeeRange: '250–500',
    revenueRange: '₹145 Cr (FY25)',
    ownership: 'Private Limited Company (Pvt. Ltd.)',
    parentCompany: null,
    dunsNumber: '86-214-0092 (demo)',
    lei: '335800DEMOIND000001Z',
    cin: 'U28100MH2015PTC268901',
    gstin: '27AABCB4512R1Z6',
    pan: 'AABCB4512R',
    logo: null,
    registryInfo:
      'Registered with RoC Mumbai/Pune under CIN U28100MH2015PTC268901 (Active). Paid-up capital ₹12.5 Cr. GSTIN 27AABCB4512R1Z6 active in Maharashtra (27). CRISIL BBB+/Stable credit rating. (Demo data)',
    website: 'https://www.bharatprecision.co.in',
  },
  person: {
    name: 'Rajesh Deshmukh',
    title: 'Managing Director',
    seniority: 'C-level',
    department: 'Executive Management',
    summary:
      'Founder & Managing Director (DIN: 07128901) with 22+ years in automotive tooling and EV component manufacturing. Leads OEM strategic accounts with Tata Motors, Mahindra, and Bosch India.',
    linkedinUrl: 'https://www.linkedin.com/in/rajesh-deshmukh-demo',
    responsibilities: ['OEM & Tier-1 strategic relationships', 'Chakan EV plant expansion (₹40 Cr capex)', 'Export partnerships (Germany & Japan)', 'Plant automation & quality'],
  },
  products: [
    { name: 'EV Motor & Inverter Housings', description: '5-axis CNC machined aluminum die-cast housings for 2W/3W and passenger EVs.', category: 'EV Components' },
    { name: 'Precision Planetary Gear Assemblies', description: 'Hardened & ground helical/planetary gear sets for electric axles.', category: 'Powertrain' },
    { name: 'Robotic BIW Welding Fixtures', description: 'Turnkey automated welding cells and gauges for automotive assembly lines.', category: 'Automation' },
  ],
  services: [
    { name: 'Rapid Prototyping & PPAP Batch Production', description: '3-week CAD-to-sample turnaround for automotive Tier-1 qualification.' },
    { name: 'Contract CNC Machining (Export)', description: 'Dedicated export lines for German and Japanese industrial machinery OEMs.' },
  ],
  targetCustomers: {
    summary: 'Indian and global automotive OEMs, EV 2W/3W/4W manufacturers, and Tier-1 driveline suppliers seeking IATF 16949 certified precision machining in Pune.',
    segments: ['Enterprise OEMs', 'Tier-1 Auto Suppliers', 'EV Startups'],
    industries: ['Automotive & EV', 'Industrial Automation', 'Aerospace & Defense'],
    geographies: ['India (Pune, Chennai, NCR, Bengaluru)', 'Germany', 'Japan'],
    buyerPersonas: ['VP Procurement / Strategic Sourcing', 'Head of EV Powertrain Engineering', 'Plant Head', 'Supply Chain Director'],
  },
  notableCustomers: [
    { name: 'Tata Passenger Electric Mobility (Demo)', evidence: 'Tier-1 supplier for motor housing machining in Pune.', url: null },
    { name: 'Bajaj Auto / Chetak EV (Demo)', evidence: 'Supplies precision transmission shafts and aluminium castings.', url: null },
  ],
  partners: ['Siemens Digital Industries (NX CAM)', 'Fanuc India (Robotic cell integration)'],
  competitors: ['Sansera Engineering', 'Endurance Technologies', 'Rico Auto Industries', 'Craftsman Automation'],
  socialPresence: [
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/company/bharat-precision-demo', handle: 'bharat-precision-engg', notes: '≈9.5k followers; active expo & plant updates (demo)' },
    { platform: 'IndiaMART', url: 'https://www.indiamart.com/bharatprecision-demo', handle: 'TrustSEAL Verified Exporter', notes: '4.8★ rating · 140+ listed CNC & EV components' },
  ],
  signals: [
    'Commissioned 35,000 sq. ft. Chakan Phase-II EV plant with ₹40 Cr investment (Q2 2026)',
    'Awarded Best Zero-Defect Supplier by a leading Pune EV OEM',
    'Hiring 18 CNC programmers and QA engineers in Pune',
  ],
  recentNews: [
    { title: 'Bharat Precision expands EV powertrain capacity in Chakan, Pune', url: null, date: '2026-08', summary: 'Added 14 new 5-axis Japanese VMC machines to serve domestic and EU EV demand.' },
    { title: 'Showcasing next-gen lightweight e-axle housings at Bharat Mobility Expo', url: null, date: '2026-10', summary: 'Exhibiting at Hall 4, Stall B-18.' },
  ],
  talkingPoints: [
    'Congrats on commissioning the Chakan Phase-II EV facility — how is capacity utilization ramping up across 2W vs 4W EV housings?',
    'With 14 new 5-axis VMCs online, are you looking at predictive tool-wear monitoring or MES automation across Bhosari and Chakan?',
    'How are export inquiries from German Tier-1s trending compared to domestic EV OEM orders this quarter?',
    'Since you hold IATF 16949 & ISO 9001, how are you managing automated PPAP documentation and traceability for EV customers?',
    'Great meeting you at Hall 4 — would love to share our catalog and schedule a plant visit in Bhosari next week.',
  ],
  salesAngle:
    'Bharat Precision is actively investing ₹40 Cr in its Chakan EV plant and scaling export orders. Pitch solutions that improve spindle utilization, quality traceability, or working-capital/supply-chain efficiency across their Bhosari and Chakan plants.',
  caveats: ['DEMO MODE: fictional Indian manufacturing dossier showing MCA CIN, GSTIN, PIN code & INR Cr intelligence. Add a Gemini API key in Settings for live scans.'],
  sources: [
    { title: 'India MCA / ZaubaCorp — U28100MH2015PTC268901 (demo)', url: 'https://www.mca.gov.in' },
    { title: 'GST Portal — 27AABCB4512R1Z6 (demo)', url: 'https://services.gst.gov.in' },
    { title: 'IndiaMART Verified Exporter Catalog (demo)', url: 'https://www.indiamart.com' },
  ],
  confidence: 0.94,
  searchProvider: 'demo',
  grounded: true,
  registryRecords: [
    {
      source: 'India MCA / GST',
      url: 'https://www.mca.gov.in',
      title: 'BHARAT PRECISION ENGINEERING PRIVATE LIMITED',
      fields: [
        ['CIN / LLPIN', 'U28100MH2015PTC268901'],
        ['GSTIN', '27AABCB4512R1Z6'],
        ['PAN', 'AABCB4512R'],
        ['Constitution', 'Private Limited Company (Pvt. Ltd.)'],
        ['Listing status', 'Unlisted'],
        ['Incorporation year', '2015'],
        ['State / ROC', 'Maharashtra (RoC Pune)'],
        ['NIC industry sector', 'Machinery & Industrial Equipment (28100)'],
        ['Paid-up capital', '₹12.50 Cr (Authorized: ₹15.00 Cr)'],
        ['Directors (DIN)', 'Rajesh Deshmukh (07128901), Sunita Deshmukh (07128902)'],
        ['PIN code', '411026 (Bhosari MIDC, Maharashtra)'],
      ],
    },
    {
      source: 'GLEIF',
      url: null,
      title: 'BHARAT PRECISION ENGINEERING PRIVATE LIMITED',
      fields: [['LEI', '335800DEMOIND000001Z'], ['Status', 'ACTIVE'], ['Jurisdiction', 'IN-MH'], ['Legal address', 'Plot E-42, MIDC Bhosari, Pune 411026, MH, IN']],
    },
  ],
  familyTree: {
    ultimateParent: null,
    parent: null,
    subsidiaries: ['Bharat Precision Castings LLP (Chakan)', 'Bharat Automation Systems Pvt. Ltd.'],
    familyTreeMembers: 3,
    sources: ['MCA', 'GLEIF'],
  },
  identity: {
    person: { linkedinUrl: 'https://www.linkedin.com/in/rajesh-deshmukh-demo', level: 'verified', score: 1, reasons: ['Printed on the business card', 'Verified MCA Director (DIN 07128901)'], alternatives: [] },
    company: { level: 'verified', score: 0.98, reasons: ['Valid 21-digit MCA CIN U28100MH2015PTC268901', 'Valid Maharashtra GSTIN 27AABCB4512R1Z6 (PAN: AABCB4512R)', 'Email domain matches .co.in website'] },
  },
  validation: {
    country: 'IN',
    emails: [{ value: 'rajesh.d@bharatprecision.co.in', syntax: true, mx: true, mxHost: 'mx.bharatprecision.co.in', freeMail: false, disposable: false, matchesCompanyDomain: true, status: 'valid' }],
    phones: [
      { value: '+91 98220 45120', e164: '+919822045120', international: '+91 98220 45120', country: 'IN', lineType: 'WHATSAPP', valid: true, status: 'valid' },
      { value: '+91 20 2712 8800', e164: '+912027128800', international: '+91 20 2712 8800', country: 'IN', lineType: 'FIXED_LINE', valid: true, status: 'valid' },
    ],
    website: { domain: 'bharatprecision.co.in', resolves: true },
  },
};

export async function runDemo(body, emit) {
  const step = (id, status, detail) => emit({ type: 'step', step: id, status, detail });
  // Use our Indian demo card by default so Indian market features (GSTIN, CIN, MCA, ₹ Cr, WhatsApp) are immediately visible!
  const card = body.card ? { ...DEMO_CARD_INDIA, ...body.card } : DEMO_CARD_INDIA;

  step('extract', 'running', 'Demo: simulating Vision AI + GSTIN/CIN parser…');
  await sleep(800);
  step('extract', 'done', `${card.fullName} · ${card.company}`);
  emit({ type: 'card', card });

  for (const [id, label, done] of [
    ['website', `Crawling ${card.domain || 'bharatprecision.co.in'}`, 'Read 6 page(s) (demo)'],
    ['registry', 'Querying India MCA/GST, GLEIF, Wikidata, D&B…', 'Verified: India MCA/GST (CIN + GSTIN), GLEIF (demo)'],
    ['social', 'Searching LinkedIn, IndiaMART & people data', '9 result(s) (demo)'],
    ['market', 'Finding OEM customers, case studies & news', '12 result(s) (demo)'],
    ['research', 'Gemini + Google Search deep research…', '15 grounded source(s) (demo)'],
  ]) {
    step(id, 'running', label);
    await sleep(500);
    step(id, 'done', done);
  }
  step('synthesize', 'running', 'Building 360° dossier…');
  await sleep(800);
  step('synthesize', 'done', 'Draft dossier ready');
  step('gapfill', 'running', 'Looking for: Chakan plant expansion & FY25 revenue');
  await sleep(500);
  step('gapfill', 'done', 'Filled 1/1 gap(s) (demo)');
  emit({ type: 'result', dossier: { ...DEMO_DOSSIER_INDIA, generatedAt: new Date().toISOString() }, demo: true });
}
