import { useEffect, useState } from 'react';
import {
  ArrowLeft, Building2, Copy, Download, ExternalLink, Globe, Mail, MapPin, MessageSquare, Newspaper, Package, Pencil, Phone,
  ShieldCheck, Sparkles, Target, Trash2, TrendingUp, UserPlus, Users, Link2, Briefcase, AlertTriangle, Check, FileDown,
  RefreshCw, Send, Network, BadgeCheck, Loader2, X, History as HistoryIcon, Database, Calendar, Plus, StickyNote,
  LocateFixed, Flame, Mic, MicOff, Bell, Share2, Store, CheckSquare, IndianRupee, Printer,
} from 'lucide-react';
import type { AssociatedContact, ContactRole, CrmResult, DossierTab, IdentityLevel, LeadPriority, ScanRecord, Settings, Validation } from '../types';
import { Chips, ExtLink, Fact, Section, hostOf, initials } from './ui';
import {
  associateToVCard,
  downloadCalendarReminder,
  downloadFile,
  generateOutreachDrafts,
  googleCalendarUrl,
  type OutreachTone,
  shareOrDownloadVCard,
  toMarkdown,
} from '../lib/export';
import { captureGeoLocation, mapsUrl } from '../lib/geo';
import { uid } from '../lib/storage';

const TABS: { id: DossierTab; label: string }[] = [
  { id: 'overview', label: 'Company 360°' },
  { id: 'notes', label: 'Notes & Team' },
  { id: 'contact', label: 'Contact' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'customers', label: 'Customers' },
  { id: 'social', label: 'Social & News' },
  { id: 'pitch', label: 'Pitch & Follow-Up' },
  { id: 'sources', label: 'Sources' },
];

const PRIORITIES: { id: LeadPriority; label: string; cls: string }[] = [
  { id: 'hot', label: 'Hot Lead', cls: 'bg-rose-500/20 text-rose-300 border-rose-400/30' },
  { id: 'warm', label: 'Warm', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
  { id: 'cold', label: 'Cold', cls: 'bg-sky-500/20 text-sky-300 border-sky-400/30' },
  { id: 'partner', label: 'Partner', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
];

const CONTACT_ROLES: { id: ContactRole; label: string }[] = [
  { id: 'buyer', label: 'Buyer / Client' },
  { id: 'distributor', label: 'Distributor / Dealer' },
  { id: 'partner', label: 'Channel Partner' },
  { id: 'vendor', label: 'Vendor / Supplier' },
  { id: 'investor', label: 'Investor' },
  { id: 'speaker', label: 'Speaker / Media' },
];

const ACTION_PRESETS = [
  'Send Catalog / Brochure',
  'Send Price List / Quote',
  'Book Demo',
  'Share Sample',
  'WhatsApp Intro',
  'Factory / Office Visit',
];

const DEAL_PRESETS = ['₹5 Lakh', '₹15 Lakh', '₹50 Lakh', '₹1 Cr+', '$10K', '$50K+'];

interface Props {
  record: ScanRecord;
  initialTab?: DossierTab;
  settings: Settings;
  companyContacts: ScanRecord[];
  recentEvents: string[];
  crmTargets: string[];
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onUpdateRecord: (patch: Partial<ScanRecord>) => void;
  onSelectRecord: (r: ScanRecord) => void;
  onPushCrm: (provider: 'hubspot' | 'salesforce') => Promise<CrmResult>;
  onDelete: () => void;
}

const LEVEL_STYLE: Record<IdentityLevel, string> = {
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  likely: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  possible: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  uncertain: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  unverified: 'bg-white/5 text-slate-400 border-white/10',
};

export function IdentityBadge({ level, title }: { level: IdentityLevel; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${LEVEL_STYLE[level]}`}>
      {level === 'verified' && <BadgeCheck className="h-3 w-3" />}
      {level}
    </span>
  );
}

function ValidityDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    valid: ['text-emerald-400', 'Valid'],
    possible: ['text-amber-400', 'Possible'],
    'no-mx': ['text-rose-400', 'No mail server'],
    invalid: ['text-rose-400', 'Invalid'],
    unknown: ['text-slate-500', 'Unverified'],
  };
  const [cls, label] = map[status] || map.unknown;
  return <span className={`ml-1.5 text-[10px] font-medium ${cls}`}>● {label}</span>;
}

export default function DossierView({
  record,
  initialTab = 'overview',
  settings,
  companyContacts,
  recentEvents,
  crmTargets,
  onBack,
  onEdit,
  onRefresh,
  onUpdateRecord,
  onSelectRecord,
  onPushCrm,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<DossierTab>(initialTab);
  const [copied, setCopied] = useState<string | null>(null);
  const [crmOpen, setCrmOpen] = useState(false);

  // Quick-add phone / email state
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState('whatsapp');
  const [newEmail, setNewEmail] = useState('');

  // Add colleague / associated contact state
  const [showAddColleague, setShowAddColleague] = useState(false);
  const [colName, setColName] = useState('');
  const [colRole, setColRole] = useState('');
  const [colDept, setColDept] = useState('');
  const [colEmail, setColEmail] = useState('');
  const [colPhone, setColPhone] = useState('');
  const [colLinkedin, setColLinkedin] = useState('');
  const [colNotes, setColNotes] = useState('');

  // Meeting note & voice dictation state
  const [noteInput, setNoteInput] = useState('');
  const [listening, setListening] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Outreach generator state
  const isIndiaCard = Boolean(
    record.dossier?.validation?.country === 'IN' ||
      record.card.gstin ||
      record.card.cin ||
      record.dossier?.company.gstin ||
      record.dossier?.company.cin ||
      record.card.phones.some((p) => p.number.startsWith('+91')),
  );
  const [outreachChannel, setOutreachChannel] = useState<'whatsapp' | 'email' | 'linkedin'>(isIndiaCard ? 'whatsapp' : 'email');
  const [outreachTone, setOutreachTone] = useState<OutreachTone>(isIndiaCard ? 'india_b2b' : 'professional');
  const drafts = generateOutreachDrafts(record, settings, outreachTone);
  const [customDraft, setCustomDraft] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, record.id]);

  useEffect(() => {
    setCustomDraft(null);
  }, [outreachChannel, outreachTone, record.id, record.event, record.booth, record.location?.label, record.actionItems?.length, record.meetingNotes?.length, record.associatedContacts?.length]);

  const { card, dossier: d } = record;
  const v: Validation | null | undefined = d?.validation;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const companyName = d?.company.name || card.company || card.domain || 'Unknown company';
  const emailV = (e: string) => v?.emails.find((x) => x.value === e);
  const phoneV = (p: string) => v?.phones.find((x) => x.value === p);

  // Determine best WhatsApp phone number
  const waPhoneObj = card.phones.find((p) => p.type === 'whatsapp' || p.type === 'mobile') || card.phones[0];
  const waDigits = waPhoneObj
    ? (phoneV(waPhoneObj.number)?.e164 || waPhoneObj.number).replace(/[^\d]/g, '')
    : '';
  const waQuickHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(generateOutreachDrafts(record, settings, outreachTone).whatsappText)}`
    : undefined;

  // Handlers for adding details directly to card
  const handleAddPhone = () => {
    const num = newPhone.trim();
    if (!num) return;
    if (card.phones.some((p) => p.number === num)) {
      setNewPhone('');
      return;
    }
    const updatedCard = {
      ...card,
      phones: [...card.phones, { type: newPhoneType, number: num }],
    };
    onUpdateRecord({ card: updatedCard });
    setNewPhone('');
  };

  const handleRemovePhone = (number: string) => {
    onUpdateRecord({
      card: { ...card, phones: card.phones.filter((p) => p.number !== number) },
    });
  };

  const handleAddEmail = () => {
    const em = newEmail.trim();
    if (!em) return;
    if (card.emails.includes(em)) {
      setNewEmail('');
      return;
    }
    const updatedCard = {
      ...card,
      emails: [...card.emails, em],
    };
    onUpdateRecord({ card: updatedCard });
    setNewEmail('');
  };

  const handleRemoveEmail = (em: string) => {
    onUpdateRecord({
      card: { ...card, emails: card.emails.filter((e) => e !== em) },
    });
  };

  const toggleActionItem = (item: string) => {
    const cur = record.actionItems || [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    onUpdateRecord({ actionItems: next });
  };

  // Handlers for Associated Contacts (colleagues met in the company)
  const handleAddColleague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;
    const next: AssociatedContact = {
      id: uid(),
      name: colName.trim(),
      role: colRole.trim() || undefined,
      department: colDept.trim() || undefined,
      email: colEmail.trim() || undefined,
      phone: colPhone.trim() || undefined,
      linkedin: colLinkedin.trim() || undefined,
      notes: colNotes.trim() || undefined,
      createdAt: Date.now(),
    };
    onUpdateRecord({
      associatedContacts: [next, ...(record.associatedContacts || [])],
    });
    setColName('');
    setColRole('');
    setColDept('');
    setColEmail('');
    setColPhone('');
    setColLinkedin('');
    setColNotes('');
    setShowAddColleague(false);
  };

  const handleDeleteColleague = (id: string) => {
    onUpdateRecord({
      associatedContacts: (record.associatedContacts || []).filter((c) => c.id !== id),
    });
  };

  // Handlers for Meeting Notes & Voice Dictation
  const handleAddNote = () => {
    const text = noteInput.trim();
    if (!text) return;
    onUpdateRecord({
      meetingNotes: [{ id: uid(), text, createdAt: Date.now() }, ...(record.meetingNotes || [])],
    });
    setNoteInput('');
  };

  const handleDeleteNote = (id: string) => {
    onUpdateRecord({
      meetingNotes: (record.meetingNotes || []).filter((n) => n.id !== id),
    });
  };

  const toggleDictation = () => {
    const SpeechRec = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Voice dictation is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SpeechRec as any)();
    rec.lang = isIndiaCard ? 'en-IN' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const transcript = ev.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setNoteInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleCaptureGps = async () => {
    setGeoBusy(true);
    try {
      const loc = await captureGeoLocation();
      if (loc) onUpdateRecord({ location: loc });
    } finally {
      setGeoBusy(false);
    }
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const tags = Array.from(new Set([...(record.tags || []), t]));
    onUpdateRecord({ tags });
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    onUpdateRecord({ tags: (record.tags || []).filter((x) => x !== t) });
  };

  const assocCount = (record.associatedContacts?.length || 0) + (record.meetingNotes?.length || 0) + (record.actionItems?.length || 0);
  const locHref = mapsUrl(record.location);
  const gstin = card.gstin || d?.company.gstin;
  const cin = card.cin || d?.company.cin;
  const currentDraftText =
    customDraft !== null
      ? customDraft
      : outreachChannel === 'email'
      ? drafts.emailBody
      : outreachChannel === 'linkedin'
      ? drafts.linkedinNote
      : drafts.whatsappText;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-2">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> All Scanned Cards
          </button>
          <div className="flex items-center gap-2">
            <a
              href={`/api/export/report/${record.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/30"
              title="Open Printable & PDF Executive KYC Report"
            >
              <Printer className="h-3 w-3" /> PDF Report
            </a>
            <span className="text-xs text-slate-500">
              Scanned {new Date(record.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
        </div>

        {record.demo && (
          <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Demo data (fictional Indian MCA/GST dossier). Add a Gemini key in Settings for live results.
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-indigo-900/40 via-ink-850 to-fuchsia-900/30 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-bold shadow-lg shadow-indigo-500/20">
              {initials(card.fullName || companyName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-white">{card.fullName || companyName}</h1>
                {d?.kyc ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      d.kyc.tier === 'verified'
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-sm'
                        : d.kyc.tier === 'review'
                        ? 'border-amber-400/40 bg-amber-500/20 text-amber-300'
                        : 'border-sky-400/40 bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    KYC {d.kyc.score}/100 · {d.kyc.tier}
                  </span>
                ) : (
                  d?.identity?.company && <IdentityBadge level={d.identity.company.level} title={d.identity.company.reasons.join('\n')} />
                )}
              </div>
              <p className="text-sm font-medium text-slate-300">{card.jobTitle || d?.person.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-indigo-200">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-semibold">{companyName}</span>
                {d?.company.legalName && d.company.legalName !== companyName && (
                  <span className="text-slate-400 font-normal">({d.company.legalName})</span>
                )}
              </p>
            </div>
            {d?.company.logo && <img src={d.company.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1 shadow-md" />}
          </div>

          {/* Event, Booth, GPS Location & Statutory Context Pills */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs">
            {record.event ? (
              <button
                onClick={() => setTab('notes')}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-2.5 py-1 text-indigo-200 hover:bg-indigo-500/30 transition"
              >
                <Calendar className="h-3 w-3" /> {record.event}{record.booth ? ` · ${record.booth}` : ''}
              </button>
            ) : (
              <button
                onClick={() => setTab('notes')}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 bg-white/5 px-2.5 py-1 text-slate-400 hover:text-slate-200 transition"
              >
                <Calendar className="h-3 w-3" /> + Add Event / Stall
              </button>
            )}

            {record.location?.label ? (
              <a
                href={locHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-emerald-200 hover:bg-emerald-500/25 transition"
                title="Open scan GPS location in Google Maps"
              >
                <MapPin className="h-3 w-3" /> {record.location.label}
              </a>
            ) : (
              <button
                onClick={handleCaptureGps}
                disabled={geoBusy}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 bg-white/5 px-2.5 py-1 text-slate-400 hover:text-slate-200 transition"
              >
                {geoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />} + Tag GPS Location
              </button>
            )}

            {gstin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] text-amber-200">
                GST: {gstin}
              </span>
            )}

            {cin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 font-mono text-[11px] text-sky-200">
                CIN: {cin}
              </span>
            )}

            <button
              onClick={() => setTab('notes')}
              className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-2.5 py-1 text-fuchsia-200 hover:bg-fuchsia-500/25 transition"
            >
              <UserPlus className="h-3 w-3" /> + Colleague / Note
            </button>
          </div>

          {/* Priority selector bar */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <Flame className="h-3 w-3 text-amber-400" /> Priority:
            </span>
            {PRIORITIES.map((p) => {
              const active = record.priority === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onUpdateRecord({ priority: active ? null : p.id })}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                    active ? p.cls : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            {record.dealValue && (
              <span className="ml-auto rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 shrink-0">
                Deal: {record.dealValue}
              </span>
            )}
          </div>

          {d?.company.industry && (
            <div className="mt-3">
              <Chips items={[d.company.industry, d.company.businessModel, d.company.headquarters].filter(Boolean) as string[]} tone="indigo" />
            </div>
          )}

          {/* 5-Button Action Bar with 1-Tap WhatsApp */}
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            <ActionBtn icon={<UserPlus className="h-5 w-5" />} label="Save" onClick={() => shareOrDownloadVCard(card, d, record)} primary />
            <ActionBtn icon={<MessageSquare className="h-5 w-5 text-emerald-300" />} label="WhatsApp" href={waQuickHref} />
            <ActionBtn icon={<Phone className="h-5 w-5" />} label="Call" href={card.phones[0] ? `tel:${(phoneV(card.phones[0].number)?.e164 || card.phones[0].number).replace(/[^\d+]/g, '')}` : undefined} />
            <ActionBtn icon={<Mail className="h-5 w-5" />} label="Email" href={card.emails[0] ? `mailto:${card.emails[0]}` : undefined} />
            <ActionBtn icon={<Send className="h-5 w-5" />} label="CRM" onClick={() => setCrmOpen(true)} />
          </div>

          {/* Quick PDF Report & Calendar Action Strip */}
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
            <a
              href={`/api/export/report/${record.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Download print-ready Executive PDF report"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-400" /> PDF Report
            </a>
            <button
              type="button"
              onClick={() => downloadCalendarReminder(record)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Download iCal reminder event for follow-up"
            >
              <Calendar className="h-3.5 w-3.5 text-fuchsia-400" /> + Reminder (.ics)
            </button>
          </div>
          {d?.cachedAt && (
            <p className="mt-3 text-[11px] text-slate-400">
              Company data cached {new Date(d.cachedAt).toLocaleString()} ·{' '}
              <button onClick={onRefresh} className="text-indigo-300 underline">refresh</button>
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar sticky top-0 z-10 mt-4 flex gap-1 overflow-x-auto bg-ink-950/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
              tab === t.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
            }`}
          >
            {t.label}
            {t.id === 'notes' && assocCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${tab === t.id ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'}`}>
                {assocCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-2">
        {/* ============================================================ NOTES & TEAM TAB */}
        {tab === 'notes' && (
          <>
            {/* 1. Event Lead Qualification: Action Checklist, Role & Deal Value */}
            <Section title="Event Lead Qualification & Action Checklist" icon={<CheckSquare className="h-4 w-4 text-emerald-300" />}>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="mb-1.5 text-slate-400">Promised Follow-Up Actions (tap to toggle)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTION_PRESETS.map((act) => {
                      const active = (record.actionItems || []).includes(act);
                      return (
                        <button
                          key={act}
                          type="button"
                          onClick={() => toggleActionItem(act)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            active
                              ? 'border-emerald-400/40 bg-emerald-500/20 font-medium text-emerald-200'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {active ? `✓ ${act}` : `+ ${act}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-slate-400">Contact Role / Relationship Type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTACT_ROLES.map((r) => {
                      const active = record.contactRole === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onUpdateRecord({ contactRole: active ? null : r.id })}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            active
                              ? 'border-fuchsia-400/40 bg-fuchsia-500/20 font-medium text-fuchsia-200'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-slate-400">
                    <IndianRupee className="h-3.5 w-3.5 text-emerald-400" /> Estimated Deal / Order Potential
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={record.dealValue || ''}
                      onChange={(e) => onUpdateRecord({ dealValue: e.target.value || null })}
                      placeholder="e.g. ₹25 Lakh, ₹1.5 Cr, 500 units, $40K"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {DEAL_PRESETS.map((dp) => (
                      <button
                        key={dp}
                        type="button"
                        onClick={() => onUpdateRecord({ dealValue: record.dealValue === dp ? null : dp })}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                          record.dealValue === dp ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {dp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* 2. Other People Met at Company */}
            <Section
              title={`People Spoken To at ${companyName} (${(record.associatedContacts || []).length})`}
              icon={<Users className="h-4 w-4 text-indigo-300" />}
              action={
                <button
                  onClick={() => setShowAddColleague(!showAddColleague)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-500/30"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Person
                </button>
              }
            >
              <p className="mb-3 text-xs text-slate-400">
                Spoke to another colleague, booth rep, or decision-maker at <b>{companyName}</b>? Add their name, number, or email here so everything stays linked to this company.
              </p>

              {showAddColleague && (
                <form onSubmit={handleAddColleague} className="mb-4 space-y-2.5 rounded-2xl border border-indigo-400/30 bg-ink-900/90 p-3.5">
                  <div className="text-xs font-semibold text-indigo-300">Add Colleague / Company Contact</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      required
                      value={colName}
                      onChange={(e) => setColName(e.target.value)}
                      placeholder="Full name *"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <input
                      value={colRole}
                      onChange={(e) => setColRole(e.target.value)}
                      placeholder="Job title / Role (e.g. GM Purchase)"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <input
                      value={colPhone}
                      onChange={(e) => setColPhone(e.target.value)}
                      placeholder="Phone / WhatsApp number (+91...)"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <input
                      type="email"
                      value={colEmail}
                      onChange={(e) => setColEmail(e.target.value)}
                      placeholder="Email address"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <input
                      value={colDept}
                      onChange={(e) => setColDept(e.target.value)}
                      placeholder="Department (optional)"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <input
                      value={colLinkedin}
                      onChange={(e) => setColLinkedin(e.target.value)}
                      placeholder="LinkedIn URL (optional)"
                      className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={colNotes}
                    onChange={(e) => setColNotes(e.target.value)}
                    placeholder="What did you discuss with them?"
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddColleague(false)}
                      className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      Save Contact
                    </button>
                  </div>
                </form>
              )}

              {(record.associatedContacts || []).length > 0 ? (
                <div className="space-y-2">
                  {(record.associatedContacts || []).map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-100">{c.name}</div>
                          {(c.role || c.department) && (
                            <div className="text-xs text-indigo-300">
                              {[c.role, c.department].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {c.phone && (
                            <a
                              href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-300 hover:bg-emerald-500/25"
                              title="WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                              className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
                              title="Call"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
                              title="Email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() =>
                              downloadFile(
                                `${c.name.replace(/\W+/g, '_')}.vcf`,
                                associateToVCard(c, companyName, card.website),
                                'text/vcard',
                              )
                            }
                            className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
                            title="Save vCard"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteColleague(c.id)}
                            className="rounded-lg bg-white/5 p-1.5 text-rose-300 hover:bg-rose-500/20"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.email && <span>✉️ {c.email}</span>}
                        {c.linkedin && (
                          <ExtLink href={c.linkedin} className="text-xs">
                            LinkedIn
                          </ExtLink>
                        )}
                      </div>
                      {c.notes && <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-slate-300">{c.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                !showAddColleague && (
                  <button
                    onClick={() => setShowAddColleague(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-xs text-slate-400 hover:border-indigo-400/40 hover:text-indigo-200"
                  >
                    <UserPlus className="h-4 w-4" /> + Add another person you talked to at {companyName}
                  </button>
                )
              )}

              {/* Other scanned business cards from the same company */}
              {companyContacts.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Other Scanned Cards at {companyName} ({companyContacts.length})
                  </div>
                  <div className="space-y-1.5">
                    {companyContacts.map((other) => (
                      <button
                        key={other.id}
                        onClick={() => onSelectRecord(other)}
                        className="flex w-full items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-left text-xs transition hover:bg-white/10"
                      >
                        <div>
                          <div className="font-medium text-slate-200">{other.card.fullName || 'Contact'}</div>
                          <div className="text-slate-400">{other.card.jobTitle || '—'}</div>
                        </div>
                        <span className="text-indigo-300">Open card →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* 3. Quick Add Phone Number, Email, GSTIN or CIN to This Card */}
            <Section title={`Add Extra Phone / Email / GSTIN for ${card.fullName || 'This Contact'}`} icon={<Phone className="h-4 w-4 text-indigo-300" />}>
              <div className="space-y-3">
                {/* Existing phones & emails with delete button */}
                <div className="space-y-1.5 text-xs">
                  {card.phones.map((p) => (
                    <div key={p.number} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                      <span className="text-slate-200">
                        📞 {p.number} <span className="text-slate-500">({p.type})</span>
                      </span>
                      <button onClick={() => handleRemovePhone(p.number)} className="text-slate-500 hover:text-rose-300">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {card.emails.map((em) => (
                    <div key={em} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                      <span className="text-slate-200">✉️ {em}</span>
                      <button onClick={() => handleRemoveEmail(em)} className="text-slate-500 hover:text-rose-300">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Phone */}
                <div className="flex gap-1.5">
                  <select
                    value={newPhoneType}
                    onChange={(e) => setNewPhoneType(e.target.value)}
                    className="rounded-xl border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-300 outline-none"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="mobile">Mobile</option>
                    <option value="work">Work / Landline</option>
                  </select>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPhone()}
                    placeholder="Add phone / WhatsApp (+91…)"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white"
                  >
                    + Phone
                  </button>
                </div>

                {/* Add Email */}
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    placeholder="Add another email ID…"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white"
                  >
                    + Email
                  </button>
                </div>

                {/* GSTIN & CIN inline fields */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Company GSTIN (India)</label>
                    <input
                      value={card.gstin || ''}
                      onChange={(e) => onUpdateRecord({ card: { ...card, gstin: e.target.value.toUpperCase() || null } })}
                      placeholder="e.g. 27AABCU9603R1ZM"
                      className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">MCA CIN / LLPIN (India)</label>
                    <input
                      value={card.cin || ''}
                      onChange={(e) => onUpdateRecord({ card: { ...card, cin: e.target.value.toUpperCase() || null } })}
                      placeholder="e.g. U72200KA2018PTC112345"
                      className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* 4. Meeting Notes + Voice Dictation */}
            <Section title={`Meeting Notes (${(record.meetingNotes || []).length})`} icon={<StickyNote className="h-4 w-4 text-amber-300" />}>
              <div className="space-y-2.5">
                <div className="flex gap-1.5">
                  <textarea
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Jot down conversation highlights, MOQ, pricing discussed, or next steps…"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={toggleDictation}
                      title="Voice-to-text dictation (supports Indian English)"
                      className={`flex items-center justify-center rounded-xl p-2.5 transition ${
                        listening ? 'animate-pulse bg-rose-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!noteInput.trim()}
                      className="flex flex-1 items-center justify-center rounded-xl bg-indigo-500 px-3 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {(record.meetingNotes || []).length > 0 ? (
                  <ul className="space-y-2 pt-1">
                    {(record.meetingNotes || []).map((n) => (
                      <li key={n.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] p-3 text-sm">
                        <div>
                          <p className="whitespace-pre-wrap text-slate-200">{n.text}</p>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button onClick={() => handleDeleteNote(n.id)} className="shrink-0 text-slate-500 hover:text-rose-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No meeting notes yet.</p>
                )}
              </div>
            </Section>

            {/* 5. Event, Booth/Stall, GPS Location, Tags & Follow-Up Reminder */}
            <Section title="Event, Stall/Booth, GPS & Follow-Up Reminder" icon={<Calendar className="h-4 w-4 text-emerald-300" />}>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-slate-400">Event / Trade Show / Conference</label>
                    <input
                      value={record.event || ''}
                      onChange={(e) => onUpdateRecord({ event: e.target.value || null })}
                      placeholder="e.g. Bharat Mobility Expo, Elecrama, SaaSBoomi"
                      className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-slate-400">
                      <Store className="h-3 w-3 text-fuchsia-300" /> Hall / Stall No.
                    </label>
                    <input
                      value={record.booth || ''}
                      onChange={(e) => onUpdateRecord({ booth: e.target.value || null })}
                      placeholder="e.g. Hall 4, B-18"
                      className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
                {recentEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recentEvents.slice(0, 5).map((ev) => (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => onUpdateRecord({ event: ev })}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          record.event === ev ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {ev}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-slate-400">Scan Location (GPS)</label>
                  <div className="flex gap-1.5">
                    <input
                      value={record.location?.label || ''}
                      onChange={(e) =>
                        onUpdateRecord({
                          location: { ...(record.location || {}), label: e.target.value, capturedAt: record.location?.capturedAt || Date.now() },
                        })
                      }
                      placeholder="City, Venue, or Address"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={handleCaptureGps}
                      disabled={geoBusy}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-2 font-medium text-emerald-300"
                    >
                      {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                      Use GPS
                    </button>
                    {locHref && (
                      <a
                        href={locHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-slate-300"
                        title="View on Google Maps"
                      >
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" /> Map
                      </a>
                    )}
                  </div>
                </div>

                {/* Follow-Up Reminder Date + Calendar Export */}
                <div>
                  <label className="mb-1 flex items-center gap-1 text-slate-400">
                    <Bell className="h-3.5 w-3.5 text-amber-300" /> Follow-Up Reminder Date
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={record.followUpDate || ''}
                      onChange={(e) => onUpdateRecord({ followUpDate: e.target.value || null })}
                      className="rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => downloadCalendarReminder(record)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/30"
                    >
                      <Calendar className="h-3.5 w-3.5" /> Download .ics
                    </button>
                    <a
                      href={googleCalendarUrl(record)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                    >
                      Google Calendar <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Custom Tags */}
                <div>
                  <label className="mb-1 block text-slate-400">Tags</label>
                  <div className="flex gap-1.5">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag (e.g. Q3-Pipeline, OEM, Tier-1, VIP)…"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs outline-none focus:border-indigo-400"
                    />
                    <button type="button" onClick={handleAddTag} className="rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-200">
                      + Tag
                    </button>
                  </div>
                  {!!record.tags?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {record.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs text-indigo-200">
                          #{t}
                          <button onClick={() => handleRemoveTag(t)} className="text-indigo-300/70 hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </>
        )}

        {!d && tab !== 'notes' && <p className="text-sm text-slate-400">No enrichment data yet. Tap Edit & re-enrich.</p>}

        {/* ============================================================ OVERVIEW TAB */}
        {d && tab === 'overview' && (
          <>
            <Section title="What they do" icon={<Sparkles className="h-4 w-4 text-indigo-300" />}>
              {d.company.tagline && <p className="mb-2 text-sm italic text-indigo-200">“{d.company.tagline}”</p>}
              <p className="text-sm leading-relaxed text-slate-200">{d.company.summary || 'No summary available.'}</p>
            </Section>
            <Section title="Firmographics & Statutory IDs" icon={<Building2 className="h-4 w-4 text-indigo-300" />}>
              <div className="grid grid-cols-2 gap-2">
                <Fact label="Legal name" value={d.company.legalName} />
                <Fact label="Industry" value={[d.company.industry, d.company.subIndustry].filter(Boolean).join(' · ')} />
                <Fact label="Founded" value={d.company.founded} />
                <Fact label="Headquarters" value={d.company.headquarters} />
                <Fact label="Employees" value={d.company.employeeRange} />
                <Fact label="Revenue" value={d.company.revenueRange} />
                <Fact label="Ownership" value={d.company.ownership} />
                <Fact label="Parent" value={d.company.parentCompany} />
                <Fact label="GSTIN (India)" value={gstin} />
                <Fact label="MCA CIN / LLPIN" value={cin} />
                <Fact label="D-U-N-S" value={d.company.dunsNumber} />
                <Fact label="LEI" value={d.company.lei} />
              </div>
              {!!d.company.locations?.length && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Locations / Plants</div>
                  <Chips items={d.company.locations} />
                </div>
              )}
              {d.company.registryInfo && <p className="mt-3 text-sm text-slate-300">{d.company.registryInfo}</p>}

              {/* Quick India B2B Verification Links when Indian company or GSTIN/CIN present */}
              {isIndiaCard && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    🇮🇳 Verify on Indian Portals:
                  </span>
                  <ExtLink
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${companyName} ${cin || ''} site:zaubacorp.com OR site:tofler.in`)}`}
                    className="rounded-lg bg-white/5 px-2.5 py-1 text-xs"
                  >
                    MCA / ZaubaCorp / Tofler
                  </ExtLink>
                  {gstin && (
                    <ExtLink href="https://services.gst.gov.in/services/searchtp" className="rounded-lg bg-white/5 px-2.5 py-1 text-xs">
                      GST Portal ({gstin.slice(0, 2)})
                    </ExtLink>
                  )}
                  <ExtLink
                    href={`https://www.indiamart.com/search.mp?ss=${encodeURIComponent(companyName)}`}
                    className="rounded-lg bg-white/5 px-2.5 py-1 text-xs"
                  >
                    IndiaMART Catalog
                  </ExtLink>
                </div>
              )}
            </Section>

            {d.kyc && (
              <Section
                title="Vendor KYC & Entity Trust Scorecard"
                icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
                action={
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      d.kyc.tier === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : d.kyc.tier === 'standard'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {d.kyc.score}/100 · {d.kyc.tier === 'verified' ? 'Verified Entity' : d.kyc.tier === 'standard' ? 'Standard Commercial' : 'Manual Review'}
                  </span>
                }
              >
                <p className="mb-3 text-xs text-slate-300">{d.kyc.summary}</p>
                <div className="space-y-2">
                  {d.kyc.checks.map((chk, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-2.5 text-xs">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          chk.status === 'verified'
                            ? 'bg-emerald-500/25 text-emerald-300'
                            : chk.status === 'warning'
                              ? 'bg-amber-500/25 text-amber-300'
                              : 'bg-rose-500/25 text-rose-300'
                        }`}
                      >
                        {chk.status === 'verified' ? '✓' : chk.status === 'warning' ? '!' : '–'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-200">{chk.label}</div>
                        <div className="text-[11px] text-slate-400">{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {d.familyTree && (
              <Section title="Corporate family tree" icon={<Network className="h-4 w-4 text-indigo-300" />}>
                <div className="space-y-1.5 text-sm">
                  {d.familyTree.ultimateParent && <TreeNode depth={0} label="Ultimate parent" node={d.familyTree.ultimateParent} />}
                  {d.familyTree.parent && d.familyTree.parent.name !== d.familyTree.ultimateParent?.name && (
                    <TreeNode depth={d.familyTree.ultimateParent ? 1 : 0} label="Direct parent" node={d.familyTree.parent} />
                  )}
                  <div
                    className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 font-medium"
                    style={{ marginLeft: 16 * ((d.familyTree.ultimateParent ? 1 : 0) + (d.familyTree.parent && d.familyTree.parent.name !== d.familyTree.ultimateParent?.name ? 1 : 0)) }}
                  >
                    {d.company.legalName || companyName} <span className="text-xs font-normal text-indigo-300">(this company)</span>
                  </div>
                  {d.familyTree.subsidiaries.length > 0 && (
                    <div className="pt-1">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Subsidiaries / Group Entities</div>
                      <Chips items={d.familyTree.subsidiaries} />
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Sources: {d.familyTree.sources.join(', ')}
                  {d.familyTree.familyTreeMembers ? ` · ${d.familyTree.familyTreeMembers} family members` : ''}
                </p>
              </Section>
            )}

            <Section title="Verified registry records" icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}>
              {d.registryRecords?.length ? (
                <div className="space-y-2">
                  {d.registryRecords.map((r, i) => (
                    <details key={i} className="group rounded-xl bg-white/[0.03] p-3" open={i === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Database className="h-4 w-4 shrink-0 text-emerald-300" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{r.source}</span>
                          <span className="truncate text-sm text-slate-300">{r.title}</span>
                        </span>
                        {r.url && <ExtLink href={r.url} className="shrink-0"><ExternalLink className="h-3.5 w-3.5" /></ExtLink>}
                      </summary>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {r.fields.map(([k, val]) => (
                          <div key={k} className="contents">
                            <dt className="text-slate-500">{k}</dt>
                            <dd className="break-words text-slate-200">{/^https?:/.test(val) ? <ExtLink href={val}>{hostOf(val)}</ExtLink> : val}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No official registry match. Small/private companies often aren't in GLEIF/Wikidata — add a GSTIN/CIN or D&B/OpenCorporates key in Settings for broader coverage.</p>
              )}
            </Section>

            {!!d.signals.length && (
              <Section title="Signals" icon={<TrendingUp className="h-4 w-4 text-indigo-300" />}>
                <ul className="space-y-1.5 text-sm text-slate-200">
                  {d.signals.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-400">•</span>{s}</li>)}
                </ul>
              </Section>
            )}
          </>
        )}

        {/* ============================================================ CONTACT TAB */}
        {tab === 'contact' && (
          <>
            <Section
              title="Card details"
              icon={<Briefcase className="h-4 w-4 text-indigo-300" />}
              action={
                <div className="flex items-center gap-3">
                  <button onClick={() => setTab('notes')} className="flex items-center gap-1 text-xs text-emerald-300">
                    <Plus className="h-3.5 w-3.5" /> Add phone / colleague
                  </button>
                  <button onClick={onEdit} className="flex items-center gap-1 text-xs text-indigo-300">
                    <Pencil className="h-3.5 w-3.5" /> Edit & re-enrich
                  </button>
                </div>
              }
            >
              <div className="space-y-2.5 text-sm">
                {card.emails.map((e) => {
                  const ev = emailV(e);
                  return (
                    <Row key={e} icon={<Mail className="h-4 w-4" />} href={`mailto:${e}`}>
                      {e}
                      {ev && <ValidityDot status={ev.status} />}
                      {ev?.freeMail && <span className="ml-1.5 text-[10px] text-slate-500">personal / MSME mail</span>}
                    </Row>
                  );
                })}
                {card.phones.map((p) => {
                  const pv = phoneV(p.number);
                  return (
                    <Row key={p.number} icon={<Phone className="h-4 w-4" />} href={`tel:${(pv?.e164 || p.number).replace(/[^\d+]/g, '')}`}>
                      {pv?.international || p.number} <span className="text-xs text-slate-500">({pv?.lineType?.toLowerCase().replace(/_/g, ' ') || p.type})</span>
                      {pv && <ValidityDot status={pv.status} />}
                    </Row>
                  );
                })}
                {card.website && (
                  <Row icon={<Globe className="h-4 w-4" />} href={card.website}>
                    {hostOf(card.website)}
                    {v?.website && <ValidityDot status={v.website.resolves ? 'valid' : 'invalid'} />}
                  </Row>
                )}
                {card.address && <Row icon={<MapPin className="h-4 w-4" />} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`}>{card.address}</Row>}
                {gstin && <div className="font-mono text-xs text-amber-200">GSTIN: {gstin}</div>}
                {cin && <div className="font-mono text-xs text-emerald-200">CIN: {cin}</div>}
              </div>
              {card.notes && <p className="mt-3 text-xs text-slate-500">{card.notes}</p>}
            </Section>

            {d && (
              <Section title="About the person" icon={<Users className="h-4 w-4 text-indigo-300" />}>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Fact label="Seniority" value={d.person.seniority} />
                  <Fact label="Department" value={d.person.department || card.department} />
                </div>
                <p className="text-sm text-slate-200">{d.person.summary || 'No public profile information found.'}</p>
                {!!d.person.responsibilities?.length && <div className="mt-3"><Chips items={d.person.responsibilities} /></div>}
              </Section>
            )}

            {d?.identity?.person && (
              <Section title="LinkedIn identity" icon={<BadgeCheck className="h-4 w-4 text-indigo-300" />} action={<IdentityBadge level={d.identity.person.level} />}>
                {d.identity.person.linkedinUrl ? (
                  <ExtLink href={d.identity.person.linkedinUrl} className="flex items-center gap-1 break-all text-sm">
                    {d.identity.person.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </ExtLink>
                ) : (
                  <p className="text-sm text-slate-400">No confident profile match.</p>
                )}
                <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {d.identity.person.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
                {d.identity.person.alternatives.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Other candidates</div>
                    <ul className="space-y-1 text-xs">
                      {d.identity.person.alternatives.map((a) => (
                        <li key={a.url} className="flex justify-between gap-2">
                          <ExtLink href={a.url} className="truncate">{a.title || a.url}</ExtLink>
                          <span className="shrink-0 text-slate-500">{Math.round(a.score * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.identity.person.level !== 'verified' && (
                  <p className="mt-3 rounded-lg bg-white/[0.03] p-2 text-[11px] text-slate-400">
                    Tip: open their profile in the LinkedIn app, tap <b>Share → CardIntel</b> (installed app, Android) or paste the URL via <b>Edit & re-enrich</b> to mark it verified.
                  </p>
                )}
              </Section>
            )}

            {!!d?.person.employmentHistory?.length && (
              <Section title="Career history" icon={<HistoryIcon className="h-4 w-4 text-indigo-300" />}>
                <ol className="space-y-2 border-l border-white/10 pl-3">
                  {d.person.employmentHistory.map((e, i) => (
                    <li key={i} className="text-sm">
                      <div className="font-medium">{e.title || 'Role'} <span className="font-normal text-slate-400">· {e.company}</span></div>
                      <div className="text-xs text-slate-500">{[e.start, e.current ? 'present' : e.end].filter(Boolean).join(' – ')}</div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </>
        )}

        {/* ============================================================ OFFERINGS TAB */}
        {d && tab === 'offerings' && (
          <>
            <Section title={`Products (${d.products.length})`} icon={<Package className="h-4 w-4 text-indigo-300" />}>
              {d.products.length ? (
                <div className="space-y-2">
                  {d.products.map((p, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.category && <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200">{p.category}</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No products identified.</p>}
            </Section>
            <Section title={`Services (${d.services.length})`} icon={<Briefcase className="h-4 w-4 text-indigo-300" />}>
              {d.services.length ? (
                <div className="space-y-2">
                  {d.services.map((p, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] p-3">
                      <div className="font-medium">{p.name}</div>
                      <p className="mt-1 text-sm text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No services identified.</p>}
            </Section>
          </>
        )}

        {/* ============================================================ CUSTOMERS TAB */}
        {d && tab === 'customers' && (
          <>
            <Section title="Ideal customer profile" icon={<Target className="h-4 w-4 text-indigo-300" />}>
              {d.targetCustomers.summary && <p className="mb-3 text-sm text-slate-200">{d.targetCustomers.summary}</p>}
              <div className="space-y-3">
                <Labeled label="Segments"><Chips items={d.targetCustomers.segments} tone="indigo" /></Labeled>
                <Labeled label="Industries"><Chips items={d.targetCustomers.industries} /></Labeled>
                <Labeled label="Geographies"><Chips items={d.targetCustomers.geographies} /></Labeled>
                <Labeled label="Buyer personas"><Chips items={d.targetCustomers.buyerPersonas} tone="emerald" /></Labeled>
              </div>
            </Section>
            <Section title="Notable customers" icon={<Users className="h-4 w-4 text-indigo-300" />}>
              {d.notableCustomers.length ? (
                <ul className="space-y-2">
                  {d.notableCustomers.map((c, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div className="font-medium">{c.url ? <ExtLink href={c.url}>{c.name}</ExtLink> : c.name}</div>
                      <div className="text-slate-400">{c.evidence}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No public customer references found.</p>}
            </Section>
            <Section title="Ecosystem" icon={<Link2 className="h-4 w-4 text-indigo-300" />}>
              <div className="space-y-3">
                <Labeled label="Partners"><Chips items={d.partners} tone="emerald" /></Labeled>
                <Labeled label="Competitors"><Chips items={d.competitors} tone="amber" /></Labeled>
              </div>
            </Section>
          </>
        )}

        {/* ============================================================ SOCIAL & NEWS TAB */}
        {d && tab === 'social' && (
          <>
            <Section title="Social & B2B directory presence" icon={<Globe className="h-4 w-4 text-indigo-300" />}>
              {d.socialPresence.length ? (
                <ul className="space-y-2">
                  {d.socialPresence.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition active:bg-white/10">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold uppercase text-indigo-200">{s.platform.slice(0, 2)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium capitalize">{s.platform}{s.handle ? <span className="ml-1 font-normal text-slate-400">{s.handle}</span> : null}</span>
                          <span className="block truncate text-xs text-slate-500">{s.notes || hostOf(s.url)}</span>
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No social profiles found.</p>}
            </Section>
            <Section title="Recent news" icon={<Newspaper className="h-4 w-4 text-indigo-300" />}>
              {d.recentNews.length ? (
                <ul className="space-y-2">
                  {d.recentNews.map((n, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div className="font-medium">{n.url ? <ExtLink href={n.url}>{n.title}</ExtLink> : n.title}</div>
                      {n.date && <div className="text-xs text-slate-500">{n.date}</div>}
                      {n.summary && <p className="mt-1 text-slate-400">{n.summary}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No recent news found.</p>}
            </Section>
          </>
        )}

        {/* ============================================================ PITCH & FOLLOW-UP TAB */}
        {tab === 'pitch' && (
          <>
            {/* 1-Tap Personalized Follow-Up Composer */}
            <Section title="1-Tap Follow-Up & Outreach Generator" icon={<Share2 className="h-4 w-4 text-indigo-300" />}>
              <p className="mb-2.5 text-xs text-slate-400">
                Auto-crafted using your scan event{record.event ? ` (${record.event})` : ''}, stall{record.booth ? ` (${record.booth})` : ''}, action items, colleagues met, notes, and company intelligence.
              </p>

              {/* Channel Selector */}
              <div className="mb-2 flex gap-1.5">
                {([
                  ['whatsapp', 'WhatsApp / SMS'],
                  ['email', 'Email'],
                  ['linkedin', 'LinkedIn Note'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setOutreachChannel(id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                      outreachChannel === id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Style / Tone Switcher (including India Warm B2B & Hinglish) */}
              <div className="mb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] text-slate-500">Tone:</span>
                {([
                  ['india_b2b', '🇮🇳 India Warm B2B'],
                  ['hinglish', '🇮🇳 Hinglish (Conversational)'],
                  ['professional', '🌐 Global Standard'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setOutreachTone(id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${
                      outreachTone === id ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/30' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {outreachChannel === 'email' && (
                <div className="mb-2 rounded-xl bg-ink-900 px-3 py-2 text-xs text-slate-300">
                  <span className="text-slate-500">Subject: </span>
                  {drafts.emailSubject}
                </div>
              )}

              <textarea
                rows={outreachChannel === 'email' ? 7 : 5}
                value={currentDraftText}
                onChange={(e) => setCustomDraft(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-indigo-400"
              />

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  onClick={() => copy(currentDraftText, 'outreach')}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  {copied === 'outreach' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'outreach' ? 'Copied!' : 'Copy Message'}
                </button>

                {outreachChannel === 'whatsapp' && (
                  <a
                    href={`https://wa.me/${waDigits}?text=${encodeURIComponent(currentDraftText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/25 px-3.5 py-2 text-xs font-semibold text-emerald-200"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Send on WhatsApp
                  </a>
                )}

                {outreachChannel === 'email' && card.emails[0] && (
                  <a
                    href={`mailto:${card.emails[0]}?subject=${encodeURIComponent(drafts.emailSubject)}&body=${encodeURIComponent(currentDraftText)}`}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-slate-200"
                  >
                    <Mail className="h-3.5 w-3.5" /> Open in Email App
                  </a>
                )}
              </div>
            </Section>

            {d && (
              <>
                <Section title="Sales angle" icon={<Target className="h-4 w-4 text-indigo-300" />}>
                  <p className="text-sm leading-relaxed text-slate-200">{d.salesAngle || '—'}</p>
                </Section>
                <Section title="Talking points" icon={<MessageSquare className="h-4 w-4 text-indigo-300" />}>
                  <ul className="space-y-2">
                    {d.talkingPoints.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-sm">
                        <span className="flex-1 text-slate-200">{t}</span>
                        <button onClick={() => copy(t, `tp${i}`)} className="shrink-0 text-slate-500" aria-label="Copy">
                          {copied === `tp${i}` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              </>
            )}
          </>
        )}

        {/* ============================================================ SOURCES TAB */}
        {d && tab === 'sources' && (
          <>
            {!!d.caveats.length && (
              <Section title="Caveats" icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}>
                <ul className="space-y-1.5 text-sm text-amber-100/80">
                  {d.caveats.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </Section>
            )}
            {d.identity?.company && (
              <Section title="Company match" icon={<BadgeCheck className="h-4 w-4 text-indigo-300" />} action={<IdentityBadge level={d.identity.company.level} />}>
                <ul className="space-y-0.5 text-xs text-slate-400">
                  {d.identity.company.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </Section>
            )}
            <Section title={`Sources (${d.sources.length})`} icon={<Link2 className="h-4 w-4 text-indigo-300" />}>
              <ul className="space-y-2">
                {d.sources.map((s, i) => (
                  <li key={i} className="text-sm">
                    <ExtLink href={s.url} className="line-clamp-1">{s.title || s.url}</ExtLink>
                    <div className="truncate text-xs text-slate-500">{hostOf(s.url)}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-slate-500">
                Confidence {Math.round((d.confidence ?? 0) * 100)}% · Search: {d.searchProvider}{d.grounded ? ' + Google grounding' : ''} · {d.generatedAt ? new Date(d.generatedAt).toLocaleString() : ''}
              </div>
            </Section>
          </>
        )}

        {/* Export bar */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <SmallBtn icon={copied === 'md' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} label="Copy brief" onClick={() => copy(toMarkdown(record), 'md')} />
          <SmallBtn icon={<Download className="h-4 w-4" />} label="vCard" onClick={() => shareOrDownloadVCard(card, d, record)} />
          <SmallBtn icon={<FileDown className="h-4 w-4" />} label="JSON" onClick={() => downloadFile(`${(card.fullName || 'dossier').replace(/\W+/g, '_')}.json`, JSON.stringify(record, null, 2), 'application/json')} />
          <SmallBtn icon={<Send className="h-4 w-4" />} label="Send to CRM" onClick={() => setCrmOpen(true)} />
          <SmallBtn icon={<RefreshCw className="h-4 w-4" />} label="Refresh data" onClick={onRefresh} />
          <SmallBtn icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => confirm('Delete this scan?') && onDelete()} danger />
        </div>
      </div>

      {crmOpen && <CrmSheet targets={crmTargets} onPush={onPushCrm} onClose={() => setCrmOpen(false)} />}
    </div>
  );
}

function CrmSheet({ targets, onPush, onClose }: { targets: string[]; onPush: Props['onPushCrm']; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<CrmResult | null>(null);
  const push = async (p: 'hubspot' | 'salesforce') => {
    setBusy(p);
    setResult(null);
    setResult(await onPush(p));
    setBusy(null);
  };
  const opts: { id: 'hubspot' | 'salesforce'; label: string; desc: string }[] = [
    { id: 'hubspot', label: 'HubSpot', desc: 'Create/update contact + company, attach dossier as a note' },
    { id: 'salesforce', label: 'Salesforce', desc: 'Create/update a Lead with the dossier in Description' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="safe-bottom w-full max-w-lg rounded-t-3xl border border-white/10 bg-ink-800 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send to CRM</h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          {opts.map((o) => {
            const enabled = targets.includes(o.id);
            return (
              <button key={o.id} disabled={!enabled || !!busy} onClick={() => push(o.id)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left transition active:bg-white/10 disabled:opacity-40">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-bold">{o.label.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-slate-500">{enabled ? o.desc : 'Not configured — add credentials in Settings'}</span>
                </span>
                {busy === o.id && <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />}
              </button>
            );
          })}
        </div>
        {result && (
          <div className={`mt-4 rounded-xl p-3 text-sm ${result.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
            {result.message}
            {result.url && <> · <ExtLink href={result.url}>Open record</ExtLink></>}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ depth, label, node }: { depth: number; label: string; node: { name: string; id?: string | null; source: string } }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2" style={{ marginLeft: depth * 16 }}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label} · {node.source}</div>
      <div className="text-slate-100">{node.name}</div>
      {node.id && <div className="text-[11px] text-slate-500">{node.id}</div>}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, href, primary }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; primary?: boolean }) {
  const cls = `flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs transition active:scale-95 ${primary ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-200'}`;
  if (onClick) return <button onClick={onClick} className={cls}>{icon}{label}</button>;
  if (!href) return <span className={`${cls} opacity-30`}>{icon}{label}</span>;
  return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls}>{icon}{label}</a>;
}

function SmallBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2.5 text-[11px] ${danger ? 'text-rose-300' : 'text-slate-300'}`}>
      {icon}
      {label}
    </button>
  );
}

function Row({ icon, href, children }: { icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-start gap-3 text-slate-200">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </a>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}
