'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { CheckCircle, XCircle, Hourglass, Building2, User, Car, CheckSquare, Square } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';
import { VisitorAvatar } from '@/components/visitor-avatar';
import { useI18n } from '@/lib/i18n';

interface PendingVisit {
  id: string;
  purpose: string;
  expectedEntry: string;
  vehicleNumber: string | null;
  qrCodeToken: string;
  visitor: { id: string; fullName: string; phone: string; company: string | null };
  host: { fullName: string; email: string };
  branch: { name: string; location: string };
}

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<PendingVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setPending(await apiGet<PendingVisit[]>('/visitors/pending'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending visits');
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      load();
      const t = setInterval(load, 10_000);
      return () => clearInterval(t);
    }
  }, [isAuthenticated]);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusyId(id);
    setError(null);
    try {
      await apiPut(`/visitors/visit/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update visit');
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!pending) return;
    setSelected(
      selected.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)),
    );
  }

  async function bulkDecide(status: 'APPROVED' | 'REJECTED') {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      Array.from(selected).map((id) => apiPut(`/visitors/visit/${id}/status`, { status })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) setError(`${failed} of ${selected.size} failed to update`);
    setSelected(new Set());
    setBulkBusy(false);
    await load();
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Hourglass className="w-7 h-7 text-yellow-400" />
            <h2 className="text-3xl font-bold text-white">{t('approvals.title')}</h2>
            {pending && (
              <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium">
                {pending.length}
              </span>
            )}
          </div>
          <p className="text-zinc-400 mt-2">
            {t('approvals.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!pending && <p className="text-zinc-500">Loading…</p>}

        {pending && pending.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-zinc-300">No pending approvals — you're all caught up.</p>
          </div>
        )}

        {pending && pending.length > 0 && (
          <div className="mb-4 flex items-center gap-3 flex-wrap p-3 rounded-xl border border-white/10 bg-white/5">
            <button
              onClick={selectAll}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              {selected.size === pending.length ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selected.size === pending.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-zinc-500">
              {selected.size} selected
            </span>
            <div className="ml-auto flex gap-2">
              <button
                disabled={bulkBusy || selected.size === 0}
                onClick={() => bulkDecide('APPROVED')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve selected
              </button>
              <button
                disabled={bulkBusy || selected.size === 0}
                onClick={() => bulkDecide('REJECTED')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-medium"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject selected
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {pending?.map((v) => (
            <div
              key={v.id}
              className={`rounded-2xl border p-6 backdrop-blur-xl transition-colors ${
                selected.has(v.id)
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-yellow-500/20 bg-yellow-500/5'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <button
                  onClick={() => toggleSelect(v.id)}
                  className="mt-1 shrink-0 text-zinc-400 hover:text-blue-400"
                  title="Select for bulk action"
                >
                  {selected.has(v.id) ? (
                    <CheckSquare className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <VisitorAvatar visitorId={v.visitor.id} name={v.visitor.fullName} size={56} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{v.visitor.fullName}</p>
                  <p className="text-xs text-zinc-400">{v.visitor.phone}</p>
                  {v.visitor.company && (
                    <p className="text-xs text-zinc-400">{v.visitor.company}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1">Host</p>
                  <p className="font-semibold text-white">{v.host.fullName}</p>
                  <p className="text-xs text-zinc-400">{v.host.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Branch
                  </p>
                  <p className="font-semibold text-white">{v.branch.name}</p>
                  <p className="text-xs text-zinc-400">{v.branch.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Purpose</p>
                  <p className="text-zinc-300">{v.purpose}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Expected</p>
                  <p className="text-zinc-300">
                    {new Date(v.expectedEntry).toLocaleString()}
                  </p>
                </div>
                {v.vehicleNumber && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <Car className="w-3 h-3" /> Vehicle
                    </p>
                    <p className="text-zinc-300 font-mono">{v.vehicleNumber}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={() => decide(v.id, 'APPROVED')}
                  disabled={busyId === v.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => decide(v.id, 'REJECTED')}
                  disabled={busyId === v.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <span className="ml-auto text-xs text-zinc-500 self-center font-mono">
                  {v.qrCodeToken}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
