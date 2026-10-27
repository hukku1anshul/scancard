import { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, ZoomIn, ZoomOut, Flashlight, RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';

type AspectMode = 'horizontal' | 'vertical' | 'square';

const ASPECT_RATIOS: Record<AspectMode, number> = {
  horizontal: 1.75,
  vertical: 1 / 1.55,
  square: 1,
};

/** Full-screen live camera with zoom in/out, pinch-to-zoom, torch, orientation switch, and precision scan-area cropping. */
export default function CameraCapture({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [aspect, setAspect] = useState<AspectMode>('horizontal');

  // Zoom state (1x .. 4x). Uses hardware zoom if supported, otherwise digital zoom
  const [zoom, setZoom] = useState(1);
  const [hwZoomRange, setHwZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    setReady(false);
    setZoom(1);
    setHwZoomRange(null);
    setHasTorch(false);
    setTorchOn(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera requires HTTPS (or localhost). Use "Photo" instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const track = s.getVideoTracks()[0];
        trackRef.current = track || null;
        if (track && 'getCapabilities' in track) {
          try {
            const caps = (track as any).getCapabilities?.() || {};
            if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number' && caps.zoom.max > caps.zoom.min) {
              setHwZoomRange({ min: caps.zoom.min, max: Math.min(caps.zoom.max, 5) });
            }
            if (caps.torch) {
              setHasTorch(true);
            }
          } catch {
            // ignore capability inspection errors
          }
        }
        const v = videoRef.current!;
        v.srcObject = s;
        v.play().then(() => setReady(true)).catch(() => setReady(true));
      })
      .catch((e) => setError(`Camera unavailable: ${e.message}`));
    return () => {
      cancelled = true;
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const applyZoom = (nextZoom: number) => {
    const clamped = Math.min(4, Math.max(1, Number(nextZoom.toFixed(2))));
    setZoom(clamped);
    if (hwZoomRange && trackRef.current) {
      const hwVal = Math.min(hwZoomRange.max, Math.max(hwZoomRange.min, clamped));
      (trackRef.current as any).applyConstraints?.({ advanced: [{ zoom: hwVal }] }).catch(() => {});
    }
  };

  const toggleTorch = () => {
    if (!trackRef.current || !hasTorch) return;
    const next = !torchOn;
    (trackRef.current as any)
      .applyConstraints?.({ advanced: [{ torch: next }] })
      .then(() => setTorchOn(next))
      .catch(() => {});
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchStart.current.dist > 10) {
        applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist));
      }
    }
  };

  const handleTouchEnd = () => {
    pinchStart.current = null;
  };

  /**
   * Capture ONLY the business card area inside the highlighted scan frame,
   * accounting for object-cover scaling and digital zoom.
   */
  const capture = () => {
    const v = videoRef.current;
    const container = containerRef.current;
    const frame = frameRef.current;
    if (!v || !v.videoWidth || !container || !frame) return;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const cRect = container.getBoundingClientRect();
    const fRect = frame.getBoundingClientRect();

    // Effective digital zoom (if hardware zoom handled it, CSS scale is 1; otherwise CSS scale is `zoom`)
    const digitalZoom = hwZoomRange ? 1 : zoom;

    // Video is rendered with `object-cover` inside `container`, then scaled by `digitalZoom` from center
    const coverScale = Math.max(cRect.width / vw, cRect.height / vh) * digitalZoom;
    const renderedW = vw * coverScale;
    const renderedH = vh * coverScale;

    // Top-left of the rendered video relative to container
    const videoLeft = (cRect.width - renderedW) / 2;
    const videoTop = (cRect.height - renderedH) / 2;

    // Frame coordinates relative to container
    const frameLeft = fRect.left - cRect.left;
    const frameTop = fRect.top - cRect.top;

    // Map frame box back to source video pixel coordinates
    const sx = Math.max(0, (frameLeft - videoLeft) / coverScale);
    const sy = Math.max(0, (frameTop - videoTop) / coverScale);
    const sw = Math.min(vw - sx, fRect.width / coverScale);
    const sh = Math.min(vh - sy, fRect.height / coverScale);

    const outW = 1600;
    const outH = Math.round(outW / ASPECT_RATIOS[aspect]);
    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    c.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH);
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.92);
  };

  const digitalScale = hwZoomRange ? 1 : zoom;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top Header */}
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2.5" aria-label="Close camera">
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-xs font-semibold text-white">Scan Business Card Area</div>
          <div className="text-[10px] text-slate-400">Zoom in/out so card fills the highlighted box</div>
        </div>
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`rounded-full p-2.5 ${torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'}`}
              aria-label="Toggle flashlight"
            >
              <Flashlight className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="rounded-full bg-white/10 p-2.5"
            aria-label="Switch camera"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Frame Orientation Switcher */}
      <div className="z-10 flex items-center justify-center gap-2 pb-2">
        {(
          [
            ['horizontal', RectangleHorizontal, 'Horizontal'],
            ['vertical', RectangleVertical, 'Vertical'],
            ['square', Square, 'QR / Badge'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAspect(id)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
              aspect === id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Live Video + Highlighted Scan Area Box */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 overflow-hidden touch-none"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            transform: `scale(${digitalScale})`,
            transformOrigin: 'center center',
          }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-75"
        />
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-rose-300">{error}</div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              ref={frameRef}
              style={{ aspectRatio: String(ASPECT_RATIOS[aspect]) }}
              className={`relative rounded-2xl border border-indigo-400/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)] ${
                aspect === 'vertical' ? 'h-[82%] max-h-[430px]' : aspect === 'square' ? 'h-[72%] max-h-[340px]' : 'w-[90%] max-w-xl'
              }`}
            >
              {/* Rule-of-thirds alignment grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                <div className="border-b border-r border-white/10" />
                <div className="border-b border-r border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-b border-r border-white/10" />
                <div className="border-b border-r border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div className="border-r border-white/10" />
                <div />
              </div>

              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => (
                <span key={c} className={`absolute h-8 w-8 border-indigo-400 ${c}`} />
              ))}
              {ready && <span className="animate-scanline absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />}

              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-0.5 text-[11px] text-indigo-200">
                Only the area inside this box will be scanned ({zoom.toFixed(1)}x)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zoom Controls + Shutter Button */}
      <div className="safe-bottom space-y-3 bg-black/90 px-5 pb-6 pt-3">
        {/* Preset Zoom Buttons */}
        <div className="flex items-center justify-center gap-2">
          {[1, 1.5, 2, 3].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyZoom(preset)}
              className={`h-8 min-w-10 rounded-full px-2.5 text-xs font-semibold transition ${
                Math.abs(zoom - preset) < 0.1 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-300'
              }`}
            >
              {preset}x
            </button>
          ))}
        </div>

        {/* Smooth Zoom Slider */}
        <div className="mx-auto flex max-w-sm items-center gap-3">
          <button
            type="button"
            onClick={() => applyZoom(zoom - 0.25)}
            className="rounded-full bg-white/10 p-2 text-slate-200 active:scale-95"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/20 accent-indigo-500"
          />
          <button
            type="button"
            onClick={() => applyZoom(zoom + 0.25)}
            className="rounded-full bg-white/10 p-2 text-slate-200 active:scale-95"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center pt-1">
          <button
            onClick={capture}
            disabled={!ready}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-indigo-500 shadow-lg shadow-indigo-500/30 transition active:scale-95 disabled:opacity-40"
            aria-label="Capture scan area"
          >
            <Camera className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
