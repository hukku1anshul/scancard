import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { Card } from '../types';

interface Props {
  card: Card;
  onClose: () => void;
  onSubmit: (card: Card) => void;
}

const splitList = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export default function EditCardSheet({ card, onClose, onSubmit }: Props) {
  const [f, setF] = useState({
    fullName: card.fullName || '',
    jobTitle: card.jobTitle || '',
    company: card.company || '',
    website: card.website || '',
    emails: card.emails.join(', '),
    phones: card.phones.map((p) => p.number).join(', '),
    address: card.address || '',
    linkedin: card.socials?.linkedin || '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () => {
    const parts = f.fullName.trim().split(/\s+/);
    const phones = splitList(f.phones).map((number, i) => ({ number, type: card.phones[i]?.type || 'other' }));
    const linkedin = f.linkedin.trim() || null;
    const linkedinChanged = linkedin !== (card.socials?.linkedin || null);
    onSubmit({
      ...card,
      linkedinSource: !linkedin ? null : linkedinChanged ? 'user' : card.linkedinSource ?? null,
      fullName: f.fullName.trim() || null,
      firstName: parts[0] || null,
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
      jobTitle: f.jobTitle.trim() || null,
      company: f.company.trim() || null,
      website: f.website.trim() || null,
      domain: null,
      emails: splitList(f.emails),
      phones,
      address: f.address.trim() || null,
      socials: { ...card.socials, linkedin },
    });
  };

  const field = (label: string, k: keyof typeof f, type = 'text') => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {k === 'address' ? (
        <textarea value={f[k]} onChange={set(k)} rows={2} className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
      ) : (
        <input type={type} value={f[k]} onChange={set(k)} className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="safe-bottom max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit card details</h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {field('Full name', 'fullName')}
          {field('Job title', 'jobTitle')}
          {field('Company', 'company')}
          {field('Website', 'website', 'url')}
          {field('Emails (comma separated)', 'emails')}
          {field('Phones (comma separated)', 'phones')}
          {field('Address', 'address')}
          {field('LinkedIn URL', 'linkedin', 'url')}
        </div>
        <button onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold">
          <Sparkles className="h-5 w-5" /> Save & re-enrich
        </button>
      </div>
    </div>
  );
}
