import { useState, useEffect } from 'react';
import { Check, Trash2, Server, UserCheck, ShieldCheck } from 'lucide-react';
import type { Health, Settings } from '../types';
import { Section } from './ui';

interface Props {
  settings: Settings;
  health: Health | null;
  onSave: (s: Settings) => void;
  onClearHistory: () => void;
}

type StrKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];

export default function SettingsView({ settings, health, onSave, onClearHistory }: Props) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setS(settings);
  }, [settings]);

  const save = () => {
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const input = (label: string, k: StrKey, placeholder: string, help?: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="text"
        value={s[k]}
        onChange={(e) => setS({ ...s, [k]: e.target.value })}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
      />
      {help && <span className="mt-1 block text-[11px] text-slate-500">{help}</span>}
    </label>
  );

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <Section title="Render Server & AI Configuration" icon={<Server className="h-4 w-4 text-indigo-300" />}>
        {health ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Status label={health.gemini ? `Live AI (${health.model})` : 'Demo mode'} ok={health.gemini} />
              <Status label={health.grounding ? 'Grounding on' : 'Grounding off'} ok={health.grounding} />
              <Status label={`Search: ${health.search}`} ok />
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-indigo-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Centrally Managed on Server
              </div>
              <p className="text-slate-400">
                Gemini AI keys, search providers, corporate registries, and CRM integrations are configured centrally on the Render server for all users.
              </p>
              <div className="pt-1 text-slate-400">
                <div><b className="text-slate-300">Active Registries:</b> {health.registries.join(', ')}</div>
                <div><b className="text-slate-300">Enrichment Providers:</b> {health.providers.join(', ') || 'Standard public intelligence'}</div>
                <div><b className="text-slate-300">Connected CRM:</b> {health.crm.join(', ') || 'None configured on server'}</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Checking server configuration…</p>
        )}
      </Section>

      <Section title="My Digital Business Card & Event Defaults" icon={<UserCheck className="h-4 w-4 text-indigo-300" />}>
        <div className="space-y-3">
          {input('Active event / conference tag', 'defaultEvent', 'e.g. Bharat Mobility Expo 2026', 'Automatically tagged on new scans until changed.')}
          <Toggle
            label="Rapid Event Queue Mode"
            desc="Queue scanned cards in the background so you can scan multiple cards back-to-back at busy stalls."
            value={s.eventMode}
            onChange={(eventMode) => setS({ ...s, eventMode })}
          />
          <Toggle
            label="Auto-capture GPS location on scan"
            desc="Tag each scanned business card with your GPS coordinates and city/venue name."
            value={s.autoGeo}
            onChange={(autoGeo) => setS({ ...s, autoGeo })}
          />
          <div className="border-t border-white/5 pt-2">
            <div className="mb-2 text-xs font-medium text-indigo-300">My QR Card & Follow-Up Sign-Off</div>
            <div className="space-y-3">
              {input('Your name', 'senderName', 'Anshul Hukku')}
              {input('Your role & company', 'senderCompany', 'Director, Acme India Pvt. Ltd.')}
              {input('Your mobile / WhatsApp number (+91…)', 'senderPhone', '+91 98200 00000')}
              {input('Your work email', 'senderEmail', 'you@company.in')}
              {input('Your company website', 'senderWebsite', 'https://www.company.in')}
              {input('Your LinkedIn URL', 'senderLinkedin', 'https://www.linkedin.com/in/yourprofile')}
              {input('Your company GSTIN (optional)', 'senderGstin', '27AABCU9603R1ZM')}
            </div>
          </div>
        </div>
      </Section>

      <button onClick={save} className="sticky bottom-24 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-medium shadow-lg shadow-indigo-500/20">
        {saved ? <><Check className="h-4 w-4" /> Preferences Saved</> : <>Save Preferences</>}
      </button>

      <Section title="Local Device History" icon={<Trash2 className="h-4 w-4 text-rose-300" />}>
        <button onClick={() => confirm('Delete all scanned cards from this device?') && onClearHistory()} className="w-full rounded-xl bg-rose-500/10 py-3 text-sm text-rose-300">
          Clear scan history on this device
        </button>
      </Section>

      <p className="text-center text-[11px] text-slate-600">
        CardIntel uses server-configured AI and public/licensed corporate registries. Respect privacy laws (DPDP Act India / GDPR / CCPA) when storing or using contact data.
      </p>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        <div className="text-[11px] text-slate-500">{desc}</div>
      </div>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-indigo-500' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Status({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="rounded-xl px-2 py-2 bg-white/5">
      <div className={ok ? 'text-emerald-300' : 'text-amber-300'}>
        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {label}
      </div>
    </div>
  );
}
