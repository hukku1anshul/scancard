import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';
import type { Card, StepState } from '../types';

interface Props {
  steps: StepState[];
  card: Card | null;
  thumb?: string;
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
}

const ICON = {
  pending: <Circle className="h-5 w-5 text-slate-600" />,
  running: <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />,
  done: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
  error: <XCircle className="h-5 w-5 text-amber-400" />,
  skipped: <MinusCircle className="h-5 w-5 text-slate-500" />,
};

export default function ProgressView({ steps, card, thumb, error, onCancel, onRetry }: Props) {
  const doneCount = steps.filter((s) => ['done', 'error', 'skipped'].includes(s.status)).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      {thumb && (
        <div className="relative mx-auto aspect-[1.75] w-full max-w-md overflow-hidden rounded-2xl border border-white/10">
          <img src={thumb} alt="Scanned card" className="h-full w-full object-cover" />
          {!error && pct < 100 && <span className="animate-scanline absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_4px_rgba(129,140,248,0.6)]" />}
        </div>
      )}

      {card && (
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <div className="text-lg font-semibold">{card.fullName || '—'}</div>
          <div className="text-sm text-slate-400">{[card.jobTitle, card.company].filter(Boolean).join(' · ')}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {card.emails[0] && <span>{card.emails[0]}</span>}
            {card.phones[0] && <span>{card.phones[0].number}</span>}
            {card.domain && <span>{card.domain}</span>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Building intelligence dossier</span>
          <span className="text-slate-400">{pct}%</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="mt-0.5">{ICON[s.status]}</span>
              <div className="min-w-0">
                <div className={`text-sm ${s.status === 'pending' ? 'text-slate-500' : 'text-slate-100'}`}>{s.label}</div>
                {s.detail && <div className="truncate text-xs text-slate-500">{s.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onCancel} className="rounded-xl bg-white/5 py-3 text-sm">Back</button>
            <button onClick={onRetry} className="rounded-xl bg-indigo-500 py-3 text-sm font-medium">Retry</button>
          </div>
        </div>
      ) : (
        <button onClick={onCancel} className="w-full rounded-xl bg-white/5 py-3 text-sm text-slate-300">Cancel</button>
      )}
    </div>
  );
}
