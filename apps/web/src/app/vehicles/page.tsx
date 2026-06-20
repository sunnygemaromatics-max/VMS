'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Car, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { useI18n } from '@/lib/i18n';

interface VehicleRow {
  id: string;
  vehicleNumber: string;
  status: string;
  expectedEntry: string;
  actualEntry: string | null;
  actualExit: string | null;
  visitor: { fullName: string; phone: string; company: string | null };
  branch: { name: string };
}

function statusColor(s: string) {
  switch (s) {
    case 'CHECKED_IN':
      return 'bg-blue-500/10 text-blue-300';
    case 'CHECKED_OUT':
      return 'bg-zinc-500/10 text-zinc-300';
    case 'APPROVED':
      return 'bg-green-500/10 text-green-300';
    case 'PENDING':
      return 'bg-yellow-500/10 text-yellow-300';
    default:
      return 'bg-red-500/10 text-red-300';
  }
}

export default function VehiclesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<VehicleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function load() {
      try {
        setRows(await apiGet<VehicleRow[]>('/visitors/vehicles'));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load vehicles');
      }
    }
    load();
    const t = setInterval(load, 15_000);
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

  const insideNow = rows?.filter((r) => r.actualEntry && !r.actualExit).length ?? 0;

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Car className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">{t('vehicles.title')}</h2>
            </div>
            <p className="text-zinc-400 mt-2">
              Vehicles attached to visits. {insideNow > 0 && `${insideNow} currently on premises.`}
            </p>
          </div>
          {rows && rows.length > 0 && (
            <button
              onClick={() =>
                downloadCSV(`vms-vehicles-${new Date().toISOString().slice(0, 10)}.csv`, rows as any)
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!rows && <div className="p-6 text-zinc-500">Loading…</div>}
          {rows && rows.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No vehicle entries recorded yet. Add a vehicle number when creating a visit.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="text-left p-4">Vehicle</th>
                    <th className="text-left p-4">Visitor</th>
                    <th className="text-left p-4">Branch</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">In</th>
                    <th className="text-left p-4">Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-mono font-medium">{r.vehicleNumber}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white">{r.visitor?.fullName ?? '—'}</p>
                        <p className="text-xs text-zinc-500">
                          {r.visitor?.company || r.visitor?.phone || ''}
                        </p>
                      </td>
                      <td className="p-4 text-zinc-300">{r.branch?.name ?? '—'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${statusColor(r.status)}`}>
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-zinc-400">
                        {r.actualEntry ? new Date(r.actualEntry).toLocaleString() : '—'}
                      </td>
                      <td className="p-4 text-xs text-zinc-400">
                        {r.actualExit ? new Date(r.actualExit).toLocaleString() : '—'}
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
