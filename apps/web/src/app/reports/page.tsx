'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  HardHat,
  Search,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { downloadPDF } from '@/lib/pdf';
import { downloadXLSX } from '@/lib/xlsx';

type Branch = { id: string; name: string; location: string };
type Contractor = { id: string; companyName: string };

type GroupOption = { value: string; label: string };

type ReportKey =
  | 'visits'
  | 'workforce'
  | 'contractors'
  | 'branches'
  | 'users'
  | 'materials'
  | 'incidents'
  | 'audit'
  | 'vehicles'
  | 'gate-activity';

type ReportDefinition = {
  key: ReportKey;
  title: string;
  description: string;
  section: 'Operations' | 'Workforce' | 'Security' | 'Organization';
  endpoint: string;
  icon: typeof Users;
  defaultGroupBy?: string;
  groupByOptions?: GroupOption[];
  useBranch?: boolean;
  useContractor?: boolean;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  detail: string;
  detailEnabled?: boolean;
};

const TIME_GROUPS: GroupOption[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

const REPORTS: ReportDefinition[] = [
  {
    key: 'visits',
    title: 'Visitor activity',
    description: 'Track visit volume, approvals, rejections and footfall.',
    section: 'Operations',
    endpoint: '/reports/visits',
    icon: Users,
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'Branch' },
      { value: 'host', label: 'Host' },
      { value: 'status', label: 'Status' },
      { value: 'company', label: 'Company' },
    ],
    useBranch: true,
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Best for daily visitor movement, approvals and host activity.',
    detailEnabled: true,
  },
  {
    key: 'gate-activity',
    title: 'Gate movement',
    description: 'Combined visitor and worker entry / exit trends.',
    section: 'Operations',
    endpoint: '/reports/gate-activity',
    icon: BarChart3,
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'hour', label: 'Hour of day' },
      { value: 'branch', label: 'Branch' },
    ],
    useBranch: true,
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Useful for security and shift planning around gate congestion.',
  },
  {
    key: 'vehicles',
    title: 'Vehicle log',
    description: 'See vehicle traffic by branch, plate and visitor company.',
    section: 'Operations',
    endpoint: '/reports/vehicles',
    icon: BarChart3,
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'Branch' },
      { value: 'vehicle', label: 'Vehicle' },
      { value: 'company', label: 'Company' },
      { value: 'status', label: 'Status' },
    ],
    useBranch: true,
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Use this for vehicle-wise audit and movement trends.',
  },
  {
    key: 'materials',
    title: 'Material movement',
    description: 'Inbound and outbound gate-pass quantities with drillable rows.',
    section: 'Operations',
    endpoint: '/reports/materials',
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'Branch' },
      { value: 'direction', label: 'Direction' },
    ],
    icon: BarChart3,
    useBranch: true,
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Helpful for stores, dispatch and material gate records.',
    detailEnabled: true,
  },
  {
    key: 'workforce',
    title: 'Workforce hours',
    description: 'Attendance, total hours, overtime and estimated pay.',
    section: 'Workforce',
    endpoint: '/reports/workforce',
    icon: HardHat,
    defaultGroupBy: 'contractor',
    groupByOptions: [
      { value: 'contractor', label: 'Contractor' },
      { value: 'worker', label: 'Worker' },
      { value: 'branch', label: 'Branch' },
      { value: 'skill', label: 'Skill' },
      ...TIME_GROUPS,
    ],
    useBranch: true,
    useContractor: true,
    defaultSortKey: 'totalHours',
    defaultSortDir: 'desc',
    detail: 'Best for contractor billing, worker utilization and overtime review.',
    detailEnabled: true,
  },
  {
    key: 'contractors',
    title: 'Contractor summary',
    description: 'Compliance, active workers, hours and estimated pay by contractor.',
    section: 'Workforce',
    endpoint: '/reports/contractors',
    icon: Building2,
    useContractor: true,
    defaultSortKey: 'contractor',
    defaultSortDir: 'asc',
    detail: 'This is the simplest contractor-wise export for client sharing.',
    detailEnabled: true,
  },
  {
    key: 'users',
    title: 'Hosts and users',
    description: 'Hosted visits and outcomes by user.',
    section: 'Workforce',
    endpoint: '/reports/users',
    icon: Users,
    useBranch: true,
    defaultSortKey: 'host',
    defaultSortDir: 'asc',
    detail: 'Useful for host productivity and response tracking.',
    detailEnabled: true,
  },
  {
    key: 'incidents',
    title: 'Security incidents',
    description: 'Incident volume, severity and resolution status.',
    section: 'Security',
    endpoint: '/reports/incidents',
    icon: ShieldAlert,
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'Branch' },
      { value: 'kind', label: 'Type' },
      { value: 'status', label: 'Status' },
      { value: 'severity', label: 'Severity' },
    ],
    useBranch: true,
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Good for management review and compliance discussions.',
  },
  {
    key: 'audit',
    title: 'API audit',
    description: 'Request counts, errors and response latency patterns.',
    section: 'Security',
    endpoint: '/reports/audit',
    icon: ShieldAlert,
    defaultGroupBy: 'day',
    groupByOptions: [
      ...TIME_GROUPS,
      { value: 'actor', label: 'User' },
      { value: 'role', label: 'Role' },
      { value: 'method', label: 'Method' },
      { value: 'status', label: 'Status class' },
    ],
    defaultSortKey: 'group',
    defaultSortDir: 'asc',
    detail: 'Internal diagnostics for admins and security owners.',
  },
  {
    key: 'branches',
    title: 'Branch summary',
    description: 'Visits, worker hours and headcount per branch.',
    section: 'Organization',
    endpoint: '/reports/branches',
    icon: Building2,
    defaultSortKey: 'branch',
    defaultSortDir: 'asc',
    detail: 'Best for comparing sites and preparing management summaries.',
    detailEnabled: true,
  },
];

const REPORT_BY_KEY = Object.fromEntries(REPORTS.map((report) => [report.key, report])) as Record<ReportKey, ReportDefinition>;
const SECTIONS = ['Operations', 'Workforce', 'Security', 'Organization'] as const;

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function buildPresets() {
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return [
    { key: '7d', label: 'Last 7 days', from: iso(daysAgo(7)), to: iso(today) },
    { key: '30d', label: 'Last 30 days', from: iso(daysAgo(30)), to: iso(today) },
    { key: '90d', label: 'Last 90 days', from: iso(daysAgo(90)), to: iso(today) },
    { key: 'thisMonth', label: 'This month', from: iso(monthStart), to: iso(today) },
  ];
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function toDisplay(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function inferSortKey(rows: Record<string, unknown>[], report: ReportDefinition) {
  if (report.defaultSortKey && rows[0] && report.defaultSortKey in rows[0]) return report.defaultSortKey;
  const first = rows[0];
  if (!first) return '';
  return Object.keys(first)[0] ?? '';
}

function getDetailValue(report: ReportDefinition, row: Record<string, unknown>) {
  const candidates =
    report.key === 'contractors'
      ? ['contractor', 'group']
      : report.key === 'users'
        ? ['host', 'group']
        : report.key === 'branches'
          ? ['branch', 'group']
          : ['group', 'contractor', 'host', 'branch', 'worker', 'direction', 'status'];

  for (const key of candidates) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') return String(value);
  }
  return '';
}

export default function ReportsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const presets = useMemo(buildPresets, []);

  const [activeReportKey, setActiveReportKey] = useState<ReportKey>('contractors');
  const [activePreset, setActivePreset] = useState(presets[1].key);
  const [from, setFrom] = useState(presets[1].from);
  const [to, setTo] = useState(presets[1].to);
  const [branchId, setBranchId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState(REPORT_BY_KEY.contractors.defaultGroupBy || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{ value: string; count: number; rows: Record<string, unknown>[] } | null>(null);

  const activeReport = REPORT_BY_KEY[activeReportKey];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<Branch[]>('/admin/branches').then(setBranches).catch(() => setBranches([]));
    apiGet<Contractor[]>('/admin/contractors').then(setContractors).catch(() => setContractors([]));
  }, [isAuthenticated]);

  useEffect(() => {
    setSortKey('');
    setSortDir(activeReport.defaultSortDir || 'asc');
    setGroupBy(activeReport.defaultGroupBy || activeReport.groupByOptions?.[0]?.value || '');
    setSearchTerm('');
    setDetailData(null);
    setDetailError(null);
  }, [activeReport]);

  async function loadReports() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const commonParams = {
        from,
        to,
        branchId: activeReport.useBranch ? branchId : undefined,
        contractorId: activeReport.useContractor ? contractorId : undefined,
        groupBy: activeReport.groupByOptions?.length ? groupBy : undefined,
      };

      const [report, overviewData] = await Promise.all([
        apiGet<any>(`${activeReport.endpoint}${buildQuery(commonParams)}`),
        apiGet<any>(`/reports/overview${buildQuery({ from, to, branchId })}`),
      ]);

      setReportData(report);
      setOverview(overviewData);
    } catch (err) {
      setReportData(null);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeReportKey, from, to, branchId, contractorId, groupBy]);

  const rows = useMemo<Record<string, unknown>[]>(() => reportData?.rows ?? [], [reportData]);
  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  const effectiveSortKey = sortKey || inferSortKey(rows, activeReport);

  useEffect(() => {
    setVisibleColumns(columns);
  }, [columns]);

  const sortedRows = useMemo(() => {
    if (!effectiveSortKey) return rows;
    return [...rows].sort((left, right) => {
      const a = left[effectiveSortKey];
      const b = right[effectiveSortKey];

      if (typeof a === 'number' && typeof b === 'number') {
        return sortDir === 'asc' ? a - b : b - a;
      }

      const aText = String(a ?? '');
      const bText = String(b ?? '');
      return sortDir === 'asc'
        ? aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' })
        : bText.localeCompare(aText, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [effectiveSortKey, rows, sortDir]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sortedRows;
    return sortedRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }, [searchTerm, sortedRows]);

  const tableColumns = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column)),
    [columns, visibleColumns],
  );

  const summaryCards = useMemo(() => {
    const totals = reportData?.totals ?? {};
    return Object.entries(totals)
      .slice(0, 6)
      .map(([key, value]) => ({ label: humanize(key), value: toDisplay(value) }));
  }, [reportData]);

  function applyPreset(key: string, fromValue: string, toValue: string) {
    setActivePreset(key);
    setFrom(fromValue);
    setTo(toValue);
  }

  function handleSort(column: string) {
    if (effectiveSortKey === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column);
    if (typeof rows[0]?.[column] === 'number') {
      setSortDir('desc');
    } else {
      setSortDir('asc');
    }
  }

  function toggleColumn(column: string) {
    setVisibleColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  async function loadDetail(row: Record<string, unknown>) {
    const value = getDetailValue(activeReport, row);
    if (!value) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await apiGet<any>(
        `/reports/${activeReport.key}/detail${buildQuery({
          from,
          to,
          branchId: activeReport.useBranch ? branchId : undefined,
          contractorId: activeReport.useContractor ? contractorId : undefined,
          groupBy: activeReport.groupByOptions?.length ? groupBy : undefined,
          value,
        })}`,
      );
      setDetailData({
        value,
        count: detail?.count ?? 0,
        rows: detail?.rows ?? [],
      });
    } catch (err) {
      setDetailData(null);
      setDetailError(err instanceof Error ? err.message : 'Failed to load detailed rows');
    } finally {
      setDetailLoading(false);
    }
  }

  function exportRows(format: 'csv' | 'xlsx' | 'pdf') {
    if (!filteredRows.length) return;
    const filename = `gem-${activeReport.key}-${from}_${to}`;
    if (format === 'csv') {
      downloadCSV(`${filename}.csv`, filteredRows as Record<string, any>[]);
      return;
    }
    if (format === 'xlsx') {
      downloadXLSX(`${filename}.xlsx`, [{ name: activeReport.title, rows: filteredRows as Record<string, any>[] }]);
      return;
    }
    downloadPDF(
      `${filename}.pdf`,
      {
        title: activeReport.title,
        subtitle: activeReport.description,
        filters: [
          { label: 'Range', value: `${from} → ${to}` },
          ...(groupBy ? [{ label: 'Grouped by', value: activeReport.groupByOptions?.find((item) => item.value === groupBy)?.label ?? groupBy }] : []),
          ...(branchId ? [{ label: 'Branch', value: branches.find((item) => item.id === branchId)?.name ?? branchId }] : []),
          ...(contractorId
            ? [{ label: 'Contractor', value: contractors.find((item) => item.id === contractorId)?.companyName ?? contractorId }]
            : []),
          ...(searchTerm.trim() ? [{ label: 'Search', value: searchTerm.trim() }] : []),
        ],
        kpis: summaryCards,
        generatedBy: user?.fullName || user?.email,
        brand: 'Gem Aromatics',
      },
      filteredRows as Record<string, any>[],
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="min-h-screen bg-surface-0 flex items-center justify-center text-text-tertiary">
        Loading reports…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-0">
      <DashboardHeader />
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-xs font-medium mb-3">
                <BarChart3 className="w-3.5 h-3.5" />
                Reports Center
              </div>
              <h1 className="text-2xl font-semibold text-text-primary">Simple, export-ready reporting</h1>
              <p className="text-sm text-text-secondary mt-2 max-w-3xl">
                Pick a report, slice it by site, contractor, user, time, or status, inspect the table,
                then download the exact filtered view as CSV, Excel, or PDF. The older reports page is preserved in
                {' '}<code>ReportsWorkbenchBackup.tsx</code>{' '}as a fallback.
              </p>
            </div>
            <button
              type="button"
              onClick={loadReports}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-3"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Filter className="w-4 h-4 text-brand-400" />
            Filters
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key, preset.from, preset.to)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === preset.key
                    ? 'bg-brand-gradient text-white'
                    : 'bg-surface-2 border border-border-subtle text-text-secondary hover:bg-surface-3'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-tertiary">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setActivePreset('custom');
                  setFrom(event.target.value);
                }}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-tertiary">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setActivePreset('custom');
                  setTo(event.target.value);
                }}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-tertiary">Branch</span>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                disabled={!activeReport.useBranch}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-40"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} — {branch.location}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-tertiary">Contractor</span>
              <select
                value={contractorId}
                onChange={(event) => setContractorId(event.target.value)}
                disabled={!activeReport.useContractor}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-40"
              >
                <option value="">All contractors</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.companyName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-tertiary">Group by</span>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value)}
                disabled={!activeReport.groupByOptions?.length}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-40"
              >
                {!activeReport.groupByOptions?.length ? <option value="">No grouping options</option> : null}
                {activeReport.groupByOptions?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <div className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1">Current view</div>
                <div className="text-sm text-text-primary">{activeReport.title}</div>
              </div>
            </div>
          </div>
        </section>

        {overview?.kpis ? (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total visits" value={overview.kpis.totalVisits} />
            <StatCard label="Checked in" value={overview.kpis.checkedInVisits} />
            <StatCard label="Workers on site" value={overview.kpis.uniqueWorkersOnSite} />
            <StatCard label="Avg compliance" value={overview.kpis.avgComplianceScore != null ? `${overview.kpis.avgComplianceScore}%` : '—'} />
          </section>
        ) : null}

        {SECTIONS.map((section) => {
          const items = REPORTS.filter((report) => report.section === section);
          return (
            <section key={section} className="space-y-3">
              <div className="text-sm font-semibold text-text-primary">{section}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((report) => {
                  const Icon = report.icon;
                  const active = report.key === activeReportKey;
                  return (
                    <button
                      key={report.key}
                      type="button"
                      onClick={() => setActiveReportKey(report.key)}
                      className={`text-left rounded-2xl border p-4 transition-colors ${
                        active
                          ? 'border-brand-500/40 bg-brand-500/10'
                          : 'border-border-subtle bg-surface-1 hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{report.title}</div>
                          <div className="text-xs text-text-secondary mt-1">{report.description}</div>
                          <div className="text-[11px] text-text-tertiary mt-2">{report.detail}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
          <div className="p-5 border-b border-border-subtle flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-text-primary">{activeReport.title}</div>
              <div className="text-sm text-text-secondary mt-1">{activeReport.description}</div>
              <div className="text-xs text-text-tertiary mt-2">
                Range: {from} → {to}
                {groupBy ? ` · Grouped by: ${activeReport.groupByOptions?.find((item) => item.value === groupBy)?.label ?? groupBy}` : ''}
                {branchId ? ` · Branch: ${branches.find((branch) => branch.id === branchId)?.name ?? branchId}` : ''}
                {contractorId ? ` · Contractor: ${contractors.find((contractor) => contractor.id === contractorId)?.companyName ?? contractorId}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2">
                <Search className="w-4 h-4 text-text-tertiary" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search current report"
                  className="bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary w-44"
                />
              </div>
              <button
                type="button"
                onClick={() => exportRows('csv')}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportRows('xlsx')}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportRows('pdf')}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-gradient text-white disabled:opacity-40"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

          {summaryCards.length ? (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 p-5 border-b border-border-subtle bg-surface-2/40">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border-subtle bg-surface-1 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-text-tertiary">{card.label}</div>
                  <div className="text-lg font-semibold text-text-primary mt-1">{card.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {columns.length ? (
            <div className="p-5 border-b border-border-subtle bg-surface-2/30 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <SlidersHorizontal className="w-4 h-4 text-brand-400" />
                  View controls
                </div>
                <div className="text-xs text-text-tertiary">
                  Showing {filteredRows.length} of {rows.length} rows
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map((column) => {
                  const active = visibleColumns.includes(column);
                  return (
                    <button
                      key={column}
                      type="button"
                      onClick={() => toggleColumn(column)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        active
                          ? 'border-brand-500/40 bg-brand-500/10 text-brand-200'
                          : 'border-border-subtle bg-surface-1 text-text-secondary'
                      }`}
                    >
                      {humanize(column)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="p-5 text-sm text-red-300 bg-red-500/10 border-b border-red-500/20">{error}</div>
          ) : null}

          {loading ? (
            <div className="p-10 text-center text-text-tertiary">Loading report…</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-text-tertiary">
              No rows found for the selected filters.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2/90 border-b border-border-subtle">
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column} className="text-left px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort(column)}
                          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary"
                        >
                          <span>{humanize(column)}</span>
                          {effectiveSortKey === column ? (
                            <span className="text-[10px] uppercase text-brand-300">{sortDir}</span>
                          ) : null}
                        </button>
                      </th>
                    ))}
                    {activeReport.detailEnabled ? <th className="text-left px-4 py-3 whitespace-nowrap">Details</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredRows.map((row, index) => (
                    <tr key={index} className="hover:bg-surface-2/60">
                      {tableColumns.map((column) => (
                        <td key={column} className="px-4 py-3 whitespace-nowrap text-text-primary">
                          {toDisplay(row[column])}
                        </td>
                      ))}
                      {activeReport.detailEnabled ? (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => loadDetail(row)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View rows
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {activeReport.detailEnabled ? (
          <section className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
            <div className="p-5 border-b border-border-subtle">
              <div className="text-lg font-semibold text-text-primary">Detailed records</div>
              <div className="text-sm text-text-secondary mt-1">
                Open any grouped row above to inspect the underlying entries before export.
              </div>
            </div>
            {detailError ? (
              <div className="p-5 text-sm text-red-300 bg-red-500/10 border-b border-red-500/20">{detailError}</div>
            ) : null}
            {detailLoading ? (
              <div className="p-8 text-center text-text-tertiary">Loading detailed rows…</div>
            ) : !detailData ? (
              <div className="p-8 text-center text-text-tertiary">
                Select a row above to inspect location-wise, user-wise, contractor-wise or date-wise raw records.
              </div>
            ) : detailData.rows.length === 0 ? (
              <div className="p-8 text-center text-text-tertiary">No detailed rows found for {detailData.value}.</div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{detailData.value}</div>
                    <div className="text-xs text-text-tertiary">{detailData.count} detailed rows available</div>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    Drilldown is capped for on-screen review so the page stays fast.
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2/90 border-b border-border-subtle">
                      <tr>
                        {Object.keys(detailData.rows[0] ?? {}).map((column) => (
                          <th key={column} className="text-left px-4 py-3 whitespace-nowrap text-text-secondary">
                            {humanize(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {detailData.rows.map((row, index) => (
                        <tr key={index} className="hover:bg-surface-2/50">
                          {Object.keys(detailData.rows[0] ?? {}).map((column) => (
                            <td key={column} className="px-4 py-3 whitespace-nowrap text-text-primary">
                              {toDisplay(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className="text-2xl font-semibold text-text-primary mt-1">{value}</div>
    </div>
  );
}
