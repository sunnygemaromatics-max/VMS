'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ShieldAlert, Clock, CheckCircle2, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Column,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Textarea,
  useToast,
} from '@vms/ui';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { apiGet, apiPost } from '@/lib/api';

interface Incident {
  id: string;
  branchId: string | null;
  severity: number;
  kind: string;
  title: string;
  summary: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  _count?: { alerts: number };
}

interface IncidentDetail extends Incident {
  alerts: Array<{
    id: string;
    type: string;
    severity: number;
    actorName: string | null;
    status: string;
    raisedAt: string;
    evidence: Record<string, unknown> | null;
  }>;
  timeline: Array<{
    id: string;
    ts: string;
    kind: string;
    actorName: string | null;
    payload: Record<string, unknown> | null;
  }>;
}

const SEVERITY_TONE = (s: number) =>
  s >= 5 ? 'critical' : s >= 4 ? 'danger' : s >= 3 ? 'warning' : 'info';

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'info'> = {
  open: 'warning',
  investigating: 'info',
  resolved: 'success',
  false_positive: 'neutral',
};

const STATUS_FILTERS = ['open', 'investigating', 'resolved', 'all'];

export default function IncidentsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [status, setStatus] = useState('open');
  const [selected, setSelected] = useState<IncidentDetail | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      const q = status === 'all' ? '' : `?status=${status}`;
      setIncidents(await apiGet<Incident[]>(`/incidents${q}`));
    } catch (e) {
      toast.error('Failed to load incidents', e instanceof Error ? e.message : undefined);
    }
  }, [status, toast]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  async function openDetail(id: string) {
    try {
      setSelected(await apiGet<IncidentDetail>(`/incidents/${id}`));
      setResolution('');
    } catch (e) {
      toast.error('Failed to open incident', e instanceof Error ? e.message : undefined);
    }
  }

  async function act(path: string, body?: unknown, successMsg?: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPost(`/incidents/${selected.id}/${path}`, body ?? {});
      if (successMsg) toast.success(successMsg);
      await openDetail(selected.id);
      await load();
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Incident>[] = useMemo(
    () => [
      {
        key: 'severity',
        header: 'Sev',
        width: '64px',
        align: 'center',
        cell: (i) => (
          <Badge tone={SEVERITY_TONE(i.severity)} mono>
            {i.severity}
          </Badge>
        ),
      },
      {
        key: 'title',
        header: 'Incident',
        cell: (i) => (
          <div className="min-w-0">
            <p className="text-text-primary font-medium truncate">{i.title}</p>
            <p className="text-xs text-text-tertiary font-mono">{i.kind}</p>
          </div>
        ),
      },
      {
        key: 'alerts',
        header: 'Alerts',
        align: 'center',
        width: '80px',
        priority: 2,
        cell: (i) => <Badge tone="brand" mono>{i._count?.alerts ?? 0}</Badge>,
      },
      {
        key: 'status',
        header: 'Status',
        width: '130px',
        cell: (i) => (
          <Badge tone={STATUS_TONE[i.status] ?? 'neutral'}>
            {i.status.replace('_', ' ')}
          </Badge>
        ),
      },
      {
        key: 'openedAt',
        header: 'Opened',
        type: 'relativeTime',
        priority: 3,
        width: '120px',
      },
    ],
    [],
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-tertiary text-sm">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-brand-400" />
              <h1 className="text-xl font-semibold text-text-primary">Incidents</h1>
              {incidents && <Badge tone="brand" mono>{incidents.length}</Badge>}
            </div>
            <p className="text-sm text-text-tertiary mt-1">
              AI-detected security events. Acknowledge, investigate, resolve.
            </p>
          </div>
        </div>

        <DataTable<Incident>
          rows={incidents}
          columns={columns}
          rowKey={(i) => i.id}
          loading={!incidents}
          onRowClick={(i) => openDetail(i.id)}
          maxHeight="calc(100vh - 260px)"
          toolbar={
            <div className="flex items-center gap-1 bg-surface-1 border border-border-subtle rounded-md p-0.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-2.5 h-6 rounded text-xs font-medium capitalize transition-colors ${
                    status === s ? 'bg-brand-600 text-white' : 'text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          }
          empty={
            <EmptyState
              icon={<CheckCircle2 />}
              title="No incidents"
              description={
                status === 'open'
                  ? 'All clear — no open incidents right now.'
                  : 'Nothing matches this filter.'
              }
            />
          }
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={560}
        title={selected?.title}
        subtitle={selected ? `${selected.kind} · severity ${selected.severity}` : undefined}
        trailing={
          selected && (
            <Badge tone={STATUS_TONE[selected.status] ?? 'neutral'}>
              {selected.status.replace('_', ' ')}
            </Badge>
          )
        }
        footer={
          selected &&
          selected.status !== 'resolved' &&
          selected.status !== 'false_positive' ? (
            <div className="flex flex-col gap-2">
              <Field label="Resolution note">
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="What happened and how it was handled…"
                  rows={2}
                />
              </Field>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" loading={busy} onClick={() => act('acknowledge', {}, 'Acknowledged')}>
                  Acknowledge
                </Button>
                <Button size="sm" variant="ghost" loading={busy} onClick={() => act('escalate', {}, 'Escalated')}>
                  Escalate
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy}
                  onClick={() => act('resolve', { resolution: resolution || 'Dismissed', falsePositive: true }, 'Marked false positive')}
                >
                  False positive
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  loading={busy}
                  disabled={!resolution.trim()}
                  onClick={() => act('resolve', { resolution }, 'Resolved')}
                >
                  Resolve
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-5">
            <section>
              <h3 className="text-xs uppercase tracking-wider text-text-tertiary mb-2">
                Alerts ({selected.alerts.length})
              </h3>
              <div className="space-y-2">
                {selected.alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface-1 border border-border-subtle"
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        a.severity >= 4 ? 'text-danger' : 'text-warning'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-mono">{a.type}</p>
                      {a.actorName && (
                        <p className="text-xs text-text-secondary">{a.actorName}</p>
                      )}
                      <p className="text-[10px] text-text-tertiary font-mono mt-0.5">
                        {new Date(a.raisedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge tone={SEVERITY_TONE(a.severity)} mono>
                      {a.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wider text-text-tertiary mb-2">
                Timeline
              </h3>
              <ol className="space-y-2.5 border-l border-border-subtle pl-4">
                {selected.timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-brand-500" />
                    <p className="text-xs text-text-primary font-mono">{t.kind}</p>
                    {t.actorName && (
                      <p className="text-xs text-text-secondary">{t.actorName}</p>
                    )}
                    <p className="text-[10px] text-text-tertiary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(t.ts).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Drawer>
    </main>
  );
}
