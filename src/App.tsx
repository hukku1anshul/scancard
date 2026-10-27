import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, History as HistoryIcon, Settings as SettingsIcon, Sparkles, CheckCircle2, QrCode } from 'lucide-react';
import ScanView, { type ScanContextInput } from './components/ScanView';
import ProgressView from './components/ProgressView';
import DossierView from './components/DossierView';
import EditCardSheet from './components/EditCardSheet';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import MyDigitalCardModal from './components/MyDigitalCardModal';
import ShareTargetSheet, { type SharedLink } from './components/ShareTargetSheet';
import {
  deleteServerRecord,
  fetchHealth,
  patchServerRecord,
  pushToCrm,
  saveServerRecord,
  streamScan,
  syncRecordsWithServer,
  type ScanPayload,
} from './lib/api';
import { prepareImage } from './lib/image';
import { applyServerDefaults, loadHistory, loadSettings, saveHistory, saveSettings, uid } from './lib/storage';
import type { Card, ContactRole, DossierTab, Health, MeetingNote, ScanLocation, ScanMode, ScanRecord, Settings, StepId, StepState } from './types';

type View = 'scan' | 'processing' | 'dossier' | 'history' | 'settings';

const STEP_DEFS: { id: StepId; label: string }[] = [
  { id: 'extract', label: 'Reading card & GSTIN/CIN with Vision AI' },
  { id: 'website', label: 'Crawling company website' },
  { id: 'registry', label: 'Registries: India MCA/GST, GLEIF, Wikidata, D&B' },
  { id: 'social', label: 'LinkedIn, IndiaMART, social & people data' },
  { id: 'market', label: 'Customers, products & news' },
  { id: 'research', label: 'Google Search deep research' },
  { id: 'synthesize', label: 'AI synthesis of 360° dossier' },
  { id: 'gapfill', label: 'Gap-filling follow-up research' },
];
const freshSteps = (): StepState[] => STEP_DEFS.map((s) => ({ ...s, status: 'pending' }));

const emptyCard = (): Card => ({
  fullName: null, firstName: null, lastName: null, jobTitle: null, department: null, company: null, tagline: null,
  emails: [], phones: [], website: null, domain: null, address: null, socials: {},
});

function parseShareTarget(): SharedLink | null {
  if (location.pathname !== '/share-target') return null;
  const p = new URLSearchParams(location.search);
  const text = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
  history.replaceState(null, '', '/');
  const url = text.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[)\].,]+$/, '');
  if (!url) return null;
  const kind = /linkedin\.com\/in\//i.test(url) ? 'person' : /linkedin\.com\/company\//i.test(url) ? 'company' : 'other';
  return { url, kind, title: p.get('title') || '' };
}

/** Find an existing record in history that represents the same person/card (by email, phone, or exact name+company) to avoid duplicates at events. */
function findDuplicateRecord(list: ScanRecord[], card: Card, excludeId?: string): ScanRecord | undefined {
  const emails = new Set(card.emails.map((e) => e.toLowerCase()));
  const phones = new Set(card.phones.map((p) => p.number.replace(/\D/g, '').slice(-10)).filter((d) => d.length >= 8));
  const nameCo = card.fullName && card.company ? `${card.fullName.toLowerCase().trim()}|${card.company.toLowerCase().trim()}` : null;

  return list.find((r) => {
    if (r.id === excludeId || r.status === 'queued' || r.status === 'processing') return false;
    if (r.card.emails.some((e) => emails.has(e.toLowerCase()))) return true;
    if (r.card.phones.some((p) => phones.has(p.number.replace(/\D/g, '').slice(-10)))) return true;
    if (nameCo && r.card.fullName && r.card.company) {
      const rKey = `${r.card.fullName.toLowerCase().trim()}|${r.card.company.toLowerCase().trim()}`;
      if (rKey === nameCo) return true;
    }
    return false;
  });
}

interface JobMeta {
  scanMode?: ScanMode | null;
  event?: string | null;
  booth?: string | null;
  location?: ScanLocation | null;
  contactRole?: ContactRole | null;
  actionItems?: string[];
  initialNotes?: MeetingNote[];
}

export default function App() {
  const [view, setView] = useState<View>('scan');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [history, setHistory] = useState<ScanRecord[]>(loadHistory);
  const [health, setHealth] = useState<Health | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState<DossierTab>('overview');
  const [editing, setEditing] = useState(false);
  const [myQrOpen, setMyQrOpen] = useState(false);
  const [shared, setShared] = useState<SharedLink | null>(parseShareTarget);
  const [toast, setToast] = useState<string | null>(null);

  // foreground processing state
  const [steps, setSteps] = useState<StepState[]>(freshSteps);
  const [liveCard, setLiveCard] = useState<Card | null>(null);
  const [scanThumb, setScanThumb] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastJob = useRef<{ payload: ScanPayload; thumb?: string; id?: string; meta?: JobMeta } | null>(null);

  // background (event mode) queue
  const pending = useRef(new Map<string, ScanPayload>());
  const workerBusy = useRef(false);

  const current = history.find((r) => r.id === currentId) || null;

  const recentEvents = useMemo(() => {
    const s = new Set<string>();
    if (settings.defaultEvent?.trim()) s.add(settings.defaultEvent.trim());
    history.forEach((r) => {
      if (r.event?.trim()) s.add(r.event.trim());
    });
    return Array.from(s);
  }, [history, settings.defaultEvent]);

  const companyContacts = useMemo(() => {
    if (!current) return [];
    const curCo = (current.card.domain || current.dossier?.company.name || current.card.company || '').toLowerCase().trim();
    if (!curCo) return [];
    return history.filter((r) => {
      if (r.id === current.id) return false;
      const co = (r.card.domain || r.dossier?.company.name || r.card.company || '').toLowerCase().trim();
      return co === curCo;
    });
  }, [current, history]);

  useEffect(() => saveHistory(history), [history]);
  useEffect(() => {
    // Initial server sync & capabilities fetch
    syncRecordsWithServer(history).then((merged) => {
      if (merged && merged.length > 0) {
        setHistory(merged);
        saveHistory(merged);
      }
    });

    fetchHealth().then((h) => {
      setHealth(h);
      if (h?.defaults) {
        setSettings((prev) => {
          const merged = applyServerDefaults(prev, h.defaults);
          saveSettings(merged);
          return merged;
        });
      }
    });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const demoMode = health ? !health.gemini : false;
  const patchRecord = useCallback((id: string, patch: Partial<ScanRecord>) => {
    setHistory((h) => h.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    patchServerRecord(id, patch);
  }, []);

  // ---------------------------------------------------------------- foreground
  const runJob = useCallback(
    async (payload: ScanPayload, thumb?: string, existingId?: string, meta?: JobMeta) => {
      lastJob.current = { payload, thumb, id: existingId, meta };
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setSteps(freshSteps());
      setLiveCard(null);
      setError(null);
      setScanThumb(thumb);
      setView('processing');
      window.scrollTo({ top: 0 });

      let card: Card | null = payload.card || null;
      let finished = false;
      try {
        await streamScan(
          payload,
          settings,
          (evt) => {
            if (evt.type === 'step') {
              setSteps((prev) => prev.map((s) => (s.id === evt.step ? { ...s, status: evt.status, detail: evt.detail } : s)));
            } else if (evt.type === 'card') {
              card = evt.card;
              setLiveCard(evt.card);
            } else if (evt.type === 'error') {
              setError(evt.message);
              setSteps((prev) => prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)));
            } else if (evt.type === 'result' && card) {
              finished = true;
              const finalCard = card;
              let targetId = existingId || uid();
              let mergedDuplicate = false;

              setHistory((h) => {
                const prev = existingId ? h.find((r) => r.id === existingId) : findDuplicateRecord(h, finalCard);
                if (prev && !existingId) {
                  targetId = prev.id;
                  mergedDuplicate = true;
                }
                const mergedPhones = [...finalCard.phones];
                for (const p of prev?.card.phones || []) {
                  if (!mergedPhones.some((mp) => mp.number === p.number)) mergedPhones.push(p);
                }
                const mergedEmails = Array.from(new Set([...finalCard.emails, ...(prev?.card.emails || [])]));

                const record: ScanRecord = {
                  id: targetId,
                  createdAt: prev?.createdAt || Date.now(),
                  thumb: thumb ?? prev?.thumb,
                  card: {
                    ...finalCard,
                    phones: mergedPhones,
                    emails: mergedEmails,
                    gstin: finalCard.gstin || prev?.card.gstin || null,
                    cin: finalCard.cin || prev?.card.cin || null,
                  },
                  dossier: evt.dossier,
                  demo: evt.demo,
                  status: 'done',
                  scanMode: meta?.scanMode ?? prev?.scanMode ?? 'card',
                  event: meta?.event ?? prev?.event ?? null,
                  booth: meta?.booth ?? prev?.booth ?? null,
                  location: meta?.location ?? prev?.location ?? null,
                  priority: prev?.priority ?? null,
                  contactRole: meta?.contactRole ?? prev?.contactRole ?? null,
                  actionItems: Array.from(new Set([...(prev?.actionItems || []), ...(meta?.actionItems || [])])),
                  dealValue: prev?.dealValue ?? null,
                  tags: prev?.tags ?? [],
                  followUpDate: prev?.followUpDate ?? null,
                  associatedContacts: prev?.associatedContacts ?? [],
                  meetingNotes: [...(meta?.initialNotes || []), ...(prev?.meetingNotes || [])],
                };
                saveServerRecord(record);
                return [record, ...h.filter((r) => r.id !== record.id)];
              });
              if (mergedDuplicate) {
                setToast('Merged with existing contact in History!');
              }
              setCurrentId(targetId);
              setDossierTab('overview');
              setView('dossier');
            }
          },
          ctrl.signal,
        );
        if (!finished && !ctrl.signal.aborted) setError((e) => e || 'The scan ended unexpectedly. Please retry.');
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message);
      }
    },
    [settings],
  );

  // ---------------------------------------------------------------- background
  const processNext = useCallback(async () => {
    if (workerBusy.current) return;
    const next = [...history].reverse().find((r) => r.status === 'queued' && pending.current.has(r.id));
    if (!next) return;
    workerBusy.current = true;
    const payload = pending.current.get(next.id)!;
    patchRecord(next.id, { status: 'processing', progress: 'Starting…', error: undefined });
    let finished = false;
    try {
      await streamScan(payload, settings, (evt) => {
        if (evt.type === 'step' && evt.status === 'running') patchRecord(next.id, { progress: evt.detail || evt.step });
        else if (evt.type === 'card') patchRecord(next.id, { card: evt.card });
        else if (evt.type === 'error') patchRecord(next.id, { status: 'error', error: evt.message, progress: undefined });
        else if (evt.type === 'result') {
          finished = true;
          patchRecord(next.id, { status: 'done', dossier: evt.dossier, demo: evt.demo, progress: undefined });
          pending.current.delete(next.id);
        }
      });
      if (!finished) setHistory((h) => h.map((r) => (r.id === next.id && r.status === 'processing' ? { ...r, status: 'error', error: r.error || 'Scan ended unexpectedly', progress: undefined } : r)));
    } catch (e) {
      patchRecord(next.id, { status: 'error', error: (e as Error).message, progress: undefined });
    } finally {
      workerBusy.current = false;
      setHistory((h) => [...h]); // trigger effect to pick up the next item
    }
  }, [history, settings, patchRecord]);

  useEffect(() => {
    processNext();
  }, [processNext]);

  const queueCount = history.filter((r) => r.status === 'queued' || r.status === 'processing').length;

  // ---------------------------------------------------------------- handlers
  const onScanImages = async ({ images, qrCard, scanMode = 'card', event, booth, location, contactRole, actionItems, initialNote }: ScanContextInput) => {
    const thumb = images?.[0] ? (await prepareImage(images[0].dataUrl, 480, 0.7)).dataUrl : undefined;
    const payload: ScanPayload = qrCard && !images?.length
      ? { card: qrCard, scanMode }
      : { images: (images || []).map(({ data, mimeType }) => ({ data, mimeType })), scanMode, ...(qrCard ? { card: qrCard } : {}) };
    const initialNotes: MeetingNote[] = initialNote ? [{ id: uid(), text: initialNote, createdAt: Date.now() }] : [];
    if (settings.eventMode) {
      const id = uid();
      pending.current.set(id, payload);
      setHistory((h) => [
        {
          id,
          createdAt: Date.now(),
          thumb,
          card: qrCard || emptyCard(),
          status: 'queued',
          scanMode,
          event: event || null,
          booth: booth || null,
          location: location || null,
          contactRole: contactRole || null,
          actionItems: actionItems || [],
          meetingNotes: initialNotes,
          associatedContacts: [],
          tags: [],
        },
        ...h,
      ]);
      setToast(`Card queued (${queueCount + 1} in progress). Keep scanning!`);
      return;
    }
    runJob(payload, thumb, undefined, { scanMode, event, booth, location, contactRole, actionItems, initialNotes });
  };

  const retryQueued = (id: string) => {
    if (pending.current.has(id)) patchRecord(id, { status: 'queued', error: undefined });
  };

  const cancel = () => {
    abortRef.current?.abort();
    setView(current && lastJob.current?.id ? 'dossier' : 'scan');
  };

  const nav = (v: View) => {
    if (view === 'processing') abortRef.current?.abort();
    setView(v);
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const attachShared = (record: ScanRecord) => {
    if (!shared) return;
    const card: Card = { ...record.card, socials: { ...record.card.socials } };
    if (shared.kind === 'person') {
      card.socials.linkedin = shared.url;
      card.linkedinSource = 'shared';
    } else {
      card.socials.other = [...new Set([...(card.socials.other || []), shared.url])];
    }
    setShared(null);
    runJob({ card }, record.thumb, record.id);
  };

  const title: Record<View, string> = {
    scan: settings.eventMode ? 'Event mode — rapid scanning' : 'Scan card or QR badge',
    processing: 'Analyzing…',
    dossier: '360° Company & Contact Dossier',
    history: 'Scanned cards, events & ROI',
    settings: 'Settings',
  };

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="safe-top sticky top-0 z-20 border-b border-white/[0.08] bg-ink-950/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 max-w-xl mx-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-sm shadow-indigo-600/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white">CardIntel</span>
              {!demoMode ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live AI
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Demo
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{title[view]}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setMyQrOpen(true)}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 active:scale-95"
              title="Show My Digital Business Card QR"
            >
              <QrCode className="h-3.5 w-3.5 text-indigo-400" /> My Card
            </button>
            {queueCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                {queueCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {view === 'scan' && (
          <ScanView
            demoMode={demoMode}
            eventMode={settings.eventMode}
            queueCount={queueCount}
            defaultEvent={settings.defaultEvent}
            autoGeo={settings.autoGeo}
            recentEvents={recentEvents}
            onToggleEventMode={() => updateSettings({ ...settings, eventMode: !settings.eventMode })}
            onChangeDefaultEvent={(defaultEvent) => updateSettings({ ...settings, defaultEvent })}
            onScan={onScanImages}
            onOpenMyQr={() => setMyQrOpen(true)}
            onOpenSettings={() => setView('settings')}
            onOpenQueue={() => setView('history')}
          />
        )}
        {view === 'processing' && (
          <ProgressView
            steps={steps}
            card={liveCard}
            thumb={scanThumb}
            error={error}
            onCancel={cancel}
            onRetry={() => lastJob.current && runJob(lastJob.current.payload, lastJob.current.thumb, lastJob.current.id, lastJob.current.meta)}
          />
        )}
        {view === 'dossier' && current && (
          <DossierView
            record={current}
            initialTab={dossierTab}
            settings={settings}
            companyContacts={companyContacts}
            recentEvents={recentEvents}
            crmTargets={health?.crm || []}
            onBack={() => setView('history')}
            onEdit={() => setEditing(true)}
            onRefresh={() => runJob({ card: current.card, refresh: true }, current.thumb, current.id)}
            onUpdateRecord={(patch) => patchRecord(current.id, patch)}
            onSelectRecord={(r) => {
              setCurrentId(r.id);
              setDossierTab('overview');
              window.scrollTo({ top: 0 });
            }}
            onPushCrm={(provider) => pushToCrm(provider, current, settings)}
            onDelete={() => {
              deleteServerRecord(current.id);
              setHistory((h) => h.filter((r) => r.id !== current.id));
              setCurrentId(null);
              setView('history');
            }}
          />
        )}
        {view === 'history' && (
          <HistoryView
            history={history}
            canRetry={(id) => pending.current.has(id)}
            onRetry={retryQueued}
            onOpen={(r, tab = 'overview') => {
              setCurrentId(r.id);
              setDossierTab(tab);
              setView('dossier');
              window.scrollTo({ top: 0 });
            }}
            onDelete={(id) => {
              deleteServerRecord(id);
              pending.current.delete(id);
              setHistory((h) => h.filter((r) => r.id !== id));
            }}
            onScan={() => setView('scan')}
          />
        )}
        {view === 'settings' && (
          <SettingsView settings={settings} health={health} onSave={updateSettings} onClearHistory={() => { pending.current.clear(); setHistory([]); }} />
        )}
      </main>

      {myQrOpen && (
        <MyDigitalCardModal
          settings={settings}
          onSaveSettings={updateSettings}
          onClose={() => setMyQrOpen(false)}
        />
      )}

      {editing && current && (
        <EditCardSheet
          card={current.card}
          onClose={() => setEditing(false)}
          onSubmit={(card) => {
            setEditing(false);
            runJob({ card }, current.thumb, current.id);
          }}
        />
      )}

      {shared && (
        <ShareTargetSheet
          link={shared}
          records={history.filter((r) => r.status === 'done' || (!r.status && r.dossier))}
          onPick={attachShared}
          onClose={() => setShared(null)}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" /> {toast}
          </div>
        </div>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-950/95 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto grid max-w-xl grid-cols-3 px-3 py-1.5">
          {([
            ['scan', 'Scan', ScanLine],
            ['history', 'Cards & ROI', HistoryIcon],
            ['settings', 'Settings', SettingsIcon],
          ] as const).map(([id, label, Icon]) => {
            const active = view === id || (id === 'scan' && view === 'processing') || (id === 'history' && view === 'dossier');
            return (
              <button
                key={id}
                onClick={() => nav(id)}
                className={`relative flex flex-col items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`flex h-8 w-14 items-center justify-center rounded-xl transition-all ${
                    active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-transparent text-slate-400'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px]">{label}</span>
                {id === 'history' && queueCount > 0 && (
                  <span className="absolute right-[24%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white shadow">
                    {queueCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
