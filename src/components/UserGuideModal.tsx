import { useState } from 'react';
import {
  X, Briefcase, ShieldCheck, TrendingUp, Settings, CheckCircle2,
  Sparkles, ArrowRight, MessageSquare, Building2, Store, FileCheck2,
  Package, Smartphone, UserPlus, Calendar, BarChart3, Download, QrCode,
} from 'lucide-react';

export type UserRole = 'sales' | 'kyc' | 'executive' | 'admin';

interface Props {
  onClose: () => void;
  onSelectAction?: (action: 'scan' | 'sample-card' | 'sample-indian' | 'history' | 'analytics' | 'settings' | 'my-card') => void;
}

const ROLES: { id: UserRole; label: string; icon: typeof Briefcase; title: string; subtitle: string }[] = [
  {
    id: 'sales',
    label: 'Sales & BD',
    icon: Briefcase,
    title: 'Sales & Business Development',
    subtitle: 'Conferences, trade shows, field sales & rapid lead qualification',
  },
  {
    id: 'kyc',
    label: 'Vendor KYC & Ops',
    icon: ShieldCheck,
    title: 'Procurement, KYC & Vendor Audit',
    subtitle: 'Supplier verification, GSTIN/CIN checks, MSME audit & fraud prevention',
  },
  {
    id: 'executive',
    label: 'Founder & CXO',
    icon: TrendingUp,
    title: 'Founders, Investors & Executives',
    subtitle: 'Company 360° intelligence, competitor analysis, event ROI & executive briefings',
  },
  {
    id: 'admin',
    label: 'Admin & IT Ops',
    icon: Settings,
    title: 'System Administrator & IT Operations',
    subtitle: 'Multi-tenant workspaces, Gemini AI keys, CRM integrations & data security',
  },
];

export default function UserGuideModal({ onClose, onSelectAction }: Props) {
  const [role, setRole] = useState<UserRole>('sales');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3.5 backdrop-blur-sm safe-top safe-bottom animate-in fade-in duration-200">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-ink-950/80">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">CardIntel User Guide & Playbooks</h2>
              <p className="text-[10px] text-slate-400">Interactive walkthrough tailored by user persona</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/5 p-1.5 text-slate-400 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-white/[0.08] bg-black/30 p-1.5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const active = role === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 text-center transition-all ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] leading-tight truncate w-full">{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Role Header Banner */}
          <div className="rounded-2xl border border-indigo-400/20 bg-indigo-600/10 p-3.5">
            <h3 className="text-sm font-bold text-indigo-200">{ROLES.find((r) => r.id === role)?.title}</h3>
            <p className="mt-0.5 text-xs text-slate-300">{ROLES.find((r) => r.id === role)?.subtitle}</p>
          </div>

          {/* ========================================================= SALES PLAYBOOK */}
          {role === 'sales' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-400 block">
                  Step-by-Step Sales Workflow
                </span>
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                    <div>
                      <b className="text-white">Scan in Rapid Event Mode:</b> At busy expos, toggle <b className="text-indigo-300">Rapid Mode</b>. Snap 10+ cards back-to-back; enrichment runs in the background.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                    <div>
                      <b className="text-white">Add Voice Notes & Colleagues:</b> Met multiple people at a booth? Open the <b className="text-indigo-300">Notes & Team</b> tab to dictate meeting audio and add team members met.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">3</span>
                    <div>
                      <b className="text-white">1-Tap WhatsApp Intro:</b> Tap <b className="text-emerald-300">WhatsApp</b> to launch a pre-drafted follow-up mentioning the event, stall, and promised action items.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">4</span>
                    <div>
                      <b className="text-white">Push to CRM:</b> Export qualified hot leads directly to <b className="text-indigo-300">HubSpot</b> or <b className="text-indigo-300">Salesforce</b>.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('sample-card'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 font-semibold text-white shadow-md active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Try Sample Scan
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('my-card'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-200 active:scale-95"
                >
                  <QrCode className="h-3.5 w-3.5 text-indigo-400" /> Share My QR
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= KYC PLAYBOOK */}
          {role === 'kyc' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400 block">
                  Vendor Onboarding & KYC Audit Workflow
                </span>
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">1</span>
                    <div>
                      <b className="text-white">Select Scan Mode:</b> Switch mode pill to <b className="text-emerald-300">Invoice</b>, <b className="text-emerald-300">Stall</b>, or <b className="text-emerald-300">Pack</b>.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">2</span>
                    <div>
                      <b className="text-white">Verify GSTIN & CIN:</b> CardIntel extracts the 15-digit GSTIN and 21-digit MCA CIN, validating state code, checksum, and registry status.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">3</span>
                    <div>
                      <b className="text-white">Check 5-Point Trust Score (0-100):</b> Review active GSTIN, MCA registration, domain resolution, corporate email, and legal identity.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">4</span>
                    <div>
                      <b className="text-white">Export Executive PDF Dossier:</b> Tap <b className="text-indigo-300">PDF Report</b> to get a print-ready 2-page vendor appraisal document for procurement files.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('sample-indian'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-md active:scale-95"
                >
                  <FileCheck2 className="h-3.5 w-3.5" /> Test Indian KYC Card
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('history'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-200 active:scale-95"
                >
                  <Building2 className="h-3.5 w-3.5 text-emerald-400" /> View All Vendors
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= EXECUTIVE PLAYBOOK */}
          {role === 'executive' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-fuchsia-400 block">
                  Executive Intelligence & ROI Tracking
                </span>
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white">1</span>
                    <div>
                      <b className="text-white">360° Company Dossier:</b> View firmographics, revenue range, employee count, founders, competitors, and products before taking a meeting.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white">2</span>
                    <div>
                      <b className="text-white">Event ROI Analytics:</b> Open <b className="text-fuchsia-300">Cards & ROI &rarr; Analytics</b> to see total cards, hot leads pipeline, and ₹ deal value rollups by expo.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white">3</span>
                    <div>
                      <b className="text-white">Download Full CSV Export:</b> Export your entire database into Excel / Google Sheets with all corporate tags, GPS venues, and deal sizes.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('analytics'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-fuchsia-600 py-2.5 font-semibold text-white shadow-md active:scale-95"
                >
                  <BarChart3 className="h-3.5 w-3.5" /> View ROI Analytics
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('history'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-200 active:scale-95"
                >
                  <Download className="h-3.5 w-3.5 text-fuchsia-400" /> Export All (CSV)
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= ADMIN PLAYBOOK */}
          {role === 'admin' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-400 block">
                  Admin Configuration & Multi-Tenant Management
                </span>
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">1</span>
                    <div>
                      <b className="text-white">Configure Server Gemini Key:</b> Set <code>GEMINI_API_KEY</code> on your Render server environment to enable live AI scanning for all team members.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">2</span>
                    <div>
                      <b className="text-white">Set Multi-Tenant Workspace ID:</b> Configure <code>tenantId</code> in Settings to isolate sales teams, vendor auditing divisions, and office branches.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">3</span>
                    <div>
                      <b className="text-white">CRM & Registry Integrations:</b> Set HubSpot/Salesforce credentials and monitor live MCA / GSTIN / GLEIF registry health.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">4</span>
                    <div>
                      <b className="text-white">Database Backups & Purges:</b> 1-tap JSON and CSV backup of all tenant records, with safe administrative deletion controls.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('settings'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 font-semibold text-white shadow-md active:scale-95"
                >
                  <Settings className="h-3.5 w-3.5" /> Admin Settings
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); onSelectAction?.('analytics'); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-200 active:scale-95"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Server Health
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] p-3 text-center bg-ink-950">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 py-2 text-xs font-semibold text-slate-200 hover:bg-white/15 transition active:scale-95"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
