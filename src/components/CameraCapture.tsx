import { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

/** Full-screen live camera with a business-card alignment guide. */
export default function CameraCapture({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera requires HTTPS (or localhost). Use "Take photo" instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        v.play().then(() => setReady(true)).catch(() => setReady(true));
      })
      .catch((e) => setError(`Camera unavailable: ${e.message}`));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="safe-top flex items-center justify-between p-4">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2.5" aria-label="Close camera">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm text-slate-300">Align the card inside the frame</span>
        <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="rounded-full bg-white/10 p-2.5" aria-label="Switch camera">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-rose-300">{error}</div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[1.75] w-[88%] max-w-xl rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => (
                <span key={c} className={`absolute h-8 w-8 border-indigo-400 ${c}`} />
              ))}
              {ready && <span className="animate-scanline absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />}
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom flex items-center justify-center p-6">
        <button
          onClick={capture}
          disabled={!ready}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-indigo-500 transition active:scale-95 disabled:opacity-40"
          aria-label="Capture"
        >
          <Camera className="h-8 w-8" />
        </button>
      </div>
    </div>
  );
}
