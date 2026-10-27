import { useRef, useState } from 'react';
import { Camera, ImagePlus, ScanLine, Sparkles, X, Video, Building2, Globe, Users, Target, Layers, ChevronRight } from 'lucide-react';
import CameraCapture from './CameraCapture';
import { prepareImage, type PreparedImage } from '../lib/image';

interface Props {
  demoMode: boolean;
  eventMode: boolean;
  queueCount: number;
  onToggleEventMode: () => void;
  onScan: (images: PreparedImage[]) => void;
  onOpenSettings: () => void;
  onOpenQueue: () => void;
}

const SAMPLES = [
  { src: '/samples/card-northwind.svg', label: 'Horizontal card' },
  { src: '/samples/card-vertical.svg', label: 'Vertical card' },
];

export default function ScanView({ demoMode, eventMode, queueCount, onToggleEventMode, onScan, onOpenSettings, onOpenQueue }: Props) {
  const [front, setFront] = useState<PreparedImage | null>(null);
  const [back, setBack] = useState<PreparedImage | null>(null);
  const [camera, setCamera] = useState<null | 'front' | 'back'>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const target = useRef<'front' | 'back'>('front');

  const submit = () => {
    if (!front) return;
    onScan([front, back].filter(Boolean) as PreparedImage[]);
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

  const side = front ? 'back' : 'front';

  return (
    <div className="space-y-5 px-4 pb-6 pt-2">
      {demoMode && (
        <button onClick={onOpenSettings} className="flex w-full items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-left text-sm text-amber-100">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Demo mode.</b> Scans return a sample dossier. Tap here to add your Gemini API key and scan real cards.
          </span>
        </button>
      )}

      {/* Event mode */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-ink-800/70 p-3">
        <Layers className={`h-5 w-5 shrink-0 ${eventMode ? 'text-indigo-300' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Event mode</div>
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
                    {s === 'front' ? 'Front' : 'Back (optional)'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => pick(side, 'photo')} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-indigo-500 px-2 py-3 text-xs font-medium shadow-lg shadow-indigo-500/20 transition active:scale-95 disabled:opacity-40">
            <Camera className="h-5 w-5" /> Take photo
          </button>
          <button onClick={() => setCamera(side)} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-xs font-medium transition active:scale-95 disabled:opacity-40">
            <Video className="h-5 w-5" /> Live camera
          </button>
          <button onClick={() => pick(side, 'upload')} disabled={!!(front && back)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-xs font-medium transition active:scale-95 disabled:opacity-40">
            <ImagePlus className="h-5 w-5" /> Upload
          </button>
        </div>

        <button
          onClick={submit}
          disabled={!front || busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold shadow-lg shadow-fuchsia-500/20 transition active:scale-[0.98] disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none"
        >
          {eventMode ? <><Layers className="h-5 w-5" /> Add to queue</> : <><Sparkles className="h-5 w-5" /> Scan & Enrich</>}
        </button>

        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {/* Samples */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">No card handy? Try a sample</div>
        <div className="grid grid-cols-2 gap-3">
          {SAMPLES.map((s) => (
            <button key={s.src} onClick={() => accept(s.src, 'front').then(() => setBack(null))} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition active:scale-95">
              <img src={s.src} alt={s.label} className="aspect-[1.75] w-full object-contain bg-white/90" />
              <div className="px-2.5 py-1.5 text-xs text-slate-400">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        {[
          [Building2, 'GLEIF, Wikidata, SEC & D&B registry data'],
          [Globe, 'Website crawl + Google Search research'],
          [Users, 'LinkedIn match with identity confidence'],
          [Target, 'Customers, ICP, talking points & CRM sync'],
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
