'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import {
  CalendarRange,
  CalendarClock,
  ChevronDown,
  RefreshCw,
  Mail,
  Send,
  X,
  Loader2,
  Sparkles,
  TableProperties,
  BarChart3,
  Grid3X3,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { downloadPDF } from '@/lib/pdf';
import { downloadXLSX } from '@/lib/xlsx';
import { downloadJSON, downloadXML, printReport } from '@/lib/export-formats';
import { ReportChart, type Series } from '@/components/reports/ReportChart';
import { ReportHeatmap } from '@/components/reports/ReportHeatmap';
import { SchedulesPanel } from '@/components/reports/SchedulesPanel';
import { CatalogRail, type CatalogSection } from '@/components/reports/CatalogRail';
import { DownloadCenter, type ExportFormat, type ExportScope } from '@/components/reports/DownloadCenter';
import { ColumnSelector } from '@/components/reports/ColumnSelector';
import { DrillDrawer } from '@/components/reports/DrillDrawer';
import { TemplatesPanel, type Template } from '@/components/reports/TemplatesPanel';
import { ExportHistoryPanel } from '@/components/reports/ExportHistoryPanel';

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function buildPresets() {
  const now = new Date();
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const lastMonthStart = startOfMonth(lastMonthEnd);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  return [
    { key: 'thisMonth', label: 'This month', from: iso(startOfMonth(now)), to: iso(now) },
    { key: 'lastMonth', label: 'Last month', from: iso(lastMonthStart), to: iso(lastMonthEnd) },
    { key: '7d', label: 'Last 7 days', from: iso(daysAgo(7)), to: iso(now) },
    { key: '30d', label: 'Last 30 days', from: iso(daysAgo(30)), to: iso(now) },
    { key: '90d', label: 'Last 90 days', from: iso(daysAgo(90)), to: iso(now) },
    { key: 'ytd', label: 'This year', from: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to: iso(now) },
  ];
}
function presetByKey(key: string) {
  return buildPresets().find((p) => p.key === key);
}
function humanize(s: string) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

// ───────────────────────────────────────────────────────────────────
// Per-report metadata that's UI-only (endpoint paths, grouping options,
// chart series). Server-driven catalog provides the *list*, this map
// adds the rendering details.
// ───────────────────────────────────────────────────────────────────
interface GroupOpt { value: string; label: string }
interface ReportRender {
  endpoint: string;
  labelKey: string;
  groupBy?: GroupOpt[];
  fixedDetailGroupBy?: string;
  useBranch?: boolean;
  useContractor?: boolean;
  series: Series[];
}

const TIME_GROUPS: GroupOpt[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' },
  { value: 'day', label: 'Daily' },
  { value: 'year', label: 'Yearly' },
];

const RENDER: Record<string, ReportRender> = {
  visits: {
    endpoint: '/reports/visits',
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'total', label: 'Total', color: 'rgba(124,58,237,0.85)' },
      { key: 'checkedIn', label: 'Checked in', color: '#22c55e' },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'host', label: 'By host' },
      { value: 'status', label: 'By status' },
      { value: 'company', label: 'By visitor company' },
      { value: 'purpose', label: 'By purpose' },
    ],
  },
  workforce: {
    endpoint: '/reports/workforce',
    labelKey: 'group',
    useBranch: true,
    useContractor: true,
    series: [
      { key: 'totalHours', label: 'Total hours', color: 'rgba(124,58,237,0.85)' },
      { key: 'overtimeHours', label: 'Overtime', color: '#f59e0b' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'contractor', label: 'By contractor' },
      { value: 'worker', label: 'By worker' },
      { value: 'branch', label: 'By branch / location' },
      { value: 'skill', label: 'By skill category' },
    ],
  },
  contractors: {
    endpoint: '/reports/contractors',
    labelKey: 'contractor',
    fixedDetailGroupBy: 'contractor',
    series: [
      { key: 'totalWorkers', label: 'Workers', color: 'rgba(124,58,237,0.85)' },
      { key: 'workersOnSite', label: 'On site', color: '#22c55e' },
      { key: 'complianceScore', label: 'Compliance', color: '#a855f7' },
    ],
  },
  branches: {
    endpoint: '/reports/branches',
    labelKey: 'branch',
    fixedDetailGroupBy: 'branch',
    series: [
      { key: 'visits', label: 'Visits', color: 'rgba(124,58,237,0.85)' },
      { key: 'uniqueVisitors', label: 'Unique', color: '#22c55e' },
      { key: 'workersOnSite', label: 'Workers', color: '#f59e0b' },
    ],
  },
  users: {
    endpoint: '/reports/users',
    labelKey: 'host',
    fixedDetailGroupBy: 'host',
    useBranch: true,
    series: [
      { key: 'total', label: 'Hosted', color: 'rgba(124,58,237,0.85)' },
      { key: 'checkedIn', label: 'Checked in', color: '#22c55e' },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e' },
    ],
  },
  materials: {
    endpoint: '/reports/materials',
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'inQty', label: 'In', color: '#22c55e' },
      { key: 'outQty', label: 'Out', color: '#f43f5e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'direction', label: 'By direction' },
    ],
  },
  incidents: {
    endpoint: '/reports/incidents',
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'total', label: 'Total', color: 'rgba(124,58,237,0.85)' },
      { key: 'open', label: 'Open', color: '#f43f5e' },
      { key: 'resolved', label: 'Resolved', color: '#22c55e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'kind', label: 'By kind' },
      { value: 'status', label: 'By status' },
      { value: 'severity', label: 'By severity' },
    ],
  },
  audit: {
    endpoint: '/reports/audit',
    labelKey: 'group',
    series: [
      { key: 'requests', label: 'Requests', color: 'rgba(124,58,237,0.85)' },
      { key: 'errors', label: 'Errors', color: '#f43f5e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'actor', label: 'By user' },
      { value: 'role', label: 'By role' },
      { value: 'path', label: 'By endpoint' },
      { value: 'method', label: 'By HTTP method' },
      { value: 'status', label: 'By status class' },
    ],
  },
  vehicles: {
    endpoint: '/reports/vehicles',
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'vehicles', label: 'Vehicles', color: 'rgba(124,58,237,0.85)' },
      { key: 'uniquePlates', label: 'Unique plates', color: '#22c55e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'vehicle', label: 'By plate' },
      { value: 'company', label: 'By company' },
      { value: 'status', label: 'By status' },
    ],
  },
  'gate-activity': {
    endpoint: '/reports/gate-activity',
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'visitorEntries', label: 'Visitor entries', color: 'rgba(124,58,237,0.85)' },
      { key: 'workerEntries', label: 'Worker entries', color: '#22c55e' },
      { key: 'totalEntries', label: 'Total entries', color: '#a855f7' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'hour', label: 'By hour of day' },
      { value: 'heatmap', label: 'Heatmap (day × hour)' },
      { value: 'branch', label: 'By branch / location' },
    ],
  },
};

interface Branch { id: string; name: string; location: string }
interface Contractor { id: string; companyName: string }

function qs(params: Record<string, string | string[] | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

type Notice = { kind: 'ok' | 'err'; text: string };

// ───────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const presets = useMemo(buildPresets, []);
  const [catalog, setCatalog] = useState<CatalogSection[]>([]);
  const [activeKey, setActiveKey] = useState<string>('visits');

  // Filters
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [activePreset, setActivePreset] = useState('thisMonth');
  const [branchId, setBranchId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  // Per-report group-by + column selection
  const [groupByByReport, setGroupByByReport] = useState<Record<string, string>>({});
  const [columnsByReport, setColumnsByReport] = useState<Record<string, string[] | null>>({});
  const [view, setView] = useState<'chart' | 'table' | 'heatmap'>('chart');
  const [compare, setCompare] = useState(false);

  // Data
  const [data, setData] = useState<any | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  // Drill-down drawer
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [drillCount, setDrillCount] = useState(0);
  const [drillLoading, setDrillLoading] = useState(false);

  // Email modal
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const render = RENDER[activeKey];
  const groupBy = groupByByReport[activeKey] ?? render?.groupBy?.[0]?.value;
  const detailGroupBy = render?.groupBy ? groupBy : render?.fixedDetailGroupBy;
  const isTimeGroup = ['day', 'week', 'month', 'year', 'hour'].includes(groupBy ?? '');
  const isHeatmap = groupBy === 'heatmap';
  const selectedColumns = columnsByReport[activeKey] ?? null;

  // Lookup: which catalog entry is selected?
  const allReports = useMemo(
    () => catalog.flatMap((s) => s.reports),
    [catalog],
  );
  const activeMeta = allReports.find((r) => r.key === activeKey);

  // ── Boot: redirect, fetch catalog + branches + contractors ─────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<{ sections: CatalogSection[] }>('/reports/catalog')
      .then((c) => setCatalog(c.sections))
      .catch(() => setCatalog([]));
    apiGet<Branch[]>('/admin/branches').then(setBranches).catch(() => {});
    apiGet<Contractor[]>('/admin/contractors').then(setContractors).catch(() => {});
  }, [isAuthenticated]);

  // ── Data loading ───────────────────────────────────────────────
  const baseParams = useMemo(
    () => ({
      from,
      to,
      branchId: render?.useBranch ? branchId : undefined,
      contractorId: render?.useContractor ? contractorId : undefined,
    }),
    [from, to, branchId, contractorId, render],
  );

  const loadOverview = useCallback(() => {
    apiGet<any>(`/reports/overview${qs({ from, to, branchId, compare: compare ? 'true' : undefined })}`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [from, to, branchId, compare]);

  const loadReport = useCallback(() => {
    if (!render) return;
    setLoading(true);
    setError(null);
    setData(null);
    setDrillOpen(false);
    apiGet<any>(`${render.endpoint}${qs({ ...baseParams, groupBy, compare: compare ? 'true' : undefined })}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        const raw = e instanceof Error ? e.message : 'Failed to load report';
        const isMissing = /404|not.*found|cannot.*get/i.test(raw);
        setError(
          isMissing
            ? `This report is still deploying on the API — wait ~30s and click Refresh. (${raw})`
            : raw,
        );
      })
      .finally(() => setLoading(false));
  }, [render, baseParams, groupBy, compare]);

  useEffect(() => {
    if (isAuthenticated) loadOverview();
  }, [isAuthenticated, loadOverview]);

  useEffect(() => {
    if (isAuthenticated) loadReport();
  }, [isAuthenticated, loadReport]);

  // ── Filter helpers ─────────────────────────────────────────────
  function applyPreset(p: { key: string; from: string; to: string }) {
    setActivePreset(p.key);
    setFrom(p.from);
    setTo(p.to);
  }

  // ── Drill-down ─────────────────────────────────────────────────
  function openDrill(value: string) {
    if (!render) return;
    setDrillTitle(value);
    setDrillRows([]);
    setDrillCount(0);
    setDrillLoading(true);
    setDrillOpen(true);
    apiGet<any>(
      `${render.endpoint}/detail${qs({ ...baseParams, groupBy: detailGroupBy, value })}`,
    )
      .then((d) => {
        setDrillRows(d?.rows ?? []);
        setDrillCount(d?.count ?? d?.rows?.length ?? 0);
      })
      .catch(() => setDrillRows([]))
      .finally(() => setDrillLoading(false));
  }

  // ── Rows with column projection applied client-side too (so the
  //    visible table matches the export). ────────────────────────
  const allColumns = data?.rows?.[0] ? Object.keys(data.rows[0]) : [];
  const effectiveColumns = (() => {
    if (!allColumns.length) return [];
    if (!selectedColumns || selectedColumns.length === 0) return allColumns;
    return allColumns.filter((c) => selectedColumns.includes(c));
  })();
  const rows: any[] = (data?.rows ?? []).map((r: any) => {
    if (!selectedColumns || selectedColumns.length === 0) return r;
    const out: Record<string, any> = {};
    for (const c of effectiveColumns) out[c] = r[c];
    return out;
  });

  // ── Download Center ───────────────────────────────────────────
  function appliedFiltersForPdf() {
    const out: { label: string; value: string }[] = [
      { label: 'Range', value: `${from} → ${to}` },
    ];
    if (groupBy) out.push({ label: 'Group by', value: groupBy });
    if (branchId) {
      const b = branches.find((x) => x.id === branchId);
      out.push({ label: 'Branch', value: b ? `${b.name} — ${b.location}` : branchId });
    }
    if (contractorId) {
      const c = contractors.find((x) => x.id === contractorId);
      out.push({ label: 'Contractor', value: c?.companyName ?? contractorId });
    }
    return out;
  }
  function kpisForPdf() {
    const k = overview?.kpis;
    if (!k) return [];
    return [
      { label: 'Total visits', value: k.totalVisits },
      { label: 'Unique', value: k.uniqueVisitors },
      { label: 'Checked in', value: k.checkedInVisits },
      { label: 'Worker hours', value: k.totalWorkerHours },
      { label: 'On site', value: k.uniqueWorkersOnSite },
      { label: 'Contractors', value: k.contractors },
      { label: 'Avg compliance', value: k.avgComplianceScore != null ? `${k.avgComplianceScore}%` : '—' },
      { label: 'Rejected', value: k.rejectedVisits },
    ];
  }

  async function downloadActive(fmt: ExportFormat, scope: ExportScope, _opts: { withCharts: boolean }) {
    if (!render || !activeMeta) return;
    setDownloadBusy(true);
    setNotice(null);
    try {
      // For "full" scope we re-fetch without the column filter; otherwise
      // we ship the projected rows the user is looking at.
      let dataForExport = data;
      if (scope === 'full' && (selectedColumns?.length ?? 0) > 0) {
        dataForExport = await apiGet<any>(`${render.endpoint}${qs({ ...baseParams, groupBy })}`);
      }
      const exportRows: any[] = scope === 'summary'
        ? []
        : scope === 'full'
          ? (dataForExport?.rows ?? [])
          : rows;

      const summaryRows = dataForExport?.totals
        ? [Object.fromEntries(Object.entries(dataForExport.totals).map(([k, v]) => [k, v as any]))]
        : [];

      const safe = `vms-${activeKey}-${groupBy ?? 'all'}-${from}_${to}`;
      const title = `${activeMeta.label} · ${from} → ${to}`;

      if (fmt === 'csv') {
        if (scope === 'summary') {
          if (!summaryRows.length) {
            setNotice({ kind: 'err', text: 'No summary totals to export.' });
            return;
          }
          downloadCSV(`${safe}-summary.csv`, summaryRows);
        } else {
          if (!exportRows.length) {
            setNotice({ kind: 'err', text: 'No rows in the selected scope.' });
            return;
          }
          downloadCSV(`${safe}.csv`, exportRows);
        }
      } else if (fmt === 'xlsx') {
        const sheets = [
          ...(summaryRows.length ? [{ name: 'Summary', rows: summaryRows }] : []),
          ...(scope === 'summary' ? [] : [{ name: activeMeta.label.slice(0, 28), rows: exportRows }]),
        ];
        if (!sheets.length) {
          setNotice({ kind: 'err', text: 'Nothing to export for this scope.' });
          return;
        }
        downloadXLSX(safe, sheets);
      } else if (fmt === 'pdf') {
        downloadPDF(`${safe}.pdf`, {
          title: activeMeta.label,
          subtitle: `${groupBy ? humanize(groupBy) : 'Report'} · ${from} → ${to}${compare ? ' · vs prior period' : ''}`,
          filters: appliedFiltersForPdf(),
          kpis: kpisForPdf(),
          generatedBy: user?.fullName || user?.email,
          brand: 'AEGIS',
          comparison: compare && data?.deltas
            ? {
                priorRange: data?.prior?.range
                  ? { from: data.prior.range.from.slice(0, 10), to: data.prior.range.to.slice(0, 10) }
                  : undefined,
                priorTotals: data?.prior?.totals,
                deltas: data.deltas,
              }
            : undefined,
        }, scope === 'summary' ? summaryRows : exportRows);
      } else if (fmt === 'json') {
        downloadJSON(safe, {
          title: activeMeta.label,
          range: { from, to },
          totals: dataForExport?.totals,
          rows: scope === 'summary' ? summaryRows : exportRows,
        });
      } else if (fmt === 'xml') {
        downloadXML(safe, {
          title: activeMeta.label,
          range: { from, to },
          totals: dataForExport?.totals,
          rows: scope === 'summary' ? summaryRows : exportRows,
        });
      } else if (fmt === 'print') {
        printReport(title, scope === 'summary' ? summaryRows : exportRows, {
          range: { from, to },
          totals: dataForExport?.totals,
        });
      }
      setNotice({
        kind: 'ok',
        text: `${activeMeta.label} exported as ${fmt.toUpperCase()} (${scope})`,
      });

      // Best-effort audit log; don't fail the UX on log error.
      apiPost('/reports/exports', {
        report: activeKey,
        format: fmt,
        scope,
        rowCount: (scope === 'summary' ? summaryRows.length : exportRows.length),
        filters: {
          from,
          to,
          groupBy,
          branchId: render.useBranch ? branchId : undefined,
          contractorId: render.useContractor ? contractorId : undefined,
          columns: selectedColumns?.length ? selectedColumns.join(',') : undefined,
        },
      }).catch(() => {});
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setDownloadBusy(false);
    }
  }

  // ── Email this report ─────────────────────────────────────────
  async function sendEmail() {
    if (!render || !activeMeta) return;
    setEmailBusy(true);
    setNotice(null);
    try {
      const res = await apiPost<{ status: string; sent: number; failed: number; rows: number }>(
        '/reports/email',
        {
          report: activeKey,
          groupBy,
          from,
          to,
          branchId: render.useBranch ? branchId : undefined,
          contractorId: render.useContractor ? contractorId : undefined,
          recipients: emailRecipients,
          subject: emailSubject || undefined,
        },
      );
      setNotice({
        kind: res.sent > 0 ? 'ok' : 'err',
        text: `${activeMeta.label}: ${res.status}`,
      });
      setEmailOpen(false);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Email failed' });
    } finally {
      setEmailBusy(false);
    }
  }

  // ── Saved templates ───────────────────────────────────────────
  function applyTemplate(t: Template) {
    setActiveKey(t.report);
    if (t.groupBy) setGroupByByReport((m) => ({ ...m, [t.report]: t.groupBy! }));
    if (t.branchId !== undefined) setBranchId(t.branchId ?? '');
    if (t.contractorId !== undefined) setContractorId(t.contractorId ?? '');
    if (t.rangePreset) {
      const p = presetByKey(t.rangePreset);
      if (p) applyPreset(p);
    }
    if (t.columns) {
      const cols = t.columns.split(',').map((c) => c.trim()).filter(Boolean);
      setColumnsByReport((m) => ({ ...m, [t.report]: cols.length ? cols : null }));
    } else {
      setColumnsByReport((m) => ({ ...m, [t.report]: null }));
    }
    setNotice({ kind: 'ok', text: `Applied saved view "${t.name}"` });
  }
  function buildSnapshot() {
    return {
      name: activeMeta?.label ?? 'View',
      report: activeKey,
      groupBy: groupBy ?? null,
      branchId: branchId || null,
      contractorId: contractorId || null,
      rangePreset: activePreset === 'custom' ? 'thisMonth' : activePreset,
      columns: selectedColumns?.length ? selectedColumns.join(',') : null,
    };
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-tertiary">Loading…</div>
      </div>
    );
  }

  const kpis = overview?.kpis;

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-8">
        {/* ── Page header ──────────────────────────────────────── */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[11px] uppercase tracking-wider font-medium mb-3">
              <Sparkles className="w-3 h-3" /> Enterprise reporting
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-1">Reporting Center</h2>
            <p className="text-text-secondary text-sm max-w-2xl">
              Ten report families, server-side filtering, column-by-column control, drill-downs and a
              download / email center on every view. Saved views and scheduled delivery on the right.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { loadOverview(); loadReport(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {notice && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between gap-3 ${
              notice.kind === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── KPI strip (always visible) ───────────────────────── */}
        {kpis && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total visits" value={kpis.totalVisits} delta={overview?.deltas?.totalVisits} />
            <Kpi label="Unique" value={kpis.uniqueVisitors} delta={overview?.deltas?.uniqueVisitors} />
            <Kpi label="Checked in" value={kpis.checkedInVisits} delta={overview?.deltas?.checkedInVisits} />
            <Kpi label="Avg dwell" value={kpis.avgVisitDurationMin != null ? `${kpis.avgVisitDurationMin}m` : '—'} delta={overview?.deltas?.avgVisitDurationMin} />
            <Kpi label="Worker hours" value={kpis.totalWorkerHours} delta={overview?.deltas?.totalWorkerHours} />
            <Kpi label="Workers on site" value={kpis.uniqueWorkersOnSite} delta={overview?.deltas?.uniqueWorkersOnSite} />
            <Kpi label="Active workers" value={kpis.activeWorkers} delta={overview?.deltas?.activeWorkers} />
            <Kpi label="Contractors" value={kpis.contractors} delta={overview?.deltas?.contractors} />
            <Kpi label="Avg compliance" value={kpis.avgComplianceScore != null ? `${kpis.avgComplianceScore}%` : '—'} delta={overview?.deltas?.avgComplianceScore} />
            <Kpi label="Completed" value={kpis.completedVisits} delta={overview?.deltas?.completedVisits} />
            <Kpi label="Rejected" value={kpis.rejectedVisits} delta={overview?.deltas?.rejectedVisits} invertColor />
            <Kpi label="Headcount" value={kpis.totalHeadcount} delta={overview?.deltas?.totalHeadcount} />
          </div>
        )}

        {/* ── 3-column workspace ───────────────────────────────── */}
        <div className="flex gap-6 items-start flex-col lg:flex-row">
          {/* Left rail */}
          <CatalogRail sections={catalog} activeKey={activeKey} onSelect={setActiveKey} />

          {/* Center workspace */}
          <section className="flex-1 min-w-0 space-y-4 w-full">
            {/* Filters bar */}
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarRange className="w-4 h-4 text-brand-400" />
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activePreset === p.key
                        ? 'bg-brand-gradient text-white shadow-brand-glow'
                        : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-border-subtle'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">From</span>
                  <input type="date" value={from}
                    onChange={(e) => { setFrom(e.target.value); setActivePreset('custom'); }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">To</span>
                  <input type="date" value={to}
                    onChange={(e) => { setTo(e.target.value); setActivePreset('custom'); }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">Branch / location</span>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
                    disabled={!render?.useBranch}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary disabled:opacity-40">
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} — {b.location}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-tertiary">Contractor</span>
                  <select value={contractorId} onChange={(e) => setContractorId(e.target.value)}
                    disabled={!render?.useContractor}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary disabled:opacity-40">
                    <option value="">All contractors</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Active report panel */}
            <div className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-5 flex-wrap border-b border-border-subtle">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-brand-gradient text-white">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-text-primary truncate">
                      {activeMeta?.label ?? 'Select a report'}
                    </h3>
                    <p className="text-sm text-text-secondary truncate">
                      {activeMeta?.description ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {render?.groupBy && (
                    <select
                      value={groupBy}
                      onChange={(e) =>
                        setGroupByByReport((m) => ({ ...m, [activeKey]: e.target.value }))
                      }
                      className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                    >
                      {render.groupBy.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  )}
                  <ColumnSelector
                    available={allColumns}
                    selected={selectedColumns}
                    onChange={(next) =>
                      setColumnsByReport((m) => ({ ...m, [activeKey]: next }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setCompare((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      compare
                        ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                        : 'bg-surface-2 hover:bg-surface-3 border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}
                    title="Compare against the equivalent prior period"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Compare vs prior
                  </button>
                  <div className="flex rounded-lg bg-surface-2 border border-border-subtle p-1">
                    {(['chart', 'table'] as const).map((v) => {
                      const disabled = isHeatmap;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={disabled}
                          onClick={() => setView(v)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                            view === v && !isHeatmap
                              ? 'bg-brand-gradient text-white'
                              : 'text-text-tertiary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          {v === 'chart' ? <BarChart3 className="w-3.5 h-3.5" /> : <TableProperties className="w-3.5 h-3.5" />}
                          <span className="capitalize">{v}</span>
                        </button>
                      );
                    })}
                    {isHeatmap && (
                      <button
                        type="button"
                        disabled
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-brand-gradient text-white"
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                        <span>Heatmap</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailRecipients('');
                      setEmailSubject(`${activeMeta?.label ?? 'Report'} · ${from} → ${to}`);
                      setEmailOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
                    title="Email this report"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <DownloadCenter busy={downloadBusy} onExport={downloadActive} />
                </div>
              </div>

              {data?.totals && (
                <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border-subtle bg-surface-2/50">
                  {Object.entries(data.totals).map(([k, v]) => {
                    const d = data.deltas?.[k];
                    return (
                      <span
                        key={k}
                        className="text-xs px-2.5 py-1 rounded-md bg-surface-1 border border-border-subtle text-text-secondary flex items-center gap-1.5"
                      >
                        <span className="text-text-tertiary">{humanize(k)}:</span>
                        <span className="text-text-primary font-medium">{String(v)}</span>
                        {compare && typeof d === 'number' && <DeltaChip pct={d} />}
                      </span>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="p-4 text-sm text-red-300 bg-red-500/10 border-b border-red-500/30">{error}</div>
              )}

              {loading ? (
                <div className="p-16 text-center text-text-tertiary">Loading report…</div>
              ) : rows.length === 0 ? (
                <div className="p-16 text-center text-text-tertiary">No data for the selected filters.</div>
              ) : isHeatmap ? (
                <div className="p-5">
                  <ReportHeatmap rows={rows} metric="totalEntries" />
                  <p className="text-xs text-text-tertiary mt-3">
                    Each cell is one hour on that weekday — purple intensity scales with entries.
                  </p>
                </div>
              ) : view === 'chart' ? (
                <div className="p-5">
                  <ReportChart
                    rows={rows}
                    labelKey={render!.labelKey}
                    series={render!.series.filter((s) =>
                      !selectedColumns?.length || effectiveColumns.includes(s.key),
                    )}
                    type={isTimeGroup ? 'line' : 'bar'}
                    priorRows={compare ? (data?.prior?.rows ?? null) : null}
                  />
                  <p className="text-xs text-text-tertiary mt-3">
                    {compare
                      ? 'Solid = this period, dashed = prior period. Hover any bar/point for exact values.'
                      : 'Switch to Table to drill into the records behind each bar — every row opens a side panel.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[40rem]">
                  <table className="w-full text-sm">
                    <thead className="text-text-tertiary sticky top-0 bg-surface-2/95 backdrop-blur">
                      <tr>
                        {effectiveColumns.map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">{humanize(h)}</th>
                        ))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-text-secondary">
                      {rows.map((row: any, i: number) => {
                        const val = String(row[render!.labelKey]);
                        return (
                          <tr
                            key={i}
                            onClick={() => openDrill(val)}
                            className="hover:bg-surface-2 cursor-pointer"
                          >
                            {effectiveColumns.map((h) => (
                              <td key={h} className="px-4 py-2 whitespace-nowrap">
                                {row[h] === null || row[h] === undefined ? '—' : String(row[h])}
                              </td>
                            ))}
                            <td className="pr-3 text-text-tertiary text-right">
                              <ChevronDown className="w-4 h-4 -rotate-90 inline-block" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-text-tertiary">
              All figures respect your organization scope. Workforce hours assume an 8h/day overtime threshold at 1.5× the worker&apos;s hourly rate.
            </p>
          </section>

          {/* Right rail */}
          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            <TemplatesPanel onApply={applyTemplate} buildSnapshot={buildSnapshot} />

            <ExportHistoryPanel />

            <details className="group rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-brand-400" />
                  <span className="text-sm font-semibold text-text-primary">Scheduled reports</span>
                </div>
                <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border-subtle">
                <SchedulesPanel />
              </div>
            </details>
          </aside>
        </div>
      </div>

      {/* Drill-down side drawer */}
      <DrillDrawer
        open={drillOpen}
        title={drillTitle}
        subtitle={`${activeMeta?.label ?? ''} · ${from} → ${to}`}
        loading={drillLoading}
        rows={drillRows}
        count={drillCount}
        onClose={() => setDrillOpen(false)}
      />

      {/* Email modal */}
      {emailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur"
          onClick={(e) => { if (e.target === e.currentTarget) setEmailOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-gradient text-white">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Email this report</h3>
                  <p className="text-xs text-text-tertiary">
                    {activeMeta?.label} · {from} → {to} — CSV + Excel attached
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setEmailOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Recipients</span>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="ops@acme.com, hr@acme.com"
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60"
                />
                <span className="text-[11px] text-text-tertiary">Comma-separate multiple emails.</span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Subject (optional)</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={`${activeMeta?.label} report`}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border-subtle bg-surface-2/40 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendEmail}
                disabled={!emailRecipients.trim() || emailBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-brand-glow"
              >
                {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {emailBusy ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  delta,
  invertColor,
}: {
  label: string;
  value: string | number;
  delta?: number;
  /** For "Rejected" etc. where an increase is bad. */
  invertColor?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 px-4 py-3">
      <div className="text-2xl font-bold text-text-primary tabular-nums">{value}</div>
      <div className="flex items-center justify-between mt-0.5 gap-2">
        <div className="text-xs text-text-tertiary truncate">{label}</div>
        {typeof delta === 'number' && <DeltaChip pct={delta} invertColor={invertColor} small />}
      </div>
    </div>
  );
}

function DeltaChip({ pct, invertColor, small }: { pct: number; invertColor?: boolean; small?: boolean }) {
  const positive = pct > 0;
  const flat = pct === 0;
  const good = invertColor ? !positive : positive;
  const cls = flat
    ? 'bg-surface-2 text-text-tertiary'
    : good
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'bg-red-500/15 text-red-300';
  const Icon = flat ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded ${cls} ${
        small ? 'px-1.5 py-0 text-[10px]' : 'px-1.5 py-0.5 text-[11px]'
      } font-medium tabular-nums`}
      title={`${positive ? '+' : ''}${pct}% vs prior period`}
    >
      <Icon className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {Math.abs(pct)}%
    </span>
  );
}
