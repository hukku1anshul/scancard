import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X, Maximize2, Move, RectangleHorizontal, RectangleVertical, Square, FileText, Store } from 'lucide-react';

type AspectMode = 'horizontal' | 'vertical' | 'banner' | 'document' | 'square';

interface Props {
  source: Blob | string;
  sideLabel: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const ASPECT_RATIOS: Record<AspectMode, { ratio: number; label: string }> = {
  horizontal: { ratio: 1.75, label: 'Card (H)' },
  vertical: { ratio: 1 / 1.55, label: 'Card (V)' },
  banner: { ratio: 2.35, label: 'Signboard' },
  document: { ratio: 1 / 1.35, label: 'Invoice / Doc' },
  square: { ratio: 1, label: 'Badge / Box' },
};

/**
 * Interactive Photo Scan Area modal:
 * Lets the user zoom in/out (slider, buttons, wheel, or 2-finger pinch),
 * drag/pan the image, rotate 90°, and switch frame orientation so only
 * the business card inside the scan window is sent for OCR.
 */
export default function PhotoCropModal({ source, sideLabel, onConfirm, onCancel }: Props) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<AspectMode>('horizontal');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgEl(img);
      // Auto-select vertical frame if image is tall portrait
      if (img.height > img.width * 1.2) {
        setAspect('vertical');
      } else {
        setAspect('horizontal');
      }
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = url;
    return () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
    };
  }, [source]);

  const clampZoom = (z: number) => Math.min(4, Math.max(0.5, Number(z.toFixed(2))));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (pinchStart.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStart.current = null;
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
        const scale = dist / pinchStart.current.dist;
        setZoom(clampZoom(pinchStart.current.zoom * scale));
      }
    }
  };

  const handleTouchEnd = () => {
    pinchStart.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoom((z) => clampZoom(z + delta));
  };

  const rotate90 = () => {
    setRotation((r) => (r + 90) % 360);
    setPan({ x: 0, y: 0 });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  /** Render the exact visible scan area into a high-resolution canvas and return a JPEG Blob. */
  const cropScanArea = () => {
    if (!imgEl || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const rotRad = (rotation * Math.PI) / 180;
    const swapped = rotation % 180 !== 0;
    const natW = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
    const natH = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;

    // Base "contain" scale inside the scan frame at zoom = 1
    const baseScale = Math.min(rect.width / natW, rect.height / natH);
    const displayW = natW * baseScale * zoom;
    const displayH = natH * baseScale * zoom;

    // High-res output canvas matching the scan frame aspect ratio
    const outW = 1600;
    const outH = Math.round(outW / ASPECT_RATIOS[aspect].ratio);
    const scaleToOut = outW / rect.width;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    // Dark neutral background in case user zoomed out below 1x
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    // Move to center of output canvas + scaled pan offset
    ctx.translate(outW / 2 + pan.x * scaleToOut, outH / 2 + pan.y * scaleToOut);
    ctx.rotate(rotRad);

    const drawW = (swapped ? displayH : displayW) * scaleToOut;
    const drawH = (swapped ? displayW : displayH) * scaleToOut;
    ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    canvas.toBlob(
      (b) => {
        if (b) onConfirm(b);
      },
      'image/jpeg',
      0.92,
    );
  };

  // Compute CSS display dimensions for the preview inside the frame
  let previewStyle: React.CSSProperties = {};
  if (imgEl && frameRef.current) {
    const rect = frameRef.current.getBoundingClientRect();
    const swapped = rotation % 180 !== 0;
    const natW = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
    const natH = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;
    const baseScale = rect.width && rect.height ? Math.min(rect.width / natW, rect.height / natH) : 1;
    const rawW = imgEl.naturalWidth * baseScale;
    const rawH = imgEl.naturalHeight * baseScale;
    previewStyle = {
      width: `${rawW}px`,
      height: `${rawH}px`,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
      transformOrigin: 'center center',
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 backdrop-blur-md">
      {/* Top Bar */}
      <div className="safe-top flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button onClick={onCancel} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-200">
          <X className="h-4 w-4" /> Cancel
        </button>
        <div className="text-center">
          <div className="text-xs font-semibold text-white">Adjust Scan Area ({sideLabel})</div>
          <div className="text-[10px] text-slate-400">Zoom & drag so the card fills the scan box</div>
        </div>
        <button onClick={resetView} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
          Reset
        </button>
      </div>

      {/* Aspect Ratio / Orientation Selector */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 pt-3">
        {(
          [
            ['horizontal', RectangleHorizontal, 'Card (H)'],
            ['vertical', RectangleVertical, 'Card (V)'],
            ['banner', Store, 'Signboard'],
            ['document', FileText, 'Invoice / Doc'],
            ['square', Square, 'Badge / Box'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setAspect(id);
              setPan({ x: 0, y: 0 });
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition ${
              aspect === id ? 'bg-indigo-500 text-white shadow' : 'bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <button
          type="button"
          onClick={rotate90}
          className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-white/15"
          title="Rotate 90°"
        >
          <RotateCw className="h-3.5 w-3.5" /> Rotate
        </button>
      </div>

      {/* Interactive Scan Area Viewport */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-5 select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Scan Frame Window */}
        <div
          ref={frameRef}
          style={{ aspectRatio: String(ASPECT_RATIOS[aspect].ratio) }}
          className={`relative flex items-center justify-center overflow-visible rounded-2xl border-2 border-indigo-400/80 shadow-[0_0_0_9999px_rgba(3,7,18,0.78)] ${
            aspect === 'vertical' || aspect === 'document' ? 'h-[82%] max-h-[440px]' : aspect === 'square' ? 'h-[75%] max-h-[360px]' : 'w-[92%] max-w-lg'
          }`}
        >
          {imgEl && (
            <img
              src={imgEl.src}
              alt="Scan preview"
              draggable={false}
              style={previewStyle}
              className="pointer-events-none max-w-none select-none"
            />
          )}

          {/* Corner Brackets & Alignment Grid */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              <div className="border-b border-r border-white/15" />
              <div className="border-b border-r border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-b border-r border-white/15" />
              <div className="border-b border-r border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>
            <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-2xl border-l-4 border-t-4 border-indigo-400" />
            <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-2xl border-r-4 border-t-4 border-indigo-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-2xl border-b-4 border-l-4 border-indigo-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-2xl border-b-4 border-r-4 border-indigo-400" />
          </div>

          {/* Drag Hint Pill */}
          <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[10px] text-slate-200 backdrop-blur">
            <Move className="h-3 w-3 text-indigo-300" /> Drag to position · Pinch or slide to zoom ({Math.round(zoom * 100)}%)
          </div>
        </div>
      </div>

      {/* Bottom Zoom Controls & Confirm Action */}
      <div className="safe-bottom space-y-3 border-t border-white/10 bg-ink-900/95 px-4 py-3.5">
        {/* Zoom Slider + Quick Presets */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - 0.2))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 active:scale-95"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <input
            type="range"
            min="0.5"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(clampZoom( parseFloat(e.target.value) ))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-white/15 accent-indigo-500"
          />

          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + 0.2))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 active:scale-95"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Zoom Preset Pills */}
        <div className="flex items-center justify-center gap-1.5">
          {[0.75, 1, 1.25, 1.5, 2, 3].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setZoom(preset)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                Math.abs(zoom - preset) < 0.08 ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              // Fit width/cover preset
              setZoom(1.35);
              setPan({ x: 0, y: 0 });
            }}
            className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-indigo-300 hover:bg-white/10"
          >
            <Maximize2 className="h-3 w-3" /> Fill Frame
          </button>
        </div>

        <button
          type="button"
          onClick={cropScanArea}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
        >
          <Check className="h-4 w-4" /> Scan Inside Frame Area
        </button>
      </div>
    </div>
  );
}
