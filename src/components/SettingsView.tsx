import { useState } from 'react';
import { KeyRound, Check, Trash2, Server, Eye, EyeOff, Landmark, Gem, Send, Sparkles, ExternalLink, UserCheck } from 'lucide-react';
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
  const [show, setShow] = useState(false);

  const save = () => {
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const input = (label: string, k: StrKey, placeholder: string, help?: React.ReactNode, secret = true) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type={secret && !show ? 'password' : 'text'}
        value={s[k]}
        onChange={(e) => setS({ ...s, [k]: secret ? e.target.value.trim() : e.target.value })}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
      />
      {help && <span className="mt-1 block text-[11px] text-slate-500">{help}</span>}
    </label>
  );

  const link = (href: string, text: string) => (
    <a className="inline-flex items-center gap-0.5 text-indigo-300" href={href} target="_blank" rel="noreferrer">{text}<ExternalLink className="h-2.5 w-2.5" /></a>
  );

  const eye = (
    <button onClick={() => setShow(!show)} className="text-slate-400" aria-label="Toggle visibility">
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <Section title="Server status" icon={<Server className="h-4 w-4 text-indigo-300" />}>
        {health ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Status label={health.gemini ? 'Live AI' : 'Demo mode'} ok={health.gemini} />
              <Status label={health.grounding ? 'Grounding on' : 'Grounding off'} ok={health.grounding} />
              <Status label={`Search: ${health.search}`} ok />
            </div>
            <div className="text-[11px] text-slate-400">
              <div><b className="text-slate-300">Registries:</b> India MCA/GST, {health.registries.join(', ')}</div>
              <div><b className="text-slate-300">Data providers:</b> {health.providers.join(', ') || 'none'}</div>
              <div><b className="text-slate-300">CRM:</b> {health.crm.join(', ') || 'none'}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-rose-300">API server unreachable. Start it with <code>npm run dev</code>.</p>
        )}
      </Section>

      <Section title="My Digital Business Card & Event Defaults" icon={<UserCheck className="h-4 w-4 text-indigo-300" />}>
        <div className="space-y-3">
          {input('Your name (for My QR Card & 1-tap WhatsApp/Email sign-off)', 'senderName', 'Anshul Hukku', undefined, false)}
          {input('Your role & company', 'senderCompany', 'Director, Acme India Pvt. Ltd.', undefined, false)}
          {input('Your mobile / WhatsApp number (+91…)', 'senderPhone', '+91 98200 00000', undefined, false)}
          {input('Your work email', 'senderEmail', 'you@company.in', undefined, false)}
          {input('Your company website', 'senderWebsite', 'https://www.company.in', undefined, false)}
          {input('Your LinkedIn URL', 'senderLinkedin', 'https://www.linkedin.com/in/yourprofile', undefined, false)}
          {input('Your company GSTIN (optional, shown on My QR Card)', 'senderGstin', '27AABCU9603R1ZM', undefined, false)}
          {input('Active event / conference tag', 'defaultEvent', 'e.g. Bharat Mobility Expo 2026', 'Automatically tagged on new scans until changed.', false)}
          <Toggle
            label="Auto-capture GPS location on scan"
            desc="Tag each scanned business card with your GPS coordinates and city/venue name."
            value={s.autoGeo}
            onChange={(autoGeo) => setS({ ...s, autoGeo })}
          />
        </div>
      </Section>

      <Section title="AI & search" icon={<Sparkles className="h-4 w-4 text-indigo-300" />} action={eye}>
        <div className="space-y-3">
          {input('Gemini API key (required for live scans)', 'geminiKey', 'AIza…', <>Free key at {link('https://aistudio.google.com/apikey', 'aistudio.google.com')}. Leave blank if set in server .env.</>)}
          {input('Gemini model', 'geminiModel', 'gemini-2.5-flash', 'gemini-2.5-flash (fast) or gemini-2.5-pro (deeper analysis)', false)}
          <Toggle
            label="Google Search grounding + gap-filling"
            desc="Gemini runs live Google searches with citations and fills missing facts. Uses your Gemini key (grounding quotas/pricing apply)."
            value={s.grounding}
            onChange={(grounding) => setS({ ...s, grounding })}
          />
          {input('Tavily API key (optional)', 'tavilyKey', 'tvly-…', <>Better web/LinkedIn snippet search. {link('https://tavily.com', 'tavily.com')}</>)}
          {input('SerpApi key (optional)', 'serpapiKey', '', 'Google results via serpapi.com. Used if no Tavily key. Otherwise free DuckDuckGo/Bing.')}
        </div>
      </Section>

      <Section title="Company registries" icon={<Landmark className="h-4 w-4 text-indigo-300" />}>
        <p className="mb-3 text-[11px] text-slate-500">India MCA CIN/GSTIN decoder, GLEIF (legal entities + parent companies), Wikidata and SEC EDGAR are free and always on.</p>
        <div className="space-y-3">
          {input('UK Companies House API key', 'companiesHouseKey', '', <>Free. {link('https://developer.company-information.service.gov.uk/', 'Register here')}</>)}
          {input('OpenCorporates API token', 'openCorporatesToken', '', <>140+ jurisdictions. {link('https://opencorporates.com/api_accounts/new', 'Get a token')}</>)}
        </div>
      </Section>

      <Section title="Premium data providers" icon={<Gem className="h-4 w-4 text-indigo-300" />}>
        <div className="space-y-3">
          {input('D&B Direct+ consumer key', 'dnbKey', '', 'Real D-U-N-S match, firmographics & corporate family tree (paid D&B contract).')}
          {input('D&B Direct+ consumer secret', 'dnbSecret', '')}
          {input('Apollo.io API key', 'apolloKey', '', 'Company + person enrichment (title, seniority, LinkedIn, career history).')}
          {input('People Data Labs API key', 'pdlKey', '', 'Company + person enrichment from licensed professional data.')}
        </div>
      </Section>

      <Section title="CRM sync" icon={<Send className="h-4 w-4 text-indigo-300" />}>
        <div className="space-y-3">
          {input('HubSpot private-app token', 'hubspotToken', 'pat-…', 'Scopes: crm.objects.contacts.write, crm.objects.companies.write (+ read).')}
          {input('Salesforce instance URL', 'sfInstanceUrl', 'https://yourorg.my.salesforce.com', undefined, false)}
          {input('Salesforce access token', 'sfAccessToken', '', 'OAuth access token (e.g. from a Connected App / `sf org display`). Tokens expire.')}
        </div>
      </Section>

      <button onClick={save} className="sticky bottom-24 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-medium shadow-lg shadow-indigo-500/20">
        {saved ? <><Check className="h-4 w-4" /> Saved</> : <><KeyRound className="h-4 w-4" /> Save settings</>}
      </button>
      <p className="text-[11px] text-slate-500">Keys are stored only on this device and sent to your own CardIntel server with each request. Server-side .env values are used when a field is blank.</p>

      <Section title="Data" icon={<Trash2 className="h-4 w-4 text-rose-300" />}>
        <button onClick={() => confirm('Delete all scanned cards from this device?') && onClearHistory()} className="w-full rounded-xl bg-rose-500/10 py-3 text-sm text-rose-300">
          Clear scan history
        </button>
      </Section>

      <p className="text-center text-[11px] text-slate-600">
        CardIntel uses public and licensed data sources only. Respect privacy laws (DPDP Act India / GDPR / CCPA) and provider terms when storing or using contact data.
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
