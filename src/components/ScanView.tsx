import { useEffect, useRef, useState } from 'react';
import {
  Camera, ImagePlus, ScanLine, Sparkles, X, Video, Building2, Globe, Users, Target, Layers, ChevronRight,
  MapPin, Calendar, LocateFixed, Loader2, StickyNote, QrCode, Store, CheckSquare,
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import { prepareImage, type PreparedImage } from '../lib/image';
import { captureGeoLocation } from '../lib/geo';
import { detectQrFromImageSource, parseQrPayload } from '../lib/qr';
import type { Card, ContactRole, ScanLocation } from '../types';

export interface ScanContextInput {
  images?: PreparedImage[];
  qrCard?: Card;
  event?: string | null;
  booth?: string | null;
  location?: ScanLocation | null;
  contactRole?: ContactRole | null;
  actionItems?: string[];
  initialNote?: string;
}

interface Props {
  demoMode: boolean;
  eventMode: boolean;
  queueCount: number;
  defaultEvent: string;
  autoGeo: boolean;
  recentEvents: string[];
  onToggleEventMode: () => void;
  onChangeDefaultEvent: (evt: string) => void;
  onScan: (input: ScanContextInput) => void;
  onOpenMyQr: () => void;
  onOpenSettings: () => void;
  onOpenQueue: () => void;
}

const SAMPLES = [
  { src: '/samples/card-bharat.svg', label: '🇮🇳 Indian Card (GST + CIN)' },
  { src: '/samples/card-northwind.svg', label: 'Horizontal card' },
  { src: '/samples/card-vertical.svg', label: 'Vertical card' },
];

const QUICK_ACTIONS = [
  'Send Catalog / Brochure',
  'Send Price List / Quote',
  'Book Demo',
  'Share Sample',
  'WhatsApp Intro',
  'Factory / Office Visit',
];

const ROLES: { id: ContactRole; label: string }[] = [
  { id: 'buyer', label: 'Buyer / Client' },
  { id: 'distributor', label: 'Distributor / Dealer' },
  { id: 'partner', label: 'Partner' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'investor', label: 'Investor' },
];

export default function ScanView({
  demoMode,
  eventMode,
  queueCount,
  defaultEvent,
  autoGeo,
  recentEvents,
  onToggleEventMode,
  onChangeDefaultEvent,
  onScan,
  onOpenMyQr,
  onOpenSettings,
  onOpenQueue,
}: Props) {
  const [front, setFront] = useState<PreparedImage | null>(null);
  const [back, setBack] = useState<PreparedImage | null>(null);
  const [camera, setCamera] = useState<null | 'front' | 'back'>(null);
  const [busy, setBusy] = useState(false);

  // Event, Booth, GPS Location, Role & Action Checklist context
  const [eventName, setEventName] = useState(defaultEvent || '');
  const [booth, setBooth] = useState('');
  const [location, setLocation] = useState<ScanLocation | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [contactRole, setContactRole] = useState<ContactRole | null>(null);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [quickNote, setQuickNote] = useState('');

  // QR Badge / vCard decoded state
  const [decodedQrCard, setDecodedQrCard] = useState<Card | null>(null);
  const [showQrInput, setShowQrInput] = useState(false);
  const [qrTextInput, setQrTextInput] = useState('');

  const photoInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const target = useRef<'front' | 'back'>('front');

  useEffect(() => {
    setEventName(defaultEvent || '');
  }, [defaultEvent]);

  const fetchGps = async () => {
    setGeoBusy(true);
    try {
      const loc = await captureGeoLocation();
      if (loc) setLocation(loc);
    } finally {
      setGeoBusy(false);
    }
  };

  useEffect(() => {
    if (autoGeo && !location) {
      fetchGps();
    }
  }, [autoGeo]);

  const toggleAction = (item: string) => {
    setActionItems((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const submit = () => {
    if (!front && !decodedQrCard) return;
    const cleanEvt = eventName.trim() || null;
    if (cleanEvt && cleanEvt !== defaultEvent) {
      onChangeDefaultEvent(cleanEvt);
    }
    onScan({
      images: front ? ([front, back].filter(Boolean) as PreparedImage[]) : undefined,
      qrCard: decodedQrCard || undefined,
      event: cleanEvt,
      booth: booth.trim() || null,
      location,
      contactRole,
      actionItems,
      initialNote: quickNote.trim() || undefined,
    });
    setQuickNote('');
    setBooth('');
    setActionItems([]);
    setContactRole(null);
    setDecodedQrCard(null);
    if (eventMode) {
      setFront(null);
      setBack(null);
    }
  };

  const accept = async (blob: Blob | string, side: 'front' | 'back') => {
    setBusy(true);
    try {
      const img = await prepareImage(blob);
      side === 'front' ? setFront(img) : setBack(img);
      // Also check if image contains a QR badge / vCard QR code
      const qrRaw = await detectQrFromImageSource(blob);
      if (qrRaw) {
        const parsed = parseQrPayload(qrRaw);
        if (parsed) setDecodedQrCard(parsed);
      }
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await accept(f, target.current);
  };

  const pick = (side: 'front' | 'back', mode: 'photo' | 'upload') => {
    target.current = side;
    (mode === 'photo' ? photoInput : uploadInput).current?.click();
  };

  const handleManualQrParse = () => {
    const parsed = parseQrPayload(qrTextInput);
    if (parsed) {
      setDecodedQrCard(parsed);
      setShowQrInput(false);
      setQrTextInput('');
    } else {
      alert('Could not parse vCard, MeCard, or LinkedIn URL from text. Please check the format.');
    }
  };

  const side = front ? 'back' : 'front';

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      {demoMode && (
        <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-left text-sm text-amber-100">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Server Demo Mode.</b> Live AI is not yet configured on the server. Set <code>GEMINI_API_KEY</code> in your Render server Environment Variables to enable live scanning for all users.
          </span>
        </div>
      )}

      {/* Event, Booth/Stall, GPS Location & Quick Follow-up Checklist Bar */}
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-ink-800/80 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Event, Booth & GPS Context</span>
          <button
            type="button"
            onClick={onOpenMyQr}
            className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/30"
          >
            <QrCode className="h-3 w-3" /> Show My QR Card
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {/* Event / Conference input */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/90 px-3 py-2 sm:col-span-2">
            <Calendar className="h-4 w-4 shrink-0 text-indigo-300" />
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onBlur={() => eventName.trim() !== defaultEvent && onChangeDefaultEvent(eventName.trim())}
              placeholder="Event / Expo (e.g. Bharat Mobility, Elecrama, SaaSBoomi)"
              className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
            />
            {eventName && (
              <button onClick={() => { setEventName(''); onChangeDefaultEvent(''); }} className="text-slate-500 hover:text-slate-300" aria-label="Clear event">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Hall / Booth / Stall input */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/90 px-3 py-2">
            <Store className="h-4 w-4 shrink-0 text-fuchsia-300" />
            <input
              value={booth}
              onChange={(e) => setBooth(e.target.value)}
              placeholder="Hall / Stall (e.g. Hall 4, B-18)"
              className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* GPS Location input + refresh button */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/90 px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
          <input
            value={location?.label || ''}
            onChange={(e) => setLocation((prev) => ({ ...(prev || {}), label: e.target.value, capturedAt: prev?.capturedAt || Date.now() }))}
            placeholder={geoBusy ? 'Getting GPS location…' : 'GPS location / city / venue'}
            className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={fetchGps}
            disabled={geoBusy}
            title="Capture current GPS coordinates"
            className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 transition active:scale-95"
          >
            {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            GPS
          </button>
        </div>

        {/* Quick-pick recent event chips */}
        {recentEvents.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <span className="shrink-0 text-[10px] text-slate-500">Recent:</span>
            {recentEvents.slice(0, 5).map((ev) => (
              <button
                key={ev}
                type="button"
                onClick={() => { setEventName(ev); onChangeDefaultEvent(ev); }}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                  eventName === ev ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {ev}
              </button>
            ))}
          </div>
        )}

        {/* Quick Lead Role selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="shrink-0 text-[10px] text-slate-500">Role:</span>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setContactRole(contactRole === r.id ? null : r.id)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                contactRole === r.id ? 'bg-fuchsia-500 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* 1-Tap Expo Action Chips (Send Catalog, Price List, Demo, etc.) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
            <CheckSquare className="h-3 w-3 text-emerald-400" /> To-Do:
          </span>
          {QUICK_ACTIONS.map((act) => {
            const active = actionItems.includes(act);
            return (
              <button
                key={act}
                type="button"
                onClick={() => toggleAction(act)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                  active ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40' : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                {active ? `✓ ${act}` : `+ ${act}`}
              </button>
            );
          })}
        </div>

        {/* Quick meeting note */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/90 px-3 py-2">
          <StickyNote className="h-4 w-4 shrink-0 text-amber-300" />
          <input
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Quick note (e.g. 'Met with Amit at Stall B-18, needs 500 units quote')…"
            className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Event mode */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-ink-800/70 p-3">
        <Layers className={`h-5 w-5 shrink-0 ${eventMode ? 'text-indigo-300' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Event mode (batch queue)</div>
          <div className="text-xs text-slate-500">Scan many cards back-to-back; enrichment runs in the background.</div>
        </div>
        <button
          role="switch"
          aria-checked={eventMode}
          onClick={onToggleEventMode}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${eventMode ? 'bg-indigo-500' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${eventMode ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {eventMode && queueCount > 0 && (
        <button onClick={onOpenQueue} className="flex w-full items-center justify-between rounded-xl bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-200">
          <span>{queueCount} card(s) being enriched in the background</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Capture area */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="grid grid-cols-2 gap-3">
          {(['front', 'back'] as const).map((s) => {
            const img = s === 'front' ? front : back;
            return (
              <div key={s} className="relative aspect-[1.75] overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/20">
                {img ? (
                  <>
                    <img src={img.dataUrl} alt={`${s} of card`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => (s === 'front' ? (setFront(back), setBack(null)) : setBack(null))}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
                    <ScanLine className="h-6 w-6" />
                    {s === 'front' ? 'Front / QR Badge' : 'Back (optional)'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Decoded QR Badge Banner if detected */}
        {decodedQrCard && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
            <div>
              <span className="font-semibold">✓ QR Badge / vCard Decoded: </span>
              {[decodedQrCard.fullName, decodedQrCard.company, decodedQrCard.emails[0]].filter(Boolean).join(' · ')}
            </div>
            <button onClick={() => setDecodedQrCard(null)} className="text-emerald-300 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button onClick={() => pick(side, 'photo')} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-indigo-500 px-2 py-3 text-xs font-medium shadow-lg shadow-indigo-500/20 transition active:scale-95 disabled:opacity-40">
            <Camera className="h-5 w-5" /> Photo
          </button>
          <button onClick={() => setCamera(side)} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-xs font-medium transition active:scale-95 disabled:opacity-40">
            <Video className="h-5 w-5" /> Camera
          </button>
          <button onClick={() => pick(side, 'upload')} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-xs font-medium transition active:scale-95 disabled:opacity-40">
            <ImagePlus className="h-5 w-5" /> Upload
          </button>
          <button onClick={() => setShowQrInput(!showQrInput)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-xs font-medium text-indigo-200 transition active:scale-95">
            <QrCode className="h-5 w-5" /> QR / Badge
          </button>
        </div>

        {showQrInput && (
          <div className="mt-3 space-y-2 rounded-2xl border border-indigo-400/30 bg-ink-900/90 p-3">
            <div className="text-xs font-medium text-indigo-200">Paste QR Badge / vCard / LinkedIn URL</div>
            <textarea
              rows={3}
              value={qrTextInput}
              onChange={(e) => setQrTextInput(e.target.value)}
              placeholder="Paste scanned QR text (BEGIN:VCARD..., MECARD:..., LinkedIn URL, or Name | Role | Company | Email | Phone)"
              className="w-full rounded-xl border border-white/10 bg-ink-800 p-2.5 text-xs outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQrInput(false)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                Cancel
              </button>
              <button type="button" onClick={handleManualQrParse} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white">
                Decode & Use
              </button>
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={(!front && !decodedQrCard) || busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold shadow-lg shadow-fuchsia-500/20 transition active:scale-[0.98] disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none"
        >
          {eventMode ? <><Layers className="h-5 w-5" /> Add to queue</> : <><Sparkles className="h-5 w-5" /> Scan & Enrich 360°</>}
        </button>

        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {/* Samples (including Indian GSTIN + CIN card) */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">No card handy? Try a sample (including Indian MCA/GST card)</div>
        <div className="grid grid-cols-3 gap-2.5">
          {SAMPLES.map((s) => (
            <button key={s.src} onClick={() => accept(s.src, 'front').then(() => setBack(null))} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition active:scale-95">
              <img src={s.src} alt={s.label} className="aspect-[1.75] w-full object-contain bg-white/90" />
              <div className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-300">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        {[
          [Building2, 'India MCA CIN, GSTIN, GLEIF, Wikidata, SEC & D&B'],
          [Globe, 'Website crawl + Google Search + IndiaMART / Tofler'],
          [Users, 'Add colleagues met, booth tag, voice notes & GPS'],
          [Target, '1-tap WhatsApp, Hinglish/B2B follow-up & Event ROI'],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Building2;
          return (
            <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3">
              <I className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
              <span>{text as string}</span>
            </div>
          );
        })}
      </div>

      {camera && (
        <CameraCapture
          onClose={() => setCamera(null)}
          onCapture={async (blob) => {
            const s = camera;
            setCamera(null);
            await accept(blob, s);
          }}
        />
      )}
    </div>
  );
}
