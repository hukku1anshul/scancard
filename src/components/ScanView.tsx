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
    <div className="space-y-3 px-3.5 pb-6 pt-1 max-w-lg mx-auto">
      {/* Minimal Top Mode Switcher - 1-hand thumb friendly */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
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
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40'
                  : 'bg-ink-900/80 text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span>{m.label.split(' / ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Context Quick Pill & Rapid Mode Toggle */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2 text-xs backdrop-blur-md">
        <button
          type="button"
          onClick={() => setContextExpanded(!contextExpanded)}
          className="flex min-w-0 items-center gap-1.5 font-medium text-slate-300 hover:text-white transition truncate active:scale-95"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <span className="truncate">
            {eventName ? `${eventName}${booth ? ` · ${booth}` : ''}` : '+ Event / Booth Context'}
          </span>
          {contextExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={eventMode}
            onClick={onToggleEventMode}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition active:scale-95 ${
              eventMode ? 'bg-indigo-600/30 border border-indigo-400/40 text-indigo-200' : 'bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Rapid</span>
          </button>
        </div>
      </div>

      {/* Expandable Context Sheet (Clean & Compact) */}
      {contextExpanded && (
        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-ink-900/95 p-3.5 shadow-xl">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 sm:col-span-2">
              <Calendar className="h-4 w-4 shrink-0 text-indigo-400" />
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                onBlur={() => eventName.trim() !== defaultEvent && onChangeDefaultEvent(eventName.trim())}
                placeholder="Event / Expo (e.g. Bharat Mobility)"
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
              {eventName && (
                <button onClick={() => { setEventName(''); onChangeDefaultEvent(''); }} className="text-slate-500 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              <Store className="h-4 w-4 shrink-0 text-indigo-400" />
              <input
                value={booth}
                onChange={(e) => setBooth(e.target.value)}
                placeholder="Booth / Stall"
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
            <input
              value={location?.label || ''}
              onChange={(e) => setLocation((prev) => ({ ...(prev || {}), label: e.target.value, capturedAt: prev?.capturedAt || Date.now() }))}
              placeholder={geoBusy ? 'Locating…' : 'Venue / GPS Location'}
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={fetchGps}
              disabled={geoBusy}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 active:scale-95"
            >
              {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
              GPS
            </button>
          </div>

          {recentEvents.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <span className="shrink-0 text-[10px] text-slate-500">Recent:</span>
              {recentEvents.slice(0, 4).map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => { setEventName(ev); onChangeDefaultEvent(ev); }}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                    eventName === ev ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <span className="shrink-0 text-[10px] text-slate-500">Role:</span>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setContactRole(contactRole === r.id ? null : r.id)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  contactRole === r.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label.split(' / ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <StickyNote className="h-4 w-4 shrink-0 text-amber-400" />
            <input
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Quick meeting note / context…"
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setContextExpanded(false)}
              className="rounded-xl bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/15 active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Centerpiece: Clean, Professional Card Viewfinder */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-b from-ink-900 to-ink-950 p-3.5 shadow-2xl">
        <div className="grid grid-cols-2 gap-2.5">
          {(['front', 'back'] as const).map((s) => {
            const img = s === 'front' ? front : back;
            const raw = s === 'front' ? rawFront : rawBack;
            return (
              <div
                key={s}
                onClick={() => {
                  if (!img) pick(s, 'photo');
                }}
                className={`group relative aspect-[1.65] overflow-hidden rounded-2xl border transition-all ${
                  img
                    ? 'border-indigo-400/30 bg-black/50'
                    : 'border-dashed border-white/20 bg-black/30 hover:border-indigo-400/50 cursor-pointer active:scale-[0.98]'
                }`}
              >
                {/* Minimal Precision Reticles */}
                <div className="pointer-events-none absolute inset-2">
                  <div className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 border-indigo-400/70 rounded-tl-sm" />
                  <div className="absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 border-indigo-400/70 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-indigo-400/70 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-indigo-400/70 rounded-br-sm" />
                </div>

                {img ? (
                  <>
                    <img src={img.dataUrl} alt={`${s} of card`} className="h-full w-full object-contain bg-ink-950/80" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropSession({ source: raw || img.dataUrl, side: s });
                      }}
                      className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow backdrop-blur hover:bg-indigo-500 active:scale-95"
                    >
                      <Crop className="h-3 w-3" /> Frame
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-slate-300 hover:text-white"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-400">
                    <ScanLine className="h-5 w-5 text-indigo-400" />
                    <span className="font-semibold text-slate-200 text-[11px]">{s === 'front' ? 'Front Side' : 'Back Side'}</span>
                    <span className="text-[10px] text-slate-500">Tap to capture</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* QR Badge Result Pill */}
        {decodedQrCard && (
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100">
            <div className="truncate font-medium">
              ✓ {[decodedQrCard.fullName, decodedQrCard.company].filter(Boolean).join(' · ')}
            </div>
            <button onClick={() => setDecodedQrCard(null)} className="ml-2 text-emerald-300 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 4 Big, Ergonomic Thumb-Zone Action Buttons */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            onClick={() => setCamera(side)}
            disabled={!!(front && back)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3 text-xs font-semibold text-slate-200 transition active:scale-95 disabled:opacity-30 hover:bg-white/[0.08]"
          >
            <Video className="h-5 w-5 text-indigo-400" />
            <span>Camera</span>
          </button>
          <button
            onClick={() => pick(side, 'photo')}
            disabled={!!(front && back)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-indigo-400/40 bg-indigo-600/20 py-3 text-xs font-semibold text-indigo-200 transition active:scale-95 disabled:opacity-30 hover:bg-indigo-600/30 shadow-sm"
          >
            <Camera className="h-5 w-5 text-indigo-300" />
            <span>Photo</span>
          </button>
          <button
            onClick={() => pick(side, 'upload')}
            disabled={!!(front && back)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3 text-xs font-semibold text-slate-200 transition active:scale-95 disabled:opacity-30 hover:bg-white/[0.08]"
          >
            <ImagePlus className="h-5 w-5 text-slate-400" />
            <span>Upload</span>
          </button>
          <button
            onClick={() => setShowQrInput(!showQrInput)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3 text-xs font-semibold text-slate-200 transition active:scale-95 hover:bg-white/[0.08]"
          >
            <QrCode className="h-5 w-5 text-slate-300" />
            <span>QR Badge</span>
          </button>
        </div>

        {/* Manual QR Drawer */}
        {showQrInput && (
          <div className="mt-2.5 space-y-2 rounded-2xl border border-white/10 bg-ink-900 p-3">
            <textarea
              rows={2}
              value={qrTextInput}
              onChange={(e) => setQrTextInput(e.target.value)}
              placeholder="Paste vCard or LinkedIn URL…"
              className="w-full rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-white outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQrInput(false)} className="rounded-lg bg-white/5 px-3 py-1 text-xs text-slate-400">
                Cancel
              </button>
              <button type="button" onClick={handleManualQrParse} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                Decode
              </button>
            </div>
          </div>
        )}

        {/* Primary 1-Thumb Floating CTA Button */}
        <button
          onClick={submit}
          disabled={(!front && !decodedQrCard) || busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none hover:bg-indigo-500"
        >
          {eventMode ? (
            <>
              <Layers className="h-5 w-5" /> Add to Rapid Queue
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" /> Enrich 360° Dossier
            </>
          )}
        </button>

        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {/* Discrete 1-Line Test Samples (Zero Clutter) */}
      <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-slate-500">
        <span>Try card:</span>
        {SAMPLES.map((s) => (
          <button
            key={s.src}
            type="button"
            onClick={() => accept(s.src, 'front').then(() => setBack(null))}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-white hover:border-white/20 active:scale-95 transition"
          >
            {s.label.replace('🇮🇳 ', '').split(' (')[0]}
          </button>
        ))}
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
