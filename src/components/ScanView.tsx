import { useEffect, useRef, useState } from 'react';
import {
  Camera, ImagePlus, ScanLine, Sparkles, X, Video, Building2, Globe, Users, Target, Layers, ChevronRight,
  MapPin, Calendar, LocateFixed, Loader2, StickyNote, QrCode, Store, CheckSquare, Crop, FileCheck2, Package, Smartphone, CreditCard,
  ChevronDown, ChevronUp, SlidersHorizontal, Check, Zap,
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import PhotoCropModal from './PhotoCropModal';
import { prepareImage, type PreparedImage } from '../lib/image';
import { captureGeoLocation } from '../lib/geo';
import { detectQrFromImageSource, parseQrPayload } from '../lib/qr';
import type { Card, ContactRole, ScanLocation, ScanMode } from '../types';

export interface ScanContextInput {
  images?: PreparedImage[];
  qrCard?: Card;
  scanMode?: ScanMode;
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

const SCAN_MODES: { id: ScanMode; label: string; desc: string; icon: typeof CreditCard; defaultRole?: ContactRole }[] = [
  { id: 'card', label: 'Card / Badge', desc: 'Business cards & conference visitor badges', icon: CreditCard },
  { id: 'stall_signboard', label: 'Stall / Signboard', desc: 'Expo booth fascia, shop signboards & building directories', icon: Store, defaultRole: 'distributor' },
  { id: 'invoice_kyc', label: 'Invoice / KYC', desc: 'GST invoices, letterheads & vendor onboarding verification', icon: FileCheck2, defaultRole: 'vendor' },
  { id: 'product_pack', label: 'Product / Label', desc: '"Manufactured by" box labels, machinery nameplates & brochures', icon: Package, defaultRole: 'vendor' },
  { id: 'digital_screenshot', label: 'Screenshot', desc: 'Email signatures, LinkedIn profiles & WhatsApp contact cards', icon: Smartphone },
];

const MODE_ACTIONS: Record<ScanMode, string[]> = {
  card: ['Send Catalog / Brochure', 'Send Price List / Quote', 'Book Demo', 'Share Sample', 'WhatsApp Intro', 'Factory / Office Visit'],
  stall_signboard: ['Send Dealer Terms', 'Check Territory Availability', 'Send Catalog / Brochure', 'Send Price List / Quote', 'Schedule Store Visit'],
  invoice_kyc: ['Verify GST & PAN', 'Approve Vendor Onboarding', 'Request Cancelled Cheque', 'MSME Udyam Check', 'Site Visit Verified'],
  product_pack: ['Request OEM Quote', 'Ask for MOQ & Bulk Pricing', 'Request Product Sample', 'Check Distributor Margin', 'Verify BIS / ISO Cert'],
  digital_screenshot: ['Send LinkedIn Connection', 'WhatsApp Intro', 'Send Deck / Profile', 'Schedule Discovery Call'],
};

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
  const [rawFront, setRawFront] = useState<Blob | string | null>(null);
  const [rawBack, setRawBack] = useState<Blob | string | null>(null);
  const [cropSession, setCropSession] = useState<{ source: Blob | string; side: 'front' | 'back' } | null>(null);
  const [camera, setCamera] = useState<null | 'front' | 'back'>(null);
  const [busy, setBusy] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('card');

  // Event, Booth, GPS Location, Role & Action Checklist context
  const [eventName, setEventName] = useState(defaultEvent || '');
  const [booth, setBooth] = useState('');
  const [location, setLocation] = useState<ScanLocation | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [contactRole, setContactRole] = useState<ContactRole | null>(null);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [quickNote, setQuickNote] = useState('');
  const [contextExpanded, setContextExpanded] = useState(Boolean(defaultEvent));

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
      scanMode,
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

  const accept = async (blob: Blob | string, side: 'front' | 'back', rawSource?: Blob | string) => {
    setBusy(true);
    try {
      const img = await prepareImage(blob);
      if (side === 'front') {
        setFront(img);
        if (rawSource !== undefined) setRawFront(rawSource);
        else if (!rawFront) setRawFront(blob);
      } else {
        setBack(img);
        if (rawSource !== undefined) setRawBack(rawSource);
        else if (!rawBack) setRawBack(blob);
      }
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
    if (f) {
      // Open interactive Photo Scan Area so user can zoom in/out & frame the business card
      setCropSession({ source: f, side: target.current });
    }
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
    <div className="space-y-3.5 px-4 pb-6 pt-2">
      {demoMode && (
        <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-left text-xs text-amber-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <b>Server Demo Mode.</b> Live AI is running in simulated sandbox mode. Set <code>GEMINI_API_KEY</code> on your server to run full live enrichment.
          </span>
        </div>
      )}

      {/* Modern Segmented Scan Mode Bar */}
      <div className="rounded-2xl border border-white/10 bg-ink-900/90 p-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {SCAN_MODES.map((m) => {
            const Icon = m.icon;
            const active = scanMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setScanMode(m.id);
                  if (m.defaultRole && !contactRole) setContactRole(m.defaultRole);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? 'border border-indigo-400/60 bg-gradient-to-r from-indigo-500/30 to-fuchsia-500/20 text-white shadow-md shadow-indigo-500/20'
                    : 'border border-white/5 bg-ink-800/60 text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-indigo-300' : 'text-slate-400'}`} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between px-1.5 pt-1 text-[11px] text-slate-400 border-t border-white/5">
          <span className="flex items-center gap-1 truncate text-slate-300">
            <Zap className="h-3 w-3 text-indigo-400 shrink-0" />
            {SCAN_MODES.find((m) => m.id === scanMode)?.desc}
          </span>
          <button
            type="button"
            onClick={onOpenMyQr}
            className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/25"
          >
            <QrCode className="h-3 w-3" /> My Card
          </button>
        </div>
      </div>

      {/* Collapsible Event & Booth Context Drawer */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 shadow-md backdrop-blur-md transition-all">
        {/* Compact Header Summary Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 shrink-0 text-indigo-400" />
            <div className="truncate">
              {eventName ? (
                <span className="font-medium text-slate-200">
                  {eventName}
                  {booth && <span className="text-slate-400"> · {booth}</span>}
                  {location?.label && <span className="text-emerald-400"> · 📍 {location.label}</span>}
                </span>
              ) : (
                <span className="text-slate-400">Event & Booth Context (Optional)</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContextExpanded(!contextExpanded)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10"
          >
            <SlidersHorizontal className="h-3 w-3 text-indigo-300" />
            {contextExpanded ? 'Hide' : eventName ? 'Edit' : 'Add Context'}
            {contextExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Expanded Drawer Details */}
        {contextExpanded && (
          <div className="space-y-2.5 border-t border-white/5 p-3.5 bg-black/20">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* Event / Expo input */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2 sm:col-span-2">
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
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2">
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
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2">
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
                    contactRole === r.id ? 'bg-fuchsia-500 text-white' : 'border border-white/5 bg-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 1-Tap Mode-Adaptive Action Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <span className="shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
                <CheckSquare className="h-3 w-3 text-emerald-400" /> To-Do:
              </span>
              {(MODE_ACTIONS[scanMode] || MODE_ACTIONS.card).map((act) => {
                const active = actionItems.includes(act);
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleAction(act)}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                      active ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40' : 'border border-white/5 bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {active ? `✓ ${act}` : `+ ${act}`}
                  </button>
                );
              })}
            </div>

            {/* Quick meeting note */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2">
              <StickyNote className="h-4 w-4 shrink-0 text-amber-300" />
              <input
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Quick note (e.g. 'Met with Amit at Stall B-18, needs 500 units quote')…"
                className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Event Mode (Batch Queue) Toggle Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-ink-900/60 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Layers className={`h-4 w-4 shrink-0 ${eventMode ? 'text-indigo-400' : 'text-slate-500'}`} />
          <div>
            <div className="text-xs font-medium text-slate-200">Rapid Scan Mode (Batch Queue)</div>
            <div className="text-[10px] text-slate-500">Scan consecutive cards; enrichment runs in the background</div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={eventMode}
          onClick={onToggleEventMode}
          className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${eventMode ? 'bg-indigo-500' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${eventMode ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {eventMode && queueCount > 0 && (
        <button onClick={onOpenQueue} className="flex w-full items-center justify-between rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-200">
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-300" />
            {queueCount} card(s) being enriched in background
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Card Capture Viewfinder Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-ink-900 via-ink-850 to-ink-950 p-4 shadow-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />

        {/* 2-Slot Front & Back Card Silhouette Reticles */}
        <div className="grid grid-cols-2 gap-3">
          {(['front', 'back'] as const).map((s) => {
            const img = s === 'front' ? front : back;
            const raw = s === 'front' ? rawFront : rawBack;
            return (
              <div
                key={s}
                className="group relative aspect-[1.7] overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-inner"
              >
                {/* Precision Corner Reticles */}
                <div className="pointer-events-none absolute inset-1.5">
                  <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-indigo-400/60 rounded-tl-sm" />
                  <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-indigo-400/60 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-indigo-400/60 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-indigo-400/60 rounded-br-sm" />
                </div>

                {img ? (
                  <>
                    <img src={img.dataUrl} alt={`${s} of card`} className="h-full w-full object-contain bg-ink-950/80" />
                    <button
                      type="button"
                      onClick={() => setCropSession({ source: raw || img.dataUrl, side: s })}
                      className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-indigo-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur hover:bg-indigo-500 active:scale-95 transition"
                      title="Zoom in/out & adjust scan frame"
                    >
                      <Crop className="h-3 w-3" /> Zoom / Frame
                    </button>
                    <button
                      onClick={() => {
                        if (s === 'front') {
                          setFront(back);
                          setRawFront(rawBack);
                          setBack(null);
                          setRawBack(null);
                        } else {
                          setBack(null);
                          setRawBack(null);
                        }
                      }}
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-slate-300 hover:text-white transition"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-slate-400">
                    <ScanLine className="h-6 w-6 text-indigo-400/80 animate-pulse" />
                    <span className="font-medium text-slate-300">{s === 'front' ? 'Front Side / QR' : 'Back (Optional)'}</span>
                    <span className="text-[10px] text-slate-500">Tap below to capture</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Decoded QR Badge Banner if detected */}
        {decodedQrCard && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
            <div className="truncate">
              <span className="font-semibold text-emerald-300">✓ QR Badge Decoded: </span>
              {[decodedQrCard.fullName, decodedQrCard.company, decodedQrCard.emails[0]].filter(Boolean).join(' · ')}
            </div>
            <button onClick={() => setDecodedQrCard(null)} className="ml-2 text-emerald-300 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 4 Quick Capture Buttons */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            onClick={() => setCamera(side)}
            disabled={!!(front && back)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-xs font-medium text-slate-200 transition active:scale-95 disabled:opacity-40 hover:bg-white/10"
          >
            <Video className="h-5 w-5 text-indigo-400" />
            <span>Camera</span>
          </button>
          <button
            onClick={() => pick(side, 'photo')}
            disabled={!!(front && back)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-2 py-2.5 text-xs font-semibold text-indigo-200 shadow-sm transition active:scale-95 disabled:opacity-40 hover:bg-indigo-500/30"
          >
            <Camera className="h-5 w-5 text-indigo-300" />
            <span>Photo</span>
          </button>
          <button
            onClick={() => pick(side, 'upload')}
            disabled={!!(front && back)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-xs font-medium text-slate-200 transition active:scale-95 disabled:opacity-40 hover:bg-white/10"
          >
            <ImagePlus className="h-5 w-5 text-slate-400" />
            <span>Upload</span>
          </button>
          <button
            onClick={() => setShowQrInput(!showQrInput)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-xs font-medium text-slate-200 transition active:scale-95 hover:bg-white/10"
          >
            <QrCode className="h-5 w-5 text-fuchsia-400" />
            <span>QR Badge</span>
          </button>
        </div>

        {/* Manual QR / vCard Input Drawer */}
        {showQrInput && (
          <div className="mt-3 space-y-2 rounded-2xl border border-indigo-400/30 bg-ink-900/95 p-3">
            <div className="text-xs font-medium text-indigo-200">Paste QR Badge / vCard / LinkedIn URL</div>
            <textarea
              rows={3}
              value={qrTextInput}
              onChange={(e) => setQrTextInput(e.target.value)}
              placeholder="Paste scanned QR text (BEGIN:VCARD..., MECARD:..., LinkedIn URL, or Name | Role | Company | Email | Phone)"
              className="w-full rounded-xl border border-white/10 bg-ink-800 p-2.5 text-xs text-slate-100 outline-none focus:border-indigo-400"
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

        {/* Floating Primary CTA Button */}
        <button
          onClick={submit}
          disabled={(!front && !decodedQrCard) || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          {eventMode ? (
            <>
              <Layers className="h-5 w-5" /> Add to Rapid Queue
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" /> Scan & Enrich 360° Dossier
            </>
          )}
        </button>

        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {/* Samples Carousel / Grid */}
      <div className="rounded-2xl border border-white/5 bg-ink-900/40 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          No card handy? Try a live test sample
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.src}
              onClick={() => accept(s.src, 'front').then(() => setBack(null))}
              className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition hover:border-indigo-400/40 active:scale-95"
            >
              <img src={s.src} alt={s.label} className="aspect-[1.75] w-full object-contain bg-white/95 transition group-hover:scale-105" />
              <div className="truncate px-2 py-1.5 text-[10px] font-medium text-slate-300">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 360° Value Badges */}
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        {[
          [Building2, 'India MCA CIN, GSTIN, GLEIF, Wikidata, SEC & D&B'],
          [Globe, 'Website crawl + Google Search + IndiaMART / Tofler'],
          [Users, 'Add colleagues met, booth tag, voice notes & GPS'],
          [Target, '1-tap WhatsApp, Hinglish/B2B follow-up & Event ROI'],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Building2;
          return (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-white/5 bg-ink-900/60 p-2.5">
              <I className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <span className="text-[11px] leading-snug">{text as string}</span>
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
            await accept(blob, s, blob);
          }}
        />
      )}

      {cropSession && (
        <PhotoCropModal
          source={cropSession.source}
          sideLabel={cropSession.side === 'front' ? 'Front Side' : 'Back Side'}
          onCancel={() => setCropSession(null)}
          onConfirm={async (croppedBlob) => {
            const { source, side: cropSide } = cropSession;
            setCropSession(null);
            await accept(croppedBlob, cropSide, source);
          }}
        />
      )}
    </div>
  );
}
