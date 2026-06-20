'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Shield, AlertCircle, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { useI18n } from '@/lib/i18n';

interface AuditEntry {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  status: number;
  ipAddress: string | null;
  durationMs: number;
  createdAt: string;
}

function statusColor(status: number) {
  if (status >= 500) return 'text-red-400 bg-red-500/10';
  if (status >= 400) return 'text-yellow-400 bg-yellow-500/10';
  if (status >= 300) return 'text-blue-400 bg-blue-500/10';
  return 'text-green-400 bg-green-500/10';
}

function methodColor(m: string) {
  switch (m) {
    case 'POST':
      return 'bg-blue-500/10 text-blue-300';
    case 'PUT':
      return 'bg-orange-500/10 text-orange-300';
    case 'PATCH':
      return 'bg-amber-500/10 text-amber-300';
    case 'DELETE':
      return 'bg-red-500/10 text-red-300';
    default:
      return 'bg-zinc-500/10 text-zinc-300';
  }
}

export default function AuditPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await apiGet<AuditEntry[]>('/admin/audit');
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load audit log');
      }
    }
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  function handleExport() {
    if (!rows || rows.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`vms-audit-${date}.csv`, rows as any);
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Shield className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">{t('audit.title')}</h2>
            </div>
            <p className="text-zinc-400 mt-2">
              Every write request to the API — actor, method, path, response status, duration.
              Auto-refreshes every 20 s.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!rows || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {user?.role !== 'SUPER_ADMIN' && user?.role !== 'ORG_ADMIN' && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            This page requires SUPER_ADMIN or ORG_ADMIN role — the API will return 403 if your
            role is something else.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!rows && <div className="p-6 text-zinc-500">Loading…</div>}
          {rows && rows.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No audit entries yet. Trigger any write (create a visit, contractor, worker…)
              and refresh.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="text-left p-4">When</th>
                    <th className="text-left p-4">Actor</th>
                    <th className="text-left p-4">Method</th>
                    <th className="text-left p-4">Path</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Duration</th>
                    <th className="text-left p-4">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="p-4 text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <p className="text-white">{r.actorEmail ?? 'anonymous'}</p>
                        {r.actorRole && (
                          <p className="text-xs text-zinc-500">{r.actorRole}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-mono ${methodColor(r.method)}`}>
                          {r.method}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-zinc-300">{r.path}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-mono ${statusColor(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-zinc-400">{r.durationMs}ms</td>
                      <td className="p-4 text-xs font-mono text-zinc-500">
                        {r.ipAddress ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
