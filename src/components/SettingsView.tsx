import { useState, useEffect } from 'react';
import {
  Check, Trash2, Server, UserCheck, ShieldCheck, BookOpen, Download,
  Activity, Sparkles, Building2, Layers, MapPin, Database,
} from 'lucide-react';
import type { Health, ScanRecord, Settings } from '../types';
import { Section } from './ui';
import { downloadFile, toCSV } from '../lib/export';

interface Props {
  settings: Settings;
  health: Health | null;
  history: ScanRecord[];
  onSave: (s: Settings) => void;
  onOpenGuide: () => void;
  onClearHistory: () => void;
}

type StrKey = 'tenantId' | 'defaultEvent' | 'senderName' | 'senderCompany' | 'senderPhone' | 'senderEmail' | 'senderWebsite' | 'senderLinkedin' | 'senderGstin';

export default function SettingsView({ settings, health, history, onSave, onOpenGuide, onClearHistory }: Props) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  useEffect(() => {
    setS(settings);
  }, [settings]);

  const save = () => {
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingResult(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setPingResult(`✓ Live Gemini AI (${data.model}) connected · ${elapsed}ms roundtrip`);
      } else {
        setPingResult(`✗ Server returned HTTP ${res.status} (${elapsed}ms)`);
      }
    } catch (e) {
      setPingResult(`✗ Connection failed: ${(e as Error).message}`);
    } finally {
      setTestingPing(false);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(history, null, 2);
    downloadFile(`cardintel-database-${s.tenantId || 'default'}-${new Date().toISOString().slice(0, 10)}.json`, jsonStr, 'application/json');
  };

  const handleExportCsv = () => {
    const csvStr = toCSV(history);
    downloadFile(`cardintel-contacts-${s.tenantId || 'default'}-${new Date().toISOString().slice(0, 10)}.csv`, csvStr, 'text/csv');
  };

  const input = (label: string, k: StrKey, placeholder: string, help?: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="text"
        value={s[k] || ''}
        onChange={(e) => setS({ ...s, [k]: e.target.value })}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-400"
      />
      {help && <span className="mt-1 block text-[11px] text-slate-500">{help}</span>}
    </label>
  );

  return (
    <div className="space-y-4 px-4 pb-6 pt-2 max-w-xl mx-auto">
      {/* 1. Quick Persona Playbooks & User Guide Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-600/20 via-indigo-500/10 to-transparent p-3.5 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Persona User Guides & Workflows</h3>
            <p className="text-[11px] text-slate-300">Sales BD, Vendor KYC, CXO & Admin playbooks</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenGuide}
          className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow active:scale-95 hover:bg-indigo-500"
        >
          Open Guide
        </button>
      </div>

      {/* 2. Admin & Server AI Configuration */}
      <Section title="Admin & Server AI Configuration" icon={<Server className="h-4 w-4 text-indigo-300" />}>
        {health ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Status label={health.gemini ? `Live AI (${health.model})` : 'Demo mode'} ok={health.gemini} />
              <Status label={health.grounding ? 'Grounding on' : 'Grounding off'} ok={health.grounding} />
              <Status label={`Search: ${health.search}`} ok />
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 text-[11px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">AI Server Latency & Test</span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingPing}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600/30 border border-indigo-400/40 px-2 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-600/40 active:scale-95 disabled:opacity-50"
                >
                  <Activity className="h-3 w-3" />
                  {testingPing ? 'Testing…' : 'Test AI Connection'}
                </button>
              </div>
              {pingResult && (
                <div className="rounded-lg bg-white/5 p-2 font-mono text-[11px] text-emerald-300">
                  {pingResult}
                </div>
              )}
              <div className="text-slate-400 pt-1 space-y-0.5 border-t border-white/5">
                <div><b className="text-slate-300">Active Registries:</b> {health.registries.join(', ')}</div>
                <div><b className="text-slate-300">Enrichment Providers:</b> {health.providers.join(', ') || 'Standard public intelligence'}</div>
                <div><b className="text-slate-300">Connected CRM:</b> {health.crm.join(', ') || 'None configured on server'}</div>
              </div>
            </div>

            {/* Workspace / Tenant ID Isolation for Admin */}
            {input(
              'Multi-Tenant Workspace ID',
              'tenantId',
              'default',
              'Isolates scan history and contacts by department, event team, or branch.',
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Checking server configuration…</p>
        )}
      </Section>

      {/* 3. Event & Scanning Preferences */}
      <Section title="Event & Rapid Scanning Defaults" icon={<UserCheck className="h-4 w-4 text-indigo-300" />}>
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
        </div>
      </Section>

      {/* 4. Digital Business Card & Sender Sign-Off */}
      <Section title="My Digital Card & Outreach Sign-Off" icon={<Building2 className="h-4 w-4 text-indigo-300" />}>
        <div className="space-y-3">
          {input('Your name', 'senderName', 'Anshul Hukku')}
          {input('Your role & company', 'senderCompany', 'Director, Acme India Pvt. Ltd.')}
          {input('Your mobile / WhatsApp (+91…)', 'senderPhone', '+91 98200 00000')}
          {input('Your work email', 'senderEmail', 'you@company.in')}
          {input('Your company website', 'senderWebsite', 'https://www.company.in')}
          {input('Your LinkedIn profile URL', 'senderLinkedin', 'https://www.linkedin.com/in/yourprofile')}
          {input('Your company GSTIN (optional)', 'senderGstin', '27AABCU9603R1ZM')}
        </div>
      </Section>

      {/* Save Button */}
      <button
        onClick={save}
        className="sticky bottom-20 z-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition hover:bg-indigo-500"
      >
        {saved ? <><Check className="h-4 w-4" /> Preferences Saved</> : <>Save All Preferences</>}
      </button>

      {/* 5. Database Backups & Export */}
      <Section title="Database Backups & Export" icon={<Database className="h-4 w-4 text-emerald-400" />}>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Export all {history.length} stored records and 360° dossiers for this tenant ({s.tenantId || 'default'}).
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 active:scale-95"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" /> Export CSV (Excel)
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 active:scale-95"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" /> Backup JSON
            </button>
          </div>
        </div>
      </Section>

      {/* 6. Device Reset */}
      <Section title="Local Device History" icon={<Trash2 className="h-4 w-4 text-rose-300" />}>
        <button
          onClick={() => confirm('Delete all scanned cards from this device?') && onClearHistory()}
          className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 py-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 active:scale-95"
        >
          Clear scan history on this device ({history.length} records)
        </button>
      </Section>

      <p className="text-center text-[10px] text-slate-600">
        CardIntel uses server-configured AI and public/licensed corporate registries. Respect privacy laws (DPDP Act India / GDPR / CCPA) when storing contact data.
      </p>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-200">{label}</div>
        <div className="text-[10px] text-slate-400">{desc}</div>
      </div>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative mt-0.5 h-5 w-10 shrink-0 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Status({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="rounded-xl px-2 py-2 bg-white/5 border border-white/[0.05]">
      <div className={ok ? 'text-emerald-300' : 'text-amber-300'}>
        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {label}
      </div>
    </div>
  );
}
