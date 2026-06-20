'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { ParkingCircle, Plus, Building2 } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Branch { id: string; name: string }
interface Slot {
  id: string;
  branchId: string;
  label: string;
  zone: string | null;
  isActive: boolean;
  branch: { name: string };
  visits: { id: string; visitor: { fullName: string }; vehicleNumber: string | null }[];
}

export default function ParkingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ branchId: '', label: '', zone: 'Visitor' });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      const [s, b] = await Promise.all([apiGet<Slot[]>('/parking'), apiGet<Branch[]>('/admin/branches')]);
      setSlots(s);
      setBranches(b);
      if (b.length === 1 && !form.branchId) setForm((f) => ({ ...f, branchId: b[0].id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }
  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/parking', form);
      setForm((f) => ({ ...f, label: '' }));
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    if (!slots) return [];
    const byBranch = new Map<string, { branch: string; slots: Slot[] }>();
    for (const s of slots) {
      if (!byBranch.has(s.branchId)) byBranch.set(s.branchId, { branch: s.branch?.name ?? 'Unknown branch', slots: [] });
      byBranch.get(s.branchId)!.slots.push(s);
    }
    return Array.from(byBranch.values());
  }, [slots]);

  const occupiedCount = slots?.filter((s) => s.visits.length > 0).length ?? 0;
  const totalCount = slots?.length ?? 0;

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
              <ParkingCircle className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">{t('parking.title')}</h2>
              {slots && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                  {occupiedCount}/{totalCount} occupied
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">
              {t('parking.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="w-4 h-4" /> {t('parking.new')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createSlot}
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
              <label className="block text-xs text-zinc-400 mb-1">Label * (e.g. A-12)</label>
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Zone</label>
              <select
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
              >
                <option value="Visitor">Visitor</option>
                <option value="Staff">Staff</option>
                <option value="Loading">Loading</option>
                <option value="VIP">VIP</option>
              </select>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                {busy ? 'Saving…' : 'Save slot'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Cancel</button>
            </div>
          </form>
        )}

        {!slots && <p className="text-zinc-500">Loading…</p>}
        {slots && slots.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-500 text-sm">
            No parking slots yet. Click "New slot" to add some.
          </div>
        )}

        <div className="space-y-8">
          {grouped.map(({ branch, slots: bs }) => (
            <div key={branch}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                  {branch}
                </h3>
                <span className="text-xs text-zinc-500">
                  {bs.filter((s) => s.visits.length > 0).length}/{bs.length} occupied
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {bs.map((slot) => {
                  const v = slot.visits[0];
                  const occupied = !!v;
                  return (
                    <div
                      key={slot.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        occupied
                          ? 'border-red-500/30 bg-red-500/10'
                          : 'border-green-500/20 bg-green-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-mono text-lg text-white">{slot.label}</p>
                        {slot.zone && (
                          <span className="text-[10px] text-zinc-500 uppercase">{slot.zone}</span>
                        )}
                      </div>
                      {occupied ? (
                        <>
                          <p className="text-xs text-white truncate">{v.visitor?.fullName ?? '—'}</p>
                          {v.vehicleNumber && (
                            <p className="text-xs text-red-300 font-mono truncate">
                              {v.vehicleNumber}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-green-400">Available</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
