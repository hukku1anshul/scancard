import { useState } from 'react';
import {
  ArrowLeft, Building2, Copy, Download, ExternalLink, Globe, Mail, MapPin, MessageSquare, Newspaper, Package, Pencil, Phone,
  ShieldCheck, Sparkles, Target, Trash2, TrendingUp, UserPlus, Users, Link2, Briefcase, AlertTriangle, Check, FileDown,
  RefreshCw, Send, Network, BadgeCheck, Loader2, X, History as HistoryIcon, Database,
} from 'lucide-react';
import type { CrmResult, IdentityLevel, ScanRecord, Validation } from '../types';
import { Chips, ExtLink, Fact, Section, hostOf, initials } from './ui';
import { downloadFile, shareOrDownloadVCard, toMarkdown } from '../lib/export';

type Tab = 'overview' | 'contact' | 'offerings' | 'customers' | 'social' | 'pitch' | 'sources';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contact', label: 'Contact' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'customers', label: 'Customers' },
  { id: 'social', label: 'Social & News' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'sources', label: 'Sources' },
];

interface Props {
  record: ScanRecord;
  crmTargets: string[];
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onPushCrm: (provider: 'hubspot' | 'salesforce') => Promise<CrmResult>;
  onDelete: () => void;
}

const LEVEL_STYLE: Record<IdentityLevel, string> = {
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  likely: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  possible: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  uncertain: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  unverified: 'bg-white/5 text-slate-400 border-white/10',
};

export function IdentityBadge({ level, title }: { level: IdentityLevel; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${LEVEL_STYLE[level]}`}>
      {level === 'verified' && <BadgeCheck className="h-3 w-3" />}
      {level}
    </span>
  );
}

function ValidityDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    valid: ['text-emerald-400', 'Valid'],
    possible: ['text-amber-400', 'Possible'],
    'no-mx': ['text-rose-400', 'No mail server'],
    invalid: ['text-rose-400', 'Invalid'],
    unknown: ['text-slate-500', 'Unverified'],
  };
  const [cls, label] = map[status] || map.unknown;
  return <span className={`ml-1.5 text-[10px] font-medium ${cls}`}>● {label}</span>;
}

export default function DossierView({ record, crmTargets, onBack, onEdit, onRefresh, onPushCrm, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState<string | null>(null);
  const [crmOpen, setCrmOpen] = useState(false);
  const { card, dossier: d } = record;
  const v: Validation | null | undefined = d?.validation;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const companyName = d?.company.name || card.company || card.domain || 'Unknown company';
  const emailV = (e: string) => v?.emails.find((x) => x.value === e);
  const phoneV = (p: string) => v?.phones.find((x) => x.value === p);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-2">
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {record.demo && (
          <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Demo data (fictional). Add a Gemini key in Settings for live results.</div>
        )}

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-ink-800 to-fuchsia-600/20 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-bold">
              {initials(card.fullName || companyName)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold">{card.fullName || companyName}</h1>
              <p className="text-sm text-slate-300">{card.jobTitle || d?.person.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-indigo-200">
                <Building2 className="h-3.5 w-3.5" /> {companyName}
                {d?.identity?.company && <IdentityBadge level={d.identity.company.level} title={d.identity.company.reasons.join('\n')} />}
              </p>
            </div>
            {d?.company.logo && <img src={d.company.logo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" />}
          </div>
          {d?.company.industry && <div className="mt-3"><Chips items={[d.company.industry, d.company.businessModel, d.company.headquarters].filter(Boolean) as string[]} tone="indigo" /></div>}

          <div className="mt-4 grid grid-cols-4 gap-2">
            <ActionBtn icon={<UserPlus className="h-5 w-5" />} label="Save" onClick={() => shareOrDownloadVCard(card, d)} primary />
            <ActionBtn icon={<Phone className="h-5 w-5" />} label="Call" href={card.phones[0] ? `tel:${(phoneV(card.phones[0].number)?.e164 || card.phones[0].number).replace(/[^\d+]/g, '')}` : undefined} />
            <ActionBtn icon={<Mail className="h-5 w-5" />} label="Email" href={card.emails[0] ? `mailto:${card.emails[0]}` : undefined} />
            <ActionBtn icon={<Send className="h-5 w-5" />} label="CRM" onClick={() => setCrmOpen(true)} />
          </div>
          {d?.cachedAt && (
            <p className="mt-3 text-[11px] text-slate-400">
              Company data cached {new Date(d.cachedAt).toLocaleString()} ·{' '}
              <button onClick={onRefresh} className="text-indigo-300 underline">refresh</button>
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar sticky top-0 z-10 mt-4 flex gap-1 overflow-x-auto bg-ink-950/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${tab === t.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-2">
        {!d && <p className="text-sm text-slate-400">No enrichment data yet. Tap Edit & re-enrich.</p>}

        {d && tab === 'overview' && (
          <>
            <Section title="What they do" icon={<Sparkles className="h-4 w-4 text-indigo-300" />}>
              {d.company.tagline && <p className="mb-2 text-sm italic text-indigo-200">“{d.company.tagline}”</p>}
              <p className="text-sm leading-relaxed text-slate-200">{d.company.summary || 'No summary available.'}</p>
            </Section>
            <Section title="Firmographics" icon={<Building2 className="h-4 w-4 text-indigo-300" />}>
              <div className="grid grid-cols-2 gap-2">
                <Fact label="Legal name" value={d.company.legalName} />
                <Fact label="Industry" value={[d.company.industry, d.company.subIndustry].filter(Boolean).join(' · ')} />
                <Fact label="Founded" value={d.company.founded} />
                <Fact label="Headquarters" value={d.company.headquarters} />
                <Fact label="Employees" value={d.company.employeeRange} />
                <Fact label="Revenue" value={d.company.revenueRange} />
                <Fact label="Ownership" value={d.company.ownership} />
                <Fact label="Parent" value={d.company.parentCompany} />
                <Fact label="D-U-N-S" value={d.company.dunsNumber} />
                <Fact label="LEI" value={d.company.lei} />
              </div>
              {!!d.company.locations?.length && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Locations</div>
                  <Chips items={d.company.locations} />
                </div>
              )}
              {d.company.registryInfo && <p className="mt-3 text-sm text-slate-300">{d.company.registryInfo}</p>}
            </Section>

            {d.familyTree && (
              <Section title="Corporate family tree" icon={<Network className="h-4 w-4 text-indigo-300" />}>
                <div className="space-y-1.5 text-sm">
                  {d.familyTree.ultimateParent && <TreeNode depth={0} label="Ultimate parent" node={d.familyTree.ultimateParent} />}
                  {d.familyTree.parent && d.familyTree.parent.name !== d.familyTree.ultimateParent?.name && (
                    <TreeNode depth={d.familyTree.ultimateParent ? 1 : 0} label="Direct parent" node={d.familyTree.parent} />
                  )}
                  <div
                    className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 font-medium"
                    style={{ marginLeft: 16 * ((d.familyTree.ultimateParent ? 1 : 0) + (d.familyTree.parent && d.familyTree.parent.name !== d.familyTree.ultimateParent?.name ? 1 : 0)) }}
                  >
                    {d.company.legalName || companyName} <span className="text-xs font-normal text-indigo-300">(this company)</span>
                  </div>
                  {d.familyTree.subsidiaries.length > 0 && (
                    <div className="pt-1">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Subsidiaries</div>
                      <Chips items={d.familyTree.subsidiaries} />
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Sources: {d.familyTree.sources.join(', ')}
                  {d.familyTree.familyTreeMembers ? ` · ${d.familyTree.familyTreeMembers} family members (D&B)` : ''}
                </p>
              </Section>
            )}

            <Section title="Verified registry records" icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}>
              {d.registryRecords?.length ? (
                <div className="space-y-2">
                  {d.registryRecords.map((r, i) => (
                    <details key={i} className="group rounded-xl bg-white/[0.03] p-3" open={i === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Database className="h-4 w-4 shrink-0 text-emerald-300" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{r.source}</span>
                          <span className="truncate text-sm text-slate-300">{r.title}</span>
                        </span>
                        {r.url && <ExtLink href={r.url} className="shrink-0"><ExternalLink className="h-3.5 w-3.5" /></ExtLink>}
                      </summary>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {r.fields.map(([k, val]) => (
                          <div key={k} className="contents">
                            <dt className="text-slate-500">{k}</dt>
                            <dd className="break-words text-slate-200">{/^https?:/.test(val) ? <ExtLink href={val}>{hostOf(val)}</ExtLink> : val}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No official registry match. Small/private companies often aren't in GLEIF/Wikidata — add a D&B, Companies House or OpenCorporates key in Settings for broader coverage.</p>
              )}
            </Section>

            {!!d.signals.length && (
              <Section title="Signals" icon={<TrendingUp className="h-4 w-4 text-indigo-300" />}>
                <ul className="space-y-1.5 text-sm text-slate-200">
                  {d.signals.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-400">•</span>{s}</li>)}
                </ul>
              </Section>
            )}
          </>
        )}

        {tab === 'contact' && (
          <>
            <Section
              title="Card details"
              icon={<Briefcase className="h-4 w-4 text-indigo-300" />}
              action={<button onClick={onEdit} className="flex items-center gap-1 text-xs text-indigo-300"><Pencil className="h-3.5 w-3.5" /> Edit & re-enrich</button>}
            >
              <div className="space-y-2.5 text-sm">
                {card.emails.map((e) => {
                  const ev = emailV(e);
                  return (
                    <Row key={e} icon={<Mail className="h-4 w-4" />} href={`mailto:${e}`}>
                      {e}
                      {ev && <ValidityDot status={ev.status} />}
                      {ev?.freeMail && <span className="ml-1.5 text-[10px] text-slate-500">personal email</span>}
                    </Row>
                  );
                })}
                {card.phones.map((p) => {
                  const pv = phoneV(p.number);
                  return (
                    <Row key={p.number} icon={<Phone className="h-4 w-4" />} href={`tel:${(pv?.e164 || p.number).replace(/[^\d+]/g, '')}`}>
                      {pv?.international || p.number} <span className="text-xs text-slate-500">({pv?.lineType?.toLowerCase().replace(/_/g, ' ') || p.type})</span>
                      {pv && <ValidityDot status={pv.status} />}
                    </Row>
                  );
                })}
                {card.website && (
                  <Row icon={<Globe className="h-4 w-4" />} href={card.website}>
                    {hostOf(card.website)}
                    {v?.website && <ValidityDot status={v.website.resolves ? 'valid' : 'invalid'} />}
                  </Row>
                )}
                {card.address && <Row icon={<MapPin className="h-4 w-4" />} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`}>{card.address}</Row>}
              </div>
              {card.notes && <p className="mt-3 text-xs text-slate-500">{card.notes}</p>}
            </Section>

            {d && (
              <Section title="About the person" icon={<Users className="h-4 w-4 text-indigo-300" />}>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Fact label="Seniority" value={d.person.seniority} />
                  <Fact label="Department" value={d.person.department || card.department} />
                </div>
                <p className="text-sm text-slate-200">{d.person.summary || 'No public profile information found.'}</p>
                {!!d.person.responsibilities?.length && <div className="mt-3"><Chips items={d.person.responsibilities} /></div>}
              </Section>
            )}

            {d?.identity?.person && (
              <Section title="LinkedIn identity" icon={<BadgeCheck className="h-4 w-4 text-indigo-300" />} action={<IdentityBadge level={d.identity.person.level} />}>
                {d.identity.person.linkedinUrl ? (
                  <ExtLink href={d.identity.person.linkedinUrl} className="flex items-center gap-1 break-all text-sm">
                    {d.identity.person.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </ExtLink>
                ) : (
                  <p className="text-sm text-slate-400">No confident profile match.</p>
                )}
                <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {d.identity.person.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
                {d.identity.person.alternatives.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Other candidates</div>
                    <ul className="space-y-1 text-xs">
                      {d.identity.person.alternatives.map((a) => (
                        <li key={a.url} className="flex justify-between gap-2">
                          <ExtLink href={a.url} className="truncate">{a.title || a.url}</ExtLink>
                          <span className="shrink-0 text-slate-500">{Math.round(a.score * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.identity.person.level !== 'verified' && (
                  <p className="mt-3 rounded-lg bg-white/[0.03] p-2 text-[11px] text-slate-400">
                    Tip: open their profile in the LinkedIn app, tap <b>Share → CardIntel</b> (installed app, Android) or paste the URL via <b>Edit & re-enrich</b> to mark it verified.
                  </p>
                )}
              </Section>
            )}

            {!!d?.person.employmentHistory?.length && (
              <Section title="Career history" icon={<HistoryIcon className="h-4 w-4 text-indigo-300" />}>
                <ol className="space-y-2 border-l border-white/10 pl-3">
                  {d.person.employmentHistory.map((e, i) => (
                    <li key={i} className="text-sm">
                      <div className="font-medium">{e.title || 'Role'} <span className="font-normal text-slate-400">· {e.company}</span></div>
                      <div className="text-xs text-slate-500">{[e.start, e.current ? 'present' : e.end].filter(Boolean).join(' – ')}</div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </>
        )}

        {d && tab === 'offerings' && (
          <>
            <Section title={`Products (${d.products.length})`} icon={<Package className="h-4 w-4 text-indigo-300" />}>
              {d.products.length ? (
                <div className="space-y-2">
                  {d.products.map((p, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.category && <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200">{p.category}</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No products identified.</p>}
            </Section>
            <Section title={`Services (${d.services.length})`} icon={<Briefcase className="h-4 w-4 text-indigo-300" />}>
              {d.services.length ? (
                <div className="space-y-2">
                  {d.services.map((p, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] p-3">
                      <div className="font-medium">{p.name}</div>
                      <p className="mt-1 text-sm text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No services identified.</p>}
            </Section>
          </>
        )}

        {d && tab === 'customers' && (
          <>
            <Section title="Ideal customer profile" icon={<Target className="h-4 w-4 text-indigo-300" />}>
              {d.targetCustomers.summary && <p className="mb-3 text-sm text-slate-200">{d.targetCustomers.summary}</p>}
              <div className="space-y-3">
                <Labeled label="Segments"><Chips items={d.targetCustomers.segments} tone="indigo" /></Labeled>
                <Labeled label="Industries"><Chips items={d.targetCustomers.industries} /></Labeled>
                <Labeled label="Geographies"><Chips items={d.targetCustomers.geographies} /></Labeled>
                <Labeled label="Buyer personas"><Chips items={d.targetCustomers.buyerPersonas} tone="emerald" /></Labeled>
              </div>
            </Section>
            <Section title="Notable customers" icon={<Users className="h-4 w-4 text-indigo-300" />}>
              {d.notableCustomers.length ? (
                <ul className="space-y-2">
                  {d.notableCustomers.map((c, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div className="font-medium">{c.url ? <ExtLink href={c.url}>{c.name}</ExtLink> : c.name}</div>
                      <div className="text-slate-400">{c.evidence}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No public customer references found.</p>}
            </Section>
            <Section title="Ecosystem" icon={<Link2 className="h-4 w-4 text-indigo-300" />}>
              <div className="space-y-3">
                <Labeled label="Partners"><Chips items={d.partners} tone="emerald" /></Labeled>
                <Labeled label="Competitors"><Chips items={d.competitors} tone="amber" /></Labeled>
              </div>
            </Section>
          </>
        )}

        {d && tab === 'social' && (
          <>
            <Section title="Social presence" icon={<Globe className="h-4 w-4 text-indigo-300" />}>
              {d.socialPresence.length ? (
                <ul className="space-y-2">
                  {d.socialPresence.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition active:bg-white/10">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold uppercase text-indigo-200">{s.platform.slice(0, 2)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium capitalize">{s.platform}{s.handle ? <span className="ml-1 font-normal text-slate-400">{s.handle}</span> : null}</span>
                          <span className="block truncate text-xs text-slate-500">{s.notes || hostOf(s.url)}</span>
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No social profiles found.</p>}
            </Section>
            <Section title="Recent news" icon={<Newspaper className="h-4 w-4 text-indigo-300" />}>
              {d.recentNews.length ? (
                <ul className="space-y-2">
                  {d.recentNews.map((n, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div className="font-medium">{n.url ? <ExtLink href={n.url}>{n.title}</ExtLink> : n.title}</div>
                      {n.date && <div className="text-xs text-slate-500">{n.date}</div>}
                      {n.summary && <p className="mt-1 text-slate-400">{n.summary}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No recent news found.</p>}
            </Section>
          </>
        )}

        {d && tab === 'pitch' && (
          <>
            <Section title="Sales angle" icon={<Target className="h-4 w-4 text-indigo-300" />}>
              <p className="text-sm leading-relaxed text-slate-200">{d.salesAngle || '—'}</p>
            </Section>
            <Section title="Talking points" icon={<MessageSquare className="h-4 w-4 text-indigo-300" />}>
              <ul className="space-y-2">
                {d.talkingPoints.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-sm">
                    <span className="flex-1 text-slate-200">{t}</span>
                    <button onClick={() => copy(t, `tp${i}`)} className="shrink-0 text-slate-500" aria-label="Copy">
                      {copied === `tp${i}` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {d && tab === 'sources' && (
          <>
            {!!d.caveats.length && (
              <Section title="Caveats" icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}>
                <ul className="space-y-1.5 text-sm text-amber-100/80">
                  {d.caveats.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </Section>
            )}
            {d.identity?.company && (
              <Section title="Company match" icon={<BadgeCheck className="h-4 w-4 text-indigo-300" />} action={<IdentityBadge level={d.identity.company.level} />}>
                <ul className="space-y-0.5 text-xs text-slate-400">
                  {d.identity.company.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </Section>
            )}
            <Section title={`Sources (${d.sources.length})`} icon={<Link2 className="h-4 w-4 text-indigo-300" />}>
              <ul className="space-y-2">
                {d.sources.map((s, i) => (
                  <li key={i} className="text-sm">
                    <ExtLink href={s.url} className="line-clamp-1">{s.title || s.url}</ExtLink>
                    <div className="truncate text-xs text-slate-500">{hostOf(s.url)}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-slate-500">
                Confidence {Math.round((d.confidence ?? 0) * 100)}% · Search: {d.searchProvider}{d.grounded ? ' + Google grounding' : ''} · {d.generatedAt ? new Date(d.generatedAt).toLocaleString() : ''}
              </div>
            </Section>
          </>
        )}

        {/* Export bar */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <SmallBtn icon={copied === 'md' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} label="Copy brief" onClick={() => copy(toMarkdown(record), 'md')} />
          <SmallBtn icon={<Download className="h-4 w-4" />} label="vCard" onClick={() => shareOrDownloadVCard(card, d)} />
          <SmallBtn icon={<FileDown className="h-4 w-4" />} label="JSON" onClick={() => downloadFile(`${(card.fullName || 'dossier').replace(/\W+/g, '_')}.json`, JSON.stringify(record, null, 2), 'application/json')} />
          <SmallBtn icon={<Send className="h-4 w-4" />} label="Send to CRM" onClick={() => setCrmOpen(true)} />
          <SmallBtn icon={<RefreshCw className="h-4 w-4" />} label="Refresh data" onClick={onRefresh} />
          <SmallBtn icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => confirm('Delete this scan?') && onDelete()} danger />
        </div>
      </div>

      {crmOpen && <CrmSheet targets={crmTargets} onPush={onPushCrm} onClose={() => setCrmOpen(false)} />}
    </div>
  );
}

function CrmSheet({ targets, onPush, onClose }: { targets: string[]; onPush: Props['onPushCrm']; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<CrmResult | null>(null);
  const push = async (p: 'hubspot' | 'salesforce') => {
    setBusy(p);
    setResult(null);
    setResult(await onPush(p));
    setBusy(null);
  };
  const opts: { id: 'hubspot' | 'salesforce'; label: string; desc: string }[] = [
    { id: 'hubspot', label: 'HubSpot', desc: 'Create/update contact + company, attach dossier as a note' },
    { id: 'salesforce', label: 'Salesforce', desc: 'Create/update a Lead with the dossier in Description' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="safe-bottom w-full max-w-lg rounded-t-3xl border border-white/10 bg-ink-800 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send to CRM</h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          {opts.map((o) => {
            const enabled = targets.includes(o.id);
            return (
              <button key={o.id} disabled={!enabled || !!busy} onClick={() => push(o.id)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left transition active:bg-white/10 disabled:opacity-40">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-bold">{o.label.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-slate-500">{enabled ? o.desc : 'Not configured — add credentials in Settings'}</span>
                </span>
                {busy === o.id && <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />}
              </button>
            );
          })}
        </div>
        {result && (
          <div className={`mt-4 rounded-xl p-3 text-sm ${result.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
            {result.message}
            {result.url && <> · <ExtLink href={result.url}>Open record</ExtLink></>}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ depth, label, node }: { depth: number; label: string; node: { name: string; id?: string | null; source: string } }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2" style={{ marginLeft: depth * 16 }}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label} · {node.source}</div>
      <div className="text-slate-100">{node.name}</div>
      {node.id && <div className="text-[11px] text-slate-500">{node.id}</div>}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, href, primary }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; primary?: boolean }) {
  const cls = `flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs transition active:scale-95 ${primary ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-200'}`;
  if (onClick) return <button onClick={onClick} className={cls}>{icon}{label}</button>;
  if (!href) return <span className={`${cls} opacity-30`}>{icon}{label}</span>;
  return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls}>{icon}{label}</a>;
}

function SmallBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2.5 text-[11px] ${danger ? 'text-rose-300' : 'text-slate-300'}`}>
      {icon}
      {label}
    </button>
  );
}

function Row({ icon, href, children }: { icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-start gap-3 text-slate-200">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </a>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}
