'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarRange,
  ShieldAlert,
  HardHat,
  Building2,
  UserCog,
  ArrowUpRight,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  FileText,
  Mail,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { ReportChart } from '@/components/reports/ReportChart';
import { downloadPDF } from '@/lib/pdf';

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function buildPresets() {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  return [
    { key: '7d', label: 'Last 7 days', from: iso(daysAgo(7)), to: iso(now) },
    { key: '30d', label: 'Last 30 days', from: iso(daysAgo(30)), to: iso(now) },
    { key: '90d', label: 'Last 90 days', from: iso(daysAgo(90)), to: iso(now) },
    { key: 'ytd', label: 'This year', from: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to: iso(now) },
  ];
}

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface ExecData {
  range: { from: string; to: string };
  kpis: Record<string, number>;
  deltas?: Record<string, number>;
  prior?: { range: { from: string; to: string }; kpis: Record<string, number> };
  topHosts: { name: string; branch: string; total: number }[];
  topContractors: { name: string; hours: number; workersOnSite: number; complianceScore: number }[];
  topCompanies: { name: string; visits: number }[];
  topBranches: { name: string; visits: number; workerHours: number }[];
  rows: { date: string; visits: number; workerHours: number }[];
  incidentsBySeverity: Record<string, number>;
  incidentsByStatus: Record<string, number>;
  risk: {
    expiredMedicals: number;
    policeUnverified: number;
    openIncidentsAged: number;
    contractorsBelowCompliance: number;
  };
}

export default function ExecutivePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const presets = useMemo(buildPresets, []);
  const [from, setFrom] = useState(presets[1].from); // default last 30d
  const [to, setTo] = useState(presets[1].to);
  const [active, setActive] = useState('30d');
  const [data, setData] = useState<ExecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<ExecData>(`/reports/executive${qs({ from, to, compare: 'true' })}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  function applyPreset(p: { key: string; from: string; to: string }) {
    setActive(p.key);
    setFrom(p.from);
    setTo(p.to);
  }

  function exportPdf() {
    if (!data) return;
    const filters = [
      { label: 'Range', value: `${from} → ${to}` },
      { label: 'Compared vs', value: data.prior ? `${data.prior.range.from.slice(0, 10)} → ${data.prior.range.to.slice(0, 10)}` : 'n/a' },
    ];
    const kpisForPdf = Object.entries(data.kpis).slice(0, 8).map(([k, v]) => ({ label: humanize(k), value: v }));
    downloadPDF('executive-dashboard.pdf', {
      title: 'Executive Dashboard',
      subtitle: `${from} → ${to}`,
      filters,
      kpis: kpisForPdf,
      generatedBy: user?.fullName || user?.email,
      brand: 'AEGIS',
      comparison: data.deltas
        ? {
            priorRange: data.prior?.range,
            priorTotals: data.prior?.kpis,
            deltas: data.deltas,
          }
        : undefined,
    }, data.rows);
    apiPost('/reports/exports', {
      report: 'executive',
      format: 'pdf',
      scope: 'summary',
      rowCount: data.rows.length,
      filters: { from, to },
    }).catch(() => {});
    setNotice({ kind: 'ok', text: 'Executive dashboard downloaded as PDF.' });
  }

  async function emailDashboard() {
    if (!recipients.trim()) {
      setNotice({ kind: 'err', text: 'Add at least one recipient.' });
      return;
    }
    setEmailing(true);
    try {
      const res = await apiPost<{ status: string; sent: number; rows: number }>('/reports/email', {
        report: 'visits',
        from,
        to,
        recipients,
        subject: `Executive dashboard · ${from} → ${to}`,
      });
      setNotice({ kind: res.sent > 0 ? 'ok' : 'err', text: res.status });
      setEmailOpen(false);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Email failed' });
    } finally {
      setEmailing(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center text-text-tertiary">Loading…</div>;
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[11px] uppercase tracking-wider font-medium mb-3">
              <Sparkles className="w-3 h-3" /> C-suite view
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-1">Executive Dashboard</h2>
            <p className="text-text-secondary text-sm max-w-2xl">
              Leadership-level KPIs with period-over-period trends, top performers, risk indicators
              and exportable summaries. Pulls from the same data as the reporting center —
              <Link href="/reports" className="text-brand-400 hover:text-brand-300 ml-1">go deeper in /reports</Link>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button type="button" onClick={() => setEmailOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm">
              <Mail className="w-4 h-4" /> Email summary
            </button>
            <button type="button" onClick={exportPdf}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium shadow-brand-glow">
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>

        {notice && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>{notice.text}</div>
        )}

        {/* Range presets */}
        <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-1 p-4 flex items-center gap-2 flex-wrap">
          <CalendarRange className="w-4 h-4 text-brand-400" />
          {presets.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active === p.key
                  ? 'bg-brand-gradient text-white shadow-brand-glow'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-border-subtle'
              }`}>{p.label}</button>
          ))}
          <span className="text-xs text-text-tertiary ml-auto">
            {data?.prior && `Compared vs ${data.prior.range.from.slice(0, 10)} → ${data.prior.range.to.slice(0, 10)}`}
          </span>
        </div>

        {loading || !data ? (
          <div className="text-center text-text-tertiary py-16">Loading executive view…</div>
        ) : (
          <>
            {/* ── Hero KPIs (6 large cards) ───────────────────────── */}
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <HeroKpi label="Total visits" value={data.kpis.totalVisits} delta={data.deltas?.totalVisits} />
              <HeroKpi label="Worker hours" value={data.kpis.totalWorkerHours} delta={data.deltas?.totalWorkerHours} />
              <HeroKpi label="Compliance" value={`${data.kpis.avgComplianceScore}%`} delta={data.deltas?.avgComplianceScore} />
              <HeroKpi label="Open incidents" value={data.kpis.openIncidents} delta={data.deltas?.openIncidents} invertColor />
              <HeroKpi label="Headcount" value={data.kpis.totalHeadcount} delta={data.deltas?.totalHeadcount} />
              <HeroKpi label="Avg dwell (m)" value={data.kpis.avgVisitDurationMin} delta={data.deltas?.avgVisitDurationMin} />
            </div>

            {/* ── Risk indicators ─────────────────────────────────── */}
            <RiskRow risk={data.risk} />

            {/* ── Trend chart ─────────────────────────────────────── */}
            <section className="rounded-2xl border border-border-subtle bg-surface-1 mt-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-400" />
                  <h3 className="text-sm font-semibold text-text-primary">Daily activity</h3>
                </div>
                <Link href="/reports" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  Deep dive <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5">
                <ReportChart
                  rows={data.rows}
                  labelKey="date"
                  type="line"
                  series={[
                    { key: 'visits', label: 'Visits', color: 'rgba(124,58,237,0.85)' },
                    { key: 'workerHours', label: 'Worker hrs', color: '#22c55e' },
                  ]}
                  max={90}
                />
              </div>
            </section>

            {/* ── Top performers (3-col) ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
              <Ranked
                icon={UserCog}
                label="Top hosts by visits hosted"
                items={data.topHosts.map((h) => ({ left: h.name, sub: h.branch, value: h.total }))}
              />
              <Ranked
                icon={HardHat}
                label="Top contractors by hours"
                items={data.topContractors.map((c) => ({
                  left: c.name,
                  sub: `${c.workersOnSite} on site · ${c.complianceScore}% compliance`,
                  value: `${c.hours}h`,
                }))}
              />
              <Ranked
                icon={Building2}
                label="Top visitor companies"
                items={data.topCompanies.map((c) => ({ left: c.name, sub: '', value: c.visits }))}
              />
            </div>

            {/* ── Branch leaderboard + Incident breakdown ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <Ranked
                icon={Building2}
                label="Branches by activity"
                items={data.topBranches.map((b) => ({ left: b.name, sub: `${b.workerHours}h worker time`, value: `${b.visits} visits` }))}
              />
              <IncidentBreakdown
                bySev={data.incidentsBySeverity}
                byStatus={data.incidentsByStatus}
              />
            </div>
          </>
        )}
      </div>

      {/* Email modal */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur"
          onClick={(e) => { if (e.target === e.currentTarget) setEmailOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-border-subtle">
              <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Email this dashboard</h3>
                <p className="text-xs text-text-tertiary">{from} → {to} — visits summary attached</p>
              </div>
            </div>
            <div className="p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Recipients</span>
                <input value={recipients} onChange={(e) => setRecipients(e.target.value)}
                  placeholder="ceo@acme.com, board@acme.com"
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border-subtle bg-surface-2/40 rounded-b-2xl">
              <button type="button" onClick={() => setEmailOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary text-sm">Cancel</button>
              <button type="button" onClick={emailDashboard} disabled={emailing || !recipients.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium disabled:opacity-50">
                {emailing ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function humanize(s: string) {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function HeroKpi({
  label,
  value,
  delta,
  invertColor,
}: {
  label: string;
  value: number | string;
  delta?: number;
  invertColor?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="text-3xl font-bold text-text-primary tabular-nums">{value ?? '—'}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xs text-text-tertiary">{label}</div>
        {typeof delta === 'number' && <Delta pct={delta} invertColor={invertColor} />}
      </div>
    </div>
  );
}

function Delta({ pct, invertColor }: { pct: number; invertColor?: boolean }) {
  const positive = pct > 0;
  const flat = pct === 0;
  const good = invertColor ? !positive : positive;
  const cls = flat ? 'bg-surface-2 text-text-tertiary'
    : good ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300';
  const Icon = flat ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded ${cls} px-1.5 py-0.5 text-[11px] font-medium tabular-nums`}
      title={`${positive ? '+' : ''}${pct}% vs prior period`}>
      <Icon className="w-3 h-3" /> {Math.abs(pct)}%
    </span>
  );
}

function RiskRow({ risk }: { risk: ExecData['risk'] }) {
  const items = [
    { label: 'Expired medicals', value: risk.expiredMedicals, danger: risk.expiredMedicals > 0 },
    { label: 'Unverified workers', value: risk.policeUnverified, danger: risk.policeUnverified > 0 },
    { label: 'Aged open incidents (>7d)', value: risk.openIncidentsAged, danger: risk.openIncidentsAged > 0 },
    { label: 'Contractors below 70%', value: risk.contractorsBelowCompliance, danger: risk.contractorsBelowCompliance > 0 },
  ];
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-text-primary">Risk indicators</h3>
        <span className="text-xs text-text-tertiary">— anything non-zero needs review</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label}
            className={`rounded-xl border px-3 py-3 ${
              it.danger
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-emerald-500/30 bg-emerald-500/5'
            }`}>
            <div className={`text-xl font-bold tabular-nums ${it.danger ? 'text-red-300' : 'text-emerald-300'}`}>
              {it.value}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ranked({
  icon: Icon,
  label,
  items,
}: {
  icon: any;
  label: string;
  items: { left: string; sub?: string; value: string | number }[];
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <Icon className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-xs text-text-tertiary text-center">No data in this period.</div>
      ) : (
        <ol className="divide-y divide-border-subtle">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-text-tertiary text-xs tabular-nums w-4 text-right">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">{it.left}</div>
                  {it.sub && <div className="text-[11px] text-text-tertiary truncate">{it.sub}</div>}
                </div>
              </div>
              <div className="text-sm text-text-primary font-medium tabular-nums">{it.value}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function IncidentBreakdown({
  bySev,
  byStatus,
}: {
  bySev: Record<string, number>;
  byStatus: Record<string, number>;
}) {
  const total = Object.values(byStatus).reduce((s, v) => s + (v || 0), 0);
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <ShieldAlert className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-text-primary">Incidents</h3>
        <span className="text-xs text-text-tertiary">— {total} total this period</span>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-2">By severity</div>
          {[5, 4, 3, 2, 1].map((s) => {
            const n = bySev[`sev${s}`] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={s} className="mb-1.5 last:mb-0">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-0.5">
                  <span>Severity {s}</span>
                  <span className="tabular-nums">{n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={`h-full ${s >= 4 ? 'bg-red-500' : s === 3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-2">By status</div>
          <StatusRow icon={XCircle} color="text-red-300" label="Open" n={byStatus.open || 0} />
          <StatusRow icon={Activity} color="text-amber-300" label="Investigating" n={byStatus.investigating || 0} />
          <StatusRow icon={CheckCircle2} color="text-emerald-300" label="Resolved" n={byStatus.resolved || 0} />
          <StatusRow icon={Minus} color="text-text-tertiary" label="False positive" n={byStatus.false_positive || 0} />
        </div>
      </div>
    </section>
  );
}

function StatusRow({ icon: Icon, color, label, n }: { icon: any; color: string; label: string; n: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`flex items-center gap-1.5 text-xs ${color}`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-sm text-text-primary font-medium tabular-nums">{n}</span>
    </div>
  );
}
