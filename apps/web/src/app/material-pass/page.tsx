'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Package, Plus, ArrowDownLeft, ArrowUpRight, Search, Download } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { useI18n } from '@/lib/i18n';

interface Visit {
  id: string;
  visitor?: { fullName: string; company: string | null } | null;
  /** /visitors/visits does NOT include the branch relation; guard everywhere. */
  branch?: { name: string } | null;
  status: string;
}
interface Pass {
  id: string;
  visitId: string;
  direction: 'IN' | 'OUT';
  description: string;
  quantity: number;
  serialNumber: string | null;
  recordedBy: string | null;
  createdAt: string;
  visit?: {
    id: string;
    visitor?: { fullName: string; company: string | null } | null;
    branch?: { name: string } | null;
  } | null;
}

export default function MaterialPassPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    visitId: '',
    direction: 'IN' as 'IN' | 'OUT',
    description: '',
    quantity: 1,
    serialNumber: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      const [p, v] = await Promise.all([
        apiGet<Pass[]>('/material-pass'),
        apiGet<Visit[]>('/visitors/visits'),
      ]);
      setPasses(p);
      setVisits(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }
  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/material-pass', form);
      setForm({ visitId: '', direction: 'IN', description: '', quantity: 1, serialNumber: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!passes) return null;
    const q = search.trim().toLowerCase();
    if (!q) return passes;
    return passes.filter(
      (p) =>
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
        (p.visit?.visitor?.fullName?.toLowerCase().includes(q) ?? false),
    );
  }, [passes, search]);

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
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Package className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">{t('materials.title')}</h2>
              {passes && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                  {passes.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">
              Log items that visitors bring in or take out at the gate.
            </p>
          </div>
          <div className="flex gap-2">
            {filtered && filtered.length > 0 && (
              <button
                onClick={() =>
                  downloadCSV(
                    `vms-material-pass-${new Date().toISOString().slice(0, 10)}.csv`,
                    filtered.map((p) => ({
                      direction: p.direction,
                      description: p.description,
                      quantity: p.quantity,
                      serialNumber: p.serialNumber,
                      visitor: p.visit?.visitor?.fullName ?? '',
                      branch: p.visit?.branch?.name ?? '',
                      recordedBy: p.recordedBy,
                      createdAt: p.createdAt,
                    })) as any,
                  )
                }
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Plus className="w-4 h-4" /> New pass
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Visit *</label>
              <select
                required
                value={form.visitId}
                onChange={(e) => setForm({ ...form, visitId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Visit —</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.visitor?.fullName ?? 'Unknown visitor'}
                    {v.visitor?.company ? ` (${v.visitor.company})` : ''}
                    {v.branch?.name ? ` · ${v.branch.name}` : ''} · {v.status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Direction *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, direction: 'IN' })}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg ${
                    form.direction === 'IN'
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-zinc-300'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" /> IN
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, direction: 'OUT' })}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg ${
                    form.direction === 'OUT'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-zinc-300'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" /> OUT
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Quantity *</label>
              <input
                type="number"
                min={1}
                max={999}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value || '1', 10) })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description *</label>
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Laptop, sample box, returnable equipment…"
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Serial number (optional)</label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting || !form.visitId}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save pass'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description / serial / visitor…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!passes && <div className="p-6 text-zinc-500">Loading…</div>}
          {filtered && filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              {search ? 'No passes match.' : 'No material passes yet.'}
            </div>
          )}
          {filtered && filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="text-left p-4">When</th>
                  <th className="text-left p-4">Direction</th>
                  <th className="text-left p-4">Item</th>
                  <th className="text-left p-4">Qty</th>
                  <th className="text-left p-4">Serial</th>
                  <th className="text-left p-4">Visitor</th>
                  <th className="text-left p-4">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="p-4 text-xs text-zinc-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      {p.direction === 'IN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-300 text-xs">
                          <ArrowDownLeft className="w-3 h-3" /> IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 text-orange-300 text-xs">
                          <ArrowUpRight className="w-3 h-3" /> OUT
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-200">{p.description}</td>
                    <td className="p-4 font-mono text-zinc-300">{p.quantity}</td>
                    <td className="p-4 font-mono text-xs text-zinc-400">
                      {p.serialNumber || '—'}
                    </td>
                    <td className="p-4 text-zinc-300">
                      {p.visit?.visitor?.fullName ?? '—'}
                      {p.visit?.visitor?.company && (
                        <span className="text-xs text-zinc-500"> · {p.visit.visitor.company}</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-zinc-500">{p.recordedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
