import { useState } from 'react';
import { QrCode, X, Share2, MessageSquare, Pencil, Check, UserPlus, Building2, Phone, Mail, Globe } from 'lucide-react';
import type { Settings } from '../types';
import { downloadFile } from '../lib/export';

interface Props {
  settings: Settings;
  onSaveSettings: (s: Settings) => void;
  onClose: () => void;
}

export default function MyDigitalCardModal({ settings, onSaveSettings, onClose }: Props) {
  const [mode, setMode] = useState<'vcard' | 'whatsapp'>('vcard');
  const [editing, setEditing] = useState(!settings.senderName && !settings.senderPhone && !settings.senderEmail);
  const [s, setS] = useState<Settings>(settings);

  const name = s.senderName || 'Your Name';
  const company = s.senderCompany || 'Your Company / Role';
  const phone = s.senderPhone || '';
  const email = s.senderEmail || '';
  const website = s.senderWebsite || '';
  const linkedin = s.senderLinkedin || '';
  const gstin = s.senderGstin || '';

  const vcardText = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${company}`,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    email ? `EMAIL;TYPE=INTERNET,WORK:${email}` : null,
    website ? `URL:${website}` : null,
    linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${linkedin}` : null,
    gstin ? `NOTE:GSTIN: ${gstin}` : null,
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');

  const cleanDigits = phone.replace(/[^\d]/g, '');
  const waUrl = cleanDigits
    ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hi ${name}, great meeting you${s.defaultEvent ? ` at ${s.defaultEvent}` : ''}! Here are my details.`)}`
    : vcardText;

  const qrData = mode === 'whatsapp' && cleanDigits ? waUrl : vcardText;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(qrData)}`;

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(s);
    setEditing(false);
  };

  const shareVcf = async () => {
    const filename = `${name.replace(/\W+/g, '_')}.vcf`;
    const file = new File([vcardText], filename, { type: 'text/vcard' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${name} — Business Card` });
        return;
      } catch {
        /* fallback */
      }
    }
    downloadFile(filename, vcardText, 'text/vcard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">My Digital Business Card</h2>
              <p className="text-[11px] text-slate-400">Let people at events scan your QR to save your contact</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditing(!editing)}
              className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10"
              title="Edit my card"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={saveProfile} className="space-y-2.5 pt-1">
            <div className="text-xs font-medium text-indigo-300">Setup your Digital Business Card</div>
            <input
              value={s.senderName}
              onChange={(e) => setS({ ...s, senderName: e.target.value })}
              placeholder="Your Full Name *"
              required
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={s.senderCompany}
              onChange={(e) => setS({ ...s, senderCompany: e.target.value })}
              placeholder="Job Title & Company (e.g. Director, Acme India Pvt Ltd)"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={s.senderPhone}
              onChange={(e) => setS({ ...s, senderPhone: e.target.value })}
              placeholder="Mobile / WhatsApp (with +91 or country code)"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              type="email"
              value={s.senderEmail}
              onChange={(e) => setS({ ...s, senderEmail: e.target.value })}
              placeholder="Work Email"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={s.senderWebsite}
              onChange={(e) => setS({ ...s, senderWebsite: e.target.value })}
              placeholder="Company Website (https://...)"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={s.senderLinkedin}
              onChange={(e) => setS({ ...s, senderLinkedin: e.target.value })}
              placeholder="LinkedIn URL (optional)"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={s.senderGstin}
              onChange={(e) => setS({ ...s, senderGstin: e.target.value.toUpperCase() })}
              placeholder="Company GSTIN (optional, for Indian B2B)"
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-white/5 px-4 py-2 text-xs text-slate-300">
                Cancel
              </button>
              <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white">
                <Check className="h-3.5 w-3.5" /> Save My Card
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Switch between vCard QR and WhatsApp Connect QR */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink-900 p-1">
              <button
                onClick={() => setMode('vcard')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
                  mode === 'vcard' ? 'bg-indigo-500 text-white' : 'text-slate-400'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" /> Contact vCard QR
              </button>
              <button
                onClick={() => setMode('whatsapp')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
                  mode === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Chat QR
              </button>
            </div>

            {/* Digital Business Card Preview + Scannable QR */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/25 via-ink-900 to-fuchsia-600/20 p-4 text-center">
              <div className="mx-auto mb-3 flex h-56 w-56 items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-lg">
                <img src={qrImgUrl} alt="My Digital Business Card QR" className="h-full w-full object-contain" />
              </div>

              <div className="text-lg font-bold text-white">{name}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-indigo-200">
                <Building2 className="h-3.5 w-3.5" /> {company}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-300">
                {phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-emerald-400" /> {phone}
                  </span>
                )}
                {email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3 text-indigo-300" /> {email}
                  </span>
                )}
                {website && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3 text-sky-300" /> {website.replace(/^https?:\/\//, '')}
                  </span>
                )}
              </div>
              {gstin && <div className="mt-1.5 font-mono text-[11px] text-amber-300">GSTIN: {gstin}</div>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={shareVcf}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500 py-2.5 text-xs font-semibold text-white"
              >
                <Share2 className="h-4 w-4" /> Share .vcf Card
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-xs font-medium text-slate-200"
              >
                <Pencil className="h-4 w-4" /> Edit My Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
