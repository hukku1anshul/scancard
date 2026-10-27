import type { ReactNode } from 'react';

export function Section({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Chips({ items, tone = 'slate' }: { items?: string[]; tone?: 'slate' | 'indigo' | 'emerald' | 'amber' }) {
  if (!items?.length) return <p className="text-sm text-slate-500">—</p>;
  const tones = {
    slate: 'bg-white/5 text-slate-200 border-white/10',
    indigo: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/20',
    emerald: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    amber: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className={`rounded-full border px-2.5 py-1 text-xs ${tones[tone]}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm ${value ? 'text-slate-100' : 'text-slate-600'}`}>{value || 'Unknown'}</div>
    </div>
  );
}

export function ExtLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`text-indigo-300 hover:text-indigo-200 ${className}`}>
      {children}
    </a>
  );
}

export function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

export function hostOf(url?: string | null) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
