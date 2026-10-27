export interface Phone {
  type: string;
  number: string;
}

export interface Card {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  tagline: string | null;
  emails: string[];
  phones: Phone[];
  website: string | null;
  domain: string | null;
  address: string | null;
  socials: {
    linkedin?: string | null;
    twitter?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    other?: string[];
  };
  language?: string | null;
  notes?: string | null;
  confidence?: number | null;
  linkedinSource?: 'card' | 'shared' | 'user' | null;
}

export type IdentityLevel = 'verified' | 'likely' | 'possible' | 'unverified' | 'uncertain';

export interface Validation {
  country: string | null;
  emails: { value: string; syntax: boolean; mx: boolean | null; mxHost: string | null; freeMail: boolean; disposable: boolean; matchesCompanyDomain: boolean; status: 'valid' | 'no-mx' | 'invalid' | 'unknown' }[];
  phones: { value: string; e164: string | null; international: string | null; country: string | null; lineType: string | null; valid: boolean; status: 'valid' | 'possible' | 'invalid' }[];
  website: { domain: string; resolves: boolean } | null;
}

export interface FamilyNode {
  name: string;
  id?: string | null;
  source: string;
}

export interface Dossier {
  company: {
    name: string;
    legalName?: string | null;
    tagline?: string | null;
    summary?: string | null;
    industry?: string | null;
    subIndustry?: string | null;
    businessModel?: string | null;
    founded?: string | null;
    headquarters?: string | null;
    locations?: string[];
    employeeRange?: string | null;
    revenueRange?: string | null;
    ownership?: string | null;
    parentCompany?: string | null;
    dunsNumber?: string | null;
    lei?: string | null;
    logo?: string | null;
    registryInfo?: string | null;
    website?: string | null;
  };
  person: {
    name?: string | null;
    title?: string | null;
    seniority?: string | null;
    department?: string | null;
    summary?: string | null;
    linkedinUrl?: string | null;
    responsibilities?: string[];
    location?: string | null;
    employmentHistory?: { company?: string; title?: string; start?: string; end?: string; current?: boolean }[];
  };
  products: { name: string; description: string; category?: string | null }[];
  services: { name: string; description: string }[];
  targetCustomers: {
    summary?: string | null;
    segments?: string[];
    industries?: string[];
    geographies?: string[];
    buyerPersonas?: string[];
  };
  notableCustomers: { name: string; evidence: string; url?: string | null }[];
  partners: string[];
  competitors: string[];
  socialPresence: { platform: string; url: string; handle?: string | null; notes?: string | null }[];
  signals: string[];
  recentNews: { title: string; url?: string | null; date?: string | null; summary?: string | null }[];
  talkingPoints: string[];
  salesAngle?: string | null;
  caveats: string[];
  sources: { title: string; url: string }[];
  confidence?: number;
  registryRecords?: { source: string; url: string | null; title: string; fields: [string, string][] }[];
  familyTree?: { ultimateParent: FamilyNode | null; parent: FamilyNode | null; subsidiaries: string[]; familyTreeMembers?: number | null; role?: string | null; sources: string[] } | null;
  identity?: {
    person: { linkedinUrl: string | null; level: IdentityLevel; score: number; reasons: string[]; alternatives: { url: string; title: string; score: number }[] };
    company: { level: IdentityLevel; score: number; reasons: string[] };
  };
  validation?: Validation | null;
  searchProvider?: string;
  grounded?: boolean;
  cachedAt?: string | null;
  generatedAt?: string;
}

export type StepId = 'extract' | 'website' | 'registry' | 'social' | 'market' | 'research' | 'synthesize' | 'gapfill';
export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  detail?: string;
}

export type ScanEvent =
  | { type: 'step'; step: StepId; status: StepStatus; detail?: string }
  | { type: 'card'; card: Card }
  | { type: 'result'; dossier: Dossier; demo?: boolean }
  | { type: 'error'; message: string };

export type RecordStatus = 'queued' | 'processing' | 'done' | 'error';

export interface ScanRecord {
  id: string;
  createdAt: number;
  thumb?: string;
  card: Card;
  dossier?: Dossier;
  demo?: boolean;
  status?: RecordStatus;
  progress?: string;
  error?: string;
}

export interface Settings {
  geminiKey: string;
  geminiModel: string;
  grounding: boolean;
  tavilyKey: string;
  serpapiKey: string;
  companiesHouseKey: string;
  openCorporatesToken: string;
  dnbKey: string;
  dnbSecret: string;
  apolloKey: string;
  pdlKey: string;
  hubspotToken: string;
  sfInstanceUrl: string;
  sfAccessToken: string;
  eventMode: boolean;
}

export interface Health {
  ok: boolean;
  gemini: boolean;
  model: string;
  grounding: boolean;
  search: string;
  registries: string[];
  providers: string[];
  crm: string[];
}

export interface CrmResult {
  ok: boolean;
  message: string;
  url?: string;
}
