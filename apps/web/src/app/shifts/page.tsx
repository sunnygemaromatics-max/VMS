'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Clock, Plus, UserPlus, X, Users } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Branch { id: string; name: string }
interface Worker { id: string; fullName: string; skillCategory: string; contractor?: { companyName: string } }
interface Shift {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  branch: { name: string };
  _count: { assignments: number };
}
interface Assignment {
  id: string;
  worker: { id: string; fullName: string; phone: string; skillCategory: string; contractor?: { companyName: string } };
}

export default function ShiftsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ branchId: '', name: 'Morning', startTime: '06:00', endTime: '14:00' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [pickWorker, setPickWorker] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      const [s, b, w] = await Promise.all([
        apiGet<Shift[]>('/shifts'),
        apiGet<Branch[]>('/admin/branches'),
        apiGet<Worker[]>('/admin/workers'),
      ]);
      setShifts(s);
      setBranches(b);
      setWorkers(w);
      if (b.length === 1 && !form.branchId) setForm((f) => ({ ...f, branchId: b[0].id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }
  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/shifts', form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadAssignments(shiftId: string) {
    try {
      const a = await apiGet<Assignment[]>(`/shifts/${shiftId}/assignments`);
      setAssignments((prev) => ({ ...prev, [shiftId]: a }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
    }
  }

  async function assign(shiftId: string) {
    const workerId = pickWorker[shiftId];
    if (!workerId) return;
    try {
      await apiPost(`/shifts/${shiftId}/assign`, { workerId });
      setPickWorker((p) => ({ ...p, [shiftId]: '' }));
      await loadAssignments(shiftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    }
  }

  async function unassign(shiftId: string, workerId: string) {
    try {
      await apiDelete(`/shifts/${shiftId}/assign/${workerId}`);
      await loadAssignments(shiftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unassign failed');
    }
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
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Clock className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">{t('shifts.title')}</h2>
              {shifts && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                  {shifts.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">
              {t('shifts.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="w-4 h-4" /> {t('shifts.new')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createShift}
            className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Branch *</label>
              <select
                required
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
              >
                <option value="">— Branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Morning"
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Start</label>
                <input
                  required
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">End</label>
                <input
                  required
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                {busy ? 'Saving…' : 'Save shift'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {!shifts && <p className="text-zinc-500">Loading…</p>}
          {shifts && shifts.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-500 text-sm">
              No shifts yet. Click "New shift".
            </div>
          )}
          {shifts?.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={async () => {
                    setExpanded(isOpen ? null : s.id);
                    if (!isOpen && !assignments[s.id]) await loadAssignments(s.id);
                  }}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5"
                >
                  <div className="flex items-center gap-4 text-left">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-zinc-400">
                        {s.branch.name} · {s.startTime} – {s.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      <Users className="w-3 h-3 inline mr-1" />
                      {s._count.assignments} workers
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 p-4 bg-slate-950/40">
                    <div className="flex gap-2 mb-3">
                      <select
                        value={pickWorker[s.id] || ''}
                        onChange={(e) => setPickWorker((p) => ({ ...p, [s.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded bg-slate-900 border border-white/10 text-sm text-white"
                      >
                        <option value="">— Pick a worker —</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.fullName} ({w.skillCategory}
                            {w.contractor && ` · ${w.contractor.companyName}`})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => assign(s.id)}
                        disabled={!pickWorker[s.id]}
                        className="flex items-center gap-1.5 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" /> Assign
                      </button>
                    </div>

                    {(assignments[s.id] || []).length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No workers assigned.</p>
                    ) : (
                      <ul className="divide-y divide-white/5">
                        {(assignments[s.id] || []).map((a) => (
                          <li key={a.id} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-white text-sm">{a.worker.fullName}</p>
                              <p className="text-xs text-zinc-500">
                                {a.worker.skillCategory}
                                {a.worker.contractor && ` · ${a.worker.contractor.companyName}`}
                              </p>
                            </div>
                            <button
                              onClick={() => unassign(s.id, a.worker.id)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                              title="Unassign"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
