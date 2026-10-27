import { Link2, X, UserCheck, Building2 } from 'lucide-react';
import type { ScanRecord } from '../types';
import { initials } from './ui';

export interface SharedLink {
  url: string;
  kind: 'person' | 'company' | 'other';
  title: string;
}

interface Props {
  link: SharedLink;
  records: ScanRecord[];
  onPick: (r: ScanRecord) => void;
  onClose: () => void;
}

/** Shown when a LinkedIn profile (or any link) is shared into CardIntel via the OS share sheet. */
export default function ShareTargetSheet({ link, records, onPick, onClose }: Props) {
  const label = link.kind === 'person' ? 'LinkedIn profile' : link.kind === 'company' ? 'LinkedIn company page' : 'Link';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="safe-bottom max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {link.kind === 'company' ? <Building2 className="h-5 w-5 text-indigo-300" /> : <UserCheck className="h-5 w-5 text-indigo-300" />}
            Attach {label}
          </h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 flex items-center gap-2 break-all rounded-xl bg-white/5 p-3 text-xs text-slate-300">
          <Link2 className="h-4 w-4 shrink-0 text-indigo-300" /> {link.url}
        </div>
        <p className="mb-3 text-sm text-slate-400">
          Choose the contact this belongs to. {link.kind === 'person' && 'It will be marked as a verified identity and the dossier will be re-enriched.'}
        </p>
        {records.length ? (
          <ul className="space-y-2">
            {records.slice(0, 30).map((r) => (
              <li key={r.id}>
                <button onClick={() => onPick(r)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left transition active:bg-white/10">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-semibold">{initials(r.card.fullName || r.card.company)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.card.fullName || r.card.company}</span>
                    <span className="block truncate text-xs text-slate-500">{[r.card.jobTitle, r.card.company].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-slate-400">Scan a business card first, then share their LinkedIn profile here.</p>
        )}
      </div>
    </div>
  );
}
