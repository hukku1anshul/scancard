import { useMemo, useState } from 'react';
import {
  Search, FileDown, Trash2, ScanLine, Loader2, AlertTriangle, RotateCcw, Clock,
  MapPin, Calendar, Building2, Users, StickyNote, Sparkles, UserPlus, Bell, Flame, Phone, Mail,
  MessageSquare, Copy, Check, CheckSquare, Store, BarChart3, Printer, ShieldCheck,
} from 'lucide-react';
import type { DossierTab, LeadPriority, ScanRecord } from '../types';
import { initials } from './ui';
import { downloadFile, generateEventDigest, toCSV } from '../lib/export';
import { mapsUrl } from '../lib/geo';

interface Props {
  history: ScanRecord[];
  canRetry: (id: string) => boolean;
  onRetry: (id: string) => void;
  onOpen: (r: ScanRecord, tab?: DossierTab) => void;
  onDelete: (id: string) => void;
  onScan: () => void;
}

type GroupMode = 'timeline' | 'event' | 'company' | 'analytics';

const PRIORITY_BADGE: Record<LeadPriority, { label: string; cls: string }> = {
  hot: { label: 'Hot', cls: 'bg-rose-500/20 text-rose-300 border-rose-400/30' },
  warm: { label: 'Warm', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
  cold: { label: 'Cold', cls: 'bg-sky-500/20 text-sky-300 border-sky-400/30' },
  partner: { label: 'Partner', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
};

export default function HistoryView({ history, canRetry, onRetry, onOpen, onDelete, onScan }: Props) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<GroupMode>('timeline');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [copiedEvent, setCopiedEvent] = useState<string | null>(null);

  const events = useMemo(() => {
    const s = new Set<string>();
    history.forEach((r) => {
      if (r.event?.trim()) s.add(r.event.trim());
    });
    return Array.from(s);
  }, [history]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return history.filter((r) => {
      if (eventFilter !== 'all' && (r.event || '') !== eventFilter) return false;
      if (priorityFilter !== 'all' && (r.priority || '') !== priorityFilter) return false;
      if (!s) return true;
      const assocText = (r.associatedContacts || [])
        .map((c) => `${c.name} ${c.role || ''} ${c.email || ''} ${c.phone || ''} ${c.notes || ''}`)
        .join(' ');
      const notesText = (r.meetingNotes || []).map((n) => n.text).join(' ');
      return [
        r.card.fullName,
        r.card.company,
        r.dossier?.company.name,
        r.card.jobTitle,
        r.dossier?.company.industry,
        r.event,
        r.booth,
        r.location?.label,
        r.card.gstin,
        r.card.cin,
        r.dossier?.company.gstin,
        r.dossier?.company.cin,
        ...(r.tags || []),
        ...(r.actionItems || []),
        ...r.card.emails,
        ...r.card.phones.map((p) => p.number),
        assocText,
        notesText,
      ].some((v) => v?.toLowerCase().includes(s));
    });
  }, [history, q, eventFilter, priorityFilter]);

  // Group by Event
  const byEvent = useMemo(() => {
    const map = new Map<string, ScanRecord[]>();
    filtered.forEach((r) => {
      const key = r.event?.trim() || 'Untagged Event / General Scans';
      map.set(key, [...(map.get(key) || []), r]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Group by Company
  const byCompany = useMemo(() => {
    const map = new Map<string, { name: string; records: ScanRecord[] }>();
    filtered.forEach((r) => {
      const name = r.dossier?.company.name || r.card.company || r.card.domain || 'Unknown Company';
      const key = (r.card.domain || name).toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.records.push(r);
      } else {
        map.set(key, { name, records: [r] });
      }
    });
    return Array.from(map.values());
  }, [filtered]);

  // Stats summary
  const totalColleagues = useMemo(
    () => history.reduce((acc, r) => acc + (r.associatedContacts?.length || 0), 0),
    [history],
  );
  const totalCompanies = useMemo(() => {
    const s = new Set<string>();
    history.forEach((r) => {
      const c = (r.card.domain || r.dossier?.company.name || r.card.company || '').toLowerCase().trim();
      if (c) s.add(c);
    });
    return s.size;
  }, [history]);

  const copyEventReport = async (evtName: string, records: ScanRecord[]) => {
    const digest = generateEventDigest(evtName, records);
    await navigator.clipboard?.writeText(digest);
    setCopiedEvent(evtName);
    setTimeout(() => setCopiedEvent(null), 2000);
  };

  if (!history.length) {
    return (
      <div className="flex flex-col items-center px-8 pt-20 text-center">
        <ScanLine className="h-12 w-12 text-slate-600" />
        <p className="mt-4 text-slate-400">No scanned cards yet.</p>
        <p className="mt-1 text-xs text-slate-500">
          Scan a business card to capture date, GPS location, event, 360° company dossier, GSTIN/CIN, and colleagues met.
        </p>
        <button onClick={onScan} className="mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium">
          Scan your first card
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 px-4 pb-6 pt-2">
      {/* Summary metrics bar */}
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/5 bg-ink-800/60 p-2.5 text-center">
        <div>
          <div className="text-base font-semibold text-white">{history.length}</div>
          <div className="text-[10px] text-slate-400">Cards Scanned</div>
        </div>
        <div>
          <div className="text-base font-semibold text-indigo-300">{totalCompanies}</div>
          <div className="text-[10px] text-slate-400">Companies</div>
        </div>
        <div>
          <div className="text-base font-semibold text-emerald-300">{events.length}</div>
          <div className="text-[10px] text-slate-400">Events</div>
        </div>
        <div>
          <div className="text-base font-semibold text-fuchsia-300">{totalColleagues}</div>
          <div className="text-[10px] text-slate-400">Extra Contacts</div>
        </div>
      </div>

      {/* Search + CSV Export */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-ink-800 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, event, GSTIN, city, notes…"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => downloadFile(`cardintel-contacts-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered), 'text/csv')}
          className="flex items-center gap-1 rounded-xl bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10"
          title="Export CSV with events, GPS locations, GSTIN/CIN, colleagues & notes"
        >
          <FileDown className="h-4 w-4" /> CSV
        </button>
      </div>

      {/* View Mode Switcher: All Cards / By Event / By Company / Analytics */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-ink-800/90 p-1">
        {([
          ['timeline', 'Cards', Clock],
          ['event', 'Events', Calendar],
          ['company', 'Companies', Building2],
          ['analytics', 'Analytics', BarChart3],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition ${
              mode === id ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Quick Filter Chips (Events & Priority) */}
      {(events.length > 0 || history.some((r) => r.priority)) && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {events.length > 0 && (
            <>
              <button
                onClick={() => setEventFilter('all')}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                  eventFilter === 'all' ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400'
                }`}
              >
                All Events
              </button>
              {events.map((ev) => (
                <button
                  key={ev}
                  onClick={() => setEventFilter(eventFilter === ev ? 'all' : ev)}
                  className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
                    eventFilter === ev ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300'
                  }`}
                >
                  <Calendar className="h-3 w-3" /> {ev}
                </button>
              ))}
            </>
          )}
          {(['hot', 'warm', 'partner'] as LeadPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
              className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] capitalize ${
                priorityFilter === p ? PRIORITY_BADGE[p].cls + ' border' : 'bg-white/5 text-slate-400'
              }`}
            >
              <Flame className="h-3 w-3" /> {p}
            </button>
          ))}
        </div>
      )}

      {/* ============================================================ MODE 1: TIMELINE (ALL CARDS) */}
      {mode === 'timeline' && (
        <ul className="space-y-2.5">
          {filtered.map((r) => (
            <CardHistoryItem
              key={r.id}
              record={r}
              canRetry={canRetry(r.id)}
              onRetry={() => onRetry(r.id)}
              onOpen={onOpen}
              onDelete={() => onDelete(r.id)}
              onFilterEvent={(ev) => setEventFilter(eventFilter === ev ? 'all' : ev)}
            />
          ))}
        </ul>
      )}

      {/* ============================================================ MODE 2: GROUPED BY EVENT + END-OF-DAY ROI DIGEST */}
      {mode === 'event' && (
        <div className="space-y-4">
          {byEvent.map(([evtName, records]) => {
            const locations = Array.from(new Set(records.map((r) => r.location?.label).filter(Boolean)));
            const hotLeads = records.filter((r) => r.priority === 'hot').length;
            const actionCount = records.reduce((a, r) => a + (r.actionItems?.length || 0), 0);
            const deals = records.map((r) => r.dealValue).filter(Boolean);
            const waDigestUrl = `https://wa.me/?text=${encodeURIComponent(generateEventDigest(evtName, records))}`;

            return (
              <div key={evtName} className="space-y-2.5 rounded-2xl border border-white/10 bg-ink-800/50 p-3.5">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-200">
                        <Calendar className="h-4 w-4 text-indigo-400" /> {evtName}
                      </div>
                      {locations.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-300">
                          <MapPin className="h-3 w-3" /> {locations.join(' · ')}
                        </div>
                      )}
                    </div>
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                      {records.length} card{records.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Event ROI mini-metrics */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-lg bg-rose-500/15 px-2 py-0.5 text-rose-200">🔥 {hotLeads} Hot Leads</span>
                    <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-emerald-200">✅ {actionCount} Action Items</span>
                    {deals.length > 0 && (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-amber-200">
                        💰 Deals: {deals.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* 1-Tap End-of-Day Event Report Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      onClick={() => copyEventReport(evtName, records)}
                      className="flex items-center gap-1 rounded-xl bg-indigo-500/20 px-2.5 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/30"
                    >
                      {copiedEvent === evtName ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedEvent === evtName ? 'Digest Copied!' : 'Copy Event Digest'}
                    </button>
                    <a
                      href={waDigestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-xl bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/30"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Share Report on WhatsApp
                    </a>
                    <button
                      onClick={() => downloadFile(`event-${evtName.replace(/\W+/g, '_')}.csv`, toCSV(records), 'text/csv')}
                      className="flex items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Event CSV
                    </button>
                  </div>
                </div>

                <ul className="space-y-2">
                  {records.map((r) => (
                    <CardHistoryItem
                      key={r.id}
                      record={r}
                      canRetry={canRetry(r.id)}
                      onRetry={() => onRetry(r.id)}
                      onOpen={onOpen}
                      onDelete={() => onDelete(r.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ MODE 3: GROUPED BY COMPANY (ACCOUNT MAP) */}
      {mode === 'company' && (
        <div className="space-y-3">
          {byCompany.map(({ name, records }) => {
            const primary = records.find((r) => r.dossier) || records[0];
            const d = primary.dossier;
            const gstin = primary.card.gstin || d?.company.gstin;
            const allColleagues = records.flatMap((r) =>
              (r.associatedContacts || []).map((c) => ({ ...c, parentRecord: r })),
            );

            return (
              <div key={name} className="rounded-2xl border border-white/10 bg-ink-800/70 p-3.5">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-indigo-300" />
                      <h3 className="truncate font-semibold text-white">{name}</h3>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {[d?.company.industry, d?.company.headquarters, d?.company.revenueRange, gstin ? `GST: ${gstin}` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Company'}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpen(primary, 'overview')}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Company 360°
                  </button>
                </div>

                {/* Scanned cards at this company */}
                <div className="mt-2.5 space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Scanned Cards ({records.length})
                  </div>
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">{r.card.fullName || 'Contact'}</div>
                        <div className="truncate text-slate-400">
                          {[r.card.jobTitle, r.event ? `@ ${r.event}` : null, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => onOpen(r, 'notes')}
                          className="rounded-lg bg-white/5 px-2.5 py-1 text-indigo-200 hover:bg-white/10"
                        >
                          + Team / Notes
                        </button>
                        <button
                          onClick={() => onOpen(r, 'overview')}
                          className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-indigo-200 hover:bg-indigo-500/30"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extra colleagues spoken to at this company */}
                {allColleagues.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-fuchsia-300">
                      Additional People Spoken To ({allColleagues.length})
                    </div>
                    {allColleagues.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-fuchsia-500/5 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200">
                            {c.name} {c.role && <span className="font-normal text-slate-400">· {c.role}</span>}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {[c.phone, c.email, c.notes].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {c.phone && (
                            <a href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-300">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="rounded-lg bg-white/5 p-1.5 text-slate-300">
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="rounded-lg bg-white/5 p-1.5 text-slate-300">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ MODE 4: LIVE ANALYTICS & EVENT ROI */}
      {mode === 'analytics' && (
        <div className="space-y-4">
          {/* Top High-Level Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-ink-800/80 p-3.5">
              <div className="text-[11px] font-medium uppercase text-slate-400">Total Scans</div>
              <div className="mt-1 text-2xl font-bold text-white">{history.length}</div>
              <div className="text-[10px] text-slate-500">{totalCompanies} Unique Entities</div>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3.5">
              <div className="text-[11px] font-medium uppercase text-rose-300">Hot Leads</div>
              <div className="mt-1 text-2xl font-bold text-rose-200">
                {history.filter((r) => r.priority === 'hot').length}
              </div>
              <div className="text-[10px] text-rose-300/70">
                {history.filter((r) => r.priority === 'warm').length} Warm Leads
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3.5">
              <div className="text-[11px] font-medium uppercase text-emerald-300">Action Items</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">
                {history.reduce((a, r) => a + (r.actionItems?.length || 0), 0)}
              </div>
              <div className="text-[10px] text-emerald-300/70">Pending Follow-ups</div>
            </div>
            <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3.5">
              <div className="text-[11px] font-medium uppercase text-indigo-300">KYC Verified</div>
              <div className="mt-1 text-2xl font-bold text-indigo-200">
                {history.filter((r) => r.dossier?.kyc?.tier === 'verified').length}
              </div>
              <div className="text-[10px] text-indigo-300/70">Verified Entities</div>
            </div>
          </div>

          {/* Event Breakdown Table */}
          <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Events & Field Performance</span>
              <button
                onClick={() => downloadFile('all-cards-export.csv', toCSV(history), 'text/csv')}
                className="flex items-center gap-1 rounded-xl bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-500/30"
              >
                <FileDown className="h-3.5 w-3.5" /> Export All CSV
              </button>
            </div>
            <div className="space-y-2">
              {byEvent.map(([ev, recs]) => {
                const deals = recs.map((r) => r.dealValue).filter(Boolean);
                const hot = recs.filter((r) => r.priority === 'hot').length;
                return (
                  <div key={ev} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 text-xs">
                    <div>
                      <div className="font-medium text-slate-200">{ev}</div>
                      <div className="text-[11px] text-slate-400">
                        {recs.length} cards · {hot} hot leads{deals.length ? ` · Deals: ${deals.join(', ')}` : ''}
                      </div>
                    </div>
                    <span className="rounded-lg bg-indigo-500/20 px-2 py-1 font-semibold text-indigo-300">
                      {recs.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead Role Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
            <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
              Pipeline By Relationship Role
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {(['buyer', 'distributor', 'vendor', 'partner'] as const).map((rl) => {
                const count = history.filter((r) => r.contactRole === rl).length;
                return (
                  <div key={rl} className="rounded-xl bg-white/[0.03] p-2.5">
                    <div className="capitalize text-slate-400">{rl}</div>
                    <div className="text-lg font-bold text-white">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardHistoryItem({
  record: r,
  canRetry,
  onRetry,
  onOpen,
  onDelete,
  onFilterEvent,
}: {
  record: ScanRecord;
  canRetry: boolean;
  onRetry: () => void;
  onOpen: (r: ScanRecord, tab?: DossierTab) => void;
  onDelete: () => void;
  onFilterEvent?: (ev: string) => void;
}) {
  const status = r.status || 'done';
  const openable = true;
  const companyName = r.dossier?.company.name || r.card.company || r.card.domain || 'Unknown company';
  const locUrl = mapsUrl(r.location);
  const colleaguesCount = r.associatedContacts?.length || 0;
  const notesCount = r.meetingNotes?.length || 0;
  const actionsCount = r.actionItems?.length || 0;
  const gstin = r.card.gstin || r.dossier?.company.gstin;
  const waNumber = r.card.phones[0]?.number.replace(/[^\d]/g, '');

  return (
    <li
      className={`rounded-2xl border bg-ink-800/75 p-3 transition ${
        status === 'error' ? 'border-rose-400/20' : status === 'done' ? 'border-white/10' : 'border-indigo-400/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => openable && onOpen(r, 'overview')}
          disabled={!openable}
          className="relative h-14 w-22 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink-900"
        >
          {r.thumb ? (
            <img src={r.thumb} alt="" className="h-14 w-22 object-cover" />
          ) : (
            <div className="flex h-14 w-22 items-center justify-center bg-indigo-500/20 font-semibold">
              {initials(r.card.fullName || companyName)}
            </div>
          )}
          {(status === 'queued' || status === 'processing') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              {status === 'queued' ? <Clock className="h-5 w-5 text-slate-200" /> : <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />}
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => openable && onOpen(r, 'overview')} disabled={!openable} className="min-w-0 text-left">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-semibold text-white">
                  {r.card.fullName || companyName || (status === 'done' ? 'Unknown' : 'New card')}
                </span>
                {r.priority && (
                  <span className={`rounded-full border px-2 py-0.2 text-[10px] font-medium ${PRIORITY_BADGE[r.priority].cls}`}>
                    {PRIORITY_BADGE[r.priority].label}
                  </span>
                )}
                {r.contactRole && (
                  <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.2 text-[10px] font-medium capitalize text-fuchsia-200">
                    {r.contactRole}
                  </span>
                )}
                {r.scanMode && r.scanMode !== 'card' && (
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.2 text-[10px] font-medium text-indigo-300">
                    {r.scanMode.replace('_', ' ')}
                  </span>
                )}
                {r.dealValue && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-medium text-emerald-200">
                    {r.dealValue}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-300">
                {[r.card.jobTitle, companyName].filter(Boolean).join(' · ') || ' '}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              {status === 'error' && canRetry && (
                <button onClick={onRetry} className="p-1.5 text-indigo-300" aria-label="Retry">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => confirm('Delete this scan?') && onDelete()}
                className="p-1.5 text-slate-500 hover:text-rose-300"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Date, Time, Event, Booth, GPS Location & GSTIN metadata row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-500" />
              {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
              {new Date(r.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>

            {r.event && (
              <button
                type="button"
                onClick={() => onFilterEvent?.(r.event!)}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200 hover:bg-indigo-500/25"
              >
                <Calendar className="h-2.5 w-2.5" /> {r.event}
              </button>
            )}

            {r.booth && (
              <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200">
                <Store className="h-2.5 w-2.5" /> {r.booth}
              </span>
            )}

            {r.location?.label && (
              <a
                href={locUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/25"
                title="Open GPS scan location in Google Maps"
              >
                <MapPin className="h-2.5 w-2.5" /> {r.location.label}
              </a>
            )}

            {gstin && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                GST: {gstin}
              </span>
            )}

            {r.followUpDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Bell className="h-2.5 w-2.5" /> Follow-up: {r.followUpDate}
              </span>
            )}
          </div>

          {/* Status or Colleagues/Notes/Action Items summary */}
          {status !== 'done' ? (
            <div className="mt-1 text-xs">
              {status === 'queued' && <span className="text-slate-400">Queued…</span>}
              {status === 'processing' && <span className="text-indigo-300">{r.progress || 'Processing…'}</span>}
              {status === 'error' && (
                <span className="flex items-center gap-1 text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {r.error}
                </span>
              )}
            </div>
          ) : (
            (colleaguesCount > 0 || notesCount > 0 || actionsCount > 0) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                {actionsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <CheckSquare className="h-3 w-3" /> {r.actionItems!.join(', ')}
                  </span>
                )}
                {colleaguesCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-fuchsia-300">
                    <Users className="h-3 w-3" /> +{colleaguesCount} colleague{colleaguesCount > 1 ? 's' : ''} ({r.associatedContacts!.map((c) => c.name.split(' ')[0]).join(', ')})
                  </span>
                )}
                {notesCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-200">
                    <StickyNote className="h-3 w-3" /> {notesCount} note{notesCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Action links footer: Revisit Company 360° Details, Add Colleague/Info, PDF Report, or 1-Tap WhatsApp */}
      {openable && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
          <button
            onClick={() => onOpen(r, 'overview')}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-indigo-500/15 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25"
          >
            <Building2 className="h-3.5 w-3.5" /> Company 360°
          </button>
          <button
            onClick={() => onOpen(r, 'notes')}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          >
            <UserPlus className="h-3.5 w-3.5 text-fuchsia-300" /> + Team
          </button>
          <a
            href={`/api/export/report/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-white/10"
            title="Download / Print Executive PDF Report"
          >
            <Printer className="h-3.5 w-3.5" /> PDF
          </a>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25"
              title="Message on WhatsApp"
            >
              <MessageSquare className="h-3.5 w-3.5" /> WA
            </a>
          )}
        </div>
      )}
    </li>
  );
}
