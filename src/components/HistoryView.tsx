import { useMemo, useState } from 'react';
import {
  Search, FileDown, Trash2, ScanLine, Loader2, AlertTriangle, RotateCcw, Clock,
  MapPin, Calendar, Building2, Users, StickyNote, Sparkles, UserPlus, Bell, Flame, Phone, Mail,
} from 'lucide-react';
import type { DossierTab, LeadPriority, ScanRecord } from '../types';
import { initials } from './ui';
import { downloadFile, toCSV } from '../lib/export';
import { mapsUrl } from '../lib/geo';

interface Props {
  history: ScanRecord[];
  canRetry: (id: string) => boolean;
  onRetry: (id: string) => void;
  onOpen: (r: ScanRecord, tab?: DossierTab) => void;
  onDelete: (id: string) => void;
  onScan: () => void;
}

type GroupMode = 'timeline' | 'event' | 'company';

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
        r.location?.label,
        ...(r.tags || []),
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

  if (!history.length) {
    return (
      <div className="flex flex-col items-center px-8 pt-20 text-center">
        <ScanLine className="h-12 w-12 text-slate-600" />
        <p className="mt-4 text-slate-400">No scanned cards yet.</p>
        <p className="mt-1 text-xs text-slate-500">
          Scan a business card to capture date, GPS location, event, 360° company dossier, and colleagues met.
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
            placeholder="Search name, company, event, GPS city, notes…"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => downloadFile(`cardintel-contacts-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered), 'text/csv')}
          className="flex items-center gap-1 rounded-xl bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10"
          title="Export CSV with events, GPS locations, colleagues & notes"
        >
          <FileDown className="h-4 w-4" /> CSV
        </button>
      </div>

      {/* View Mode Switcher: All Cards / By Event / By Company */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-ink-800/90 p-1">
        {([
          ['timeline', 'All Cards', Clock],
          ['event', 'By Event', Calendar],
          ['company', 'By Company', Building2],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
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

      {/* ============================================================ MODE 2: GROUPED BY EVENT */}
      {mode === 'event' && (
        <div className="space-y-4">
          {byEvent.map(([evtName, records]) => {
            const locations = Array.from(new Set(records.map((r) => r.location?.label).filter(Boolean)));
            return (
              <div key={evtName} className="space-y-2 rounded-2xl border border-white/10 bg-ink-800/40 p-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
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
                      {[d?.company.industry, d?.company.headquarters, d?.company.employeeRange ? `${d.company.employeeRange} emp` : null]
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
  const openable = status === 'done' || !!r.dossier;
  const companyName = r.dossier?.company.name || r.card.company || r.card.domain || 'Unknown company';
  const locUrl = mapsUrl(r.location);
  const colleaguesCount = r.associatedContacts?.length || 0;
  const notesCount = r.meetingNotes?.length || 0;

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

          {/* Date, Time, Event & GPS Location metadata row */}
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

            {r.followUpDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Bell className="h-2.5 w-2.5" /> Follow-up: {r.followUpDate}
              </span>
            )}
          </div>

          {/* Status or Colleagues/Notes summary */}
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
            (colleaguesCount > 0 || notesCount > 0) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
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

      {/* Action links footer: Revisit Company 360° Details OR Add Colleague / Number / Note */}
      {openable && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-white/5 pt-2.5">
          <button
            onClick={() => onOpen(r, 'overview')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-500/15 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25"
          >
            <Building2 className="h-3.5 w-3.5" /> Company 360° Details
          </button>
          <button
            onClick={() => onOpen(r, 'notes')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          >
            <UserPlus className="h-3.5 w-3.5 text-fuchsia-300" /> + Add Colleague / Info
          </button>
        </div>
      )}
    </li>
  );
}
