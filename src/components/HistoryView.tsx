import { useMemo, useState } from 'react';
import { Search, FileDown, Trash2, ScanLine, Loader2, AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import type { ScanRecord } from '../types';
import { initials } from './ui';
import { downloadFile, toCSV } from '../lib/export';

interface Props {
  history: ScanRecord[];
  canRetry: (id: string) => boolean;
  onRetry: (id: string) => void;
  onOpen: (r: ScanRecord) => void;
  onDelete: (id: string) => void;
  onScan: () => void;
}

export default function HistoryView({ history, canRetry, onRetry, onOpen, onDelete, onScan }: Props) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return history;
    return history.filter((r) =>
      [r.card.fullName, r.card.company, r.card.jobTitle, r.dossier?.company.industry, ...r.card.emails].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [history, q]);

  if (!history.length) {
    return (
      <div className="flex flex-col items-center px-8 pt-20 text-center">
        <ScanLine className="h-12 w-12 text-slate-600" />
        <p className="mt-4 text-slate-400">No scanned cards yet.</p>
        <button onClick={onScan} className="mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium">Scan your first card</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-6 pt-2">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-ink-800 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, industry…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </div>
        <button
          onClick={() => downloadFile(`cardintel-contacts-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered), 'text/csv')}
          className="flex items-center gap-1 rounded-xl bg-white/5 px-3 text-sm text-slate-300"
          title="Export CSV"
        >
          <FileDown className="h-4 w-4" /> CSV
        </button>
      </div>

      <ul className="space-y-2">
        {filtered.map((r) => {
          const status = r.status || 'done';
          const openable = status === 'done' || !!r.dossier;
          return (
            <li key={r.id} className={`flex items-center gap-3 rounded-2xl border bg-ink-800/70 p-3 ${status === 'error' ? 'border-rose-400/20' : status === 'done' ? 'border-white/5' : 'border-indigo-400/20'}`}>
              <button onClick={() => openable && onOpen(r)} disabled={!openable} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="relative h-12 w-20 shrink-0">
                  {r.thumb ? (
                    <img src={r.thumb} alt="" className="h-12 w-20 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-indigo-500/20 font-semibold">{initials(r.card.fullName)}</div>
                  )}
                  {(status === 'queued' || status === 'processing') && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                      {status === 'queued' ? <Clock className="h-5 w-5 text-slate-200" /> : <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.card.fullName || r.card.company || (status === 'done' ? 'Unknown' : 'New card')}</div>
                  <div className="truncate text-xs text-slate-400">{[r.card.jobTitle, r.card.company].filter(Boolean).join(' · ') || ' '}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {status === 'queued' && 'Queued…'}
                    {status === 'processing' && <span className="text-indigo-300">{r.progress || 'Processing…'}</span>}
                    {status === 'error' && <span className="flex items-center gap-1 text-rose-300"><AlertTriangle className="h-3 w-3" /> {r.error}</span>}
                    {status === 'done' && <>{r.dossier?.company.industry || 'Not enriched'} · {new Date(r.createdAt).toLocaleDateString()}{r.demo ? ' · demo' : ''}</>}
                  </div>
                </div>
              </button>
              {status === 'error' && canRetry(r.id) && (
                <button onClick={() => onRetry(r.id)} className="p-2 text-indigo-300" aria-label="Retry">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => confirm('Delete this scan?') && onDelete(r.id)} className="p-2 text-slate-500" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
