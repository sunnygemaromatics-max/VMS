'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Plus, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Contractor {
  id: string;
  companyName: string;
  gstNumber: string;
  complianceScore: number;
  _count: { workers: number };
}

export default function ContractorsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ companyName: '', gstNumber: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setContractors(await apiGet<Contractor[]>('/admin/contractors'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contractors');
    }
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiPost('/admin/contractors', form);
      setForm({ companyName: '', gstNumber: '' });
      setShowAddForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  const colorFor = (score: number) =>
    score >= 85
      ? 'text-green-400 bg-green-500/10'
      : score >= 70
      ? 'text-yellow-400 bg-yellow-500/10'
      : 'text-red-400 bg-red-500/10';

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{t('contractors.title')}</h2>
            <p className="text-zinc-400">{t('contractors.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/workers"
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> View Workers
            </Link>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('contractors.add')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-8 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Company Name"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="GST Number"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                required
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setError('');
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!contractors && <p className="text-zinc-500">Loading…</p>}

        {contractors && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contractors.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-white/20 transition-colors"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white">{c.companyName}</h3>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">{c.gstNumber}</p>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Workers</p>
                    <p className="text-xl font-bold text-white">{c._count.workers}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-zinc-400">Compliance Score</p>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${colorFor(c.complianceScore)}`}>
                        {c.complianceScore >= 85 ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-semibold">{Math.round(c.complianceScore)}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.complianceScore >= 85 ? 'bg-green-500' : c.complianceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, c.complianceScore)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <Link
                  href={`/workers?contractorId=${c.id}`}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" /> View Workers
                </Link>
              </div>
            ))}
          </div>
        )}

        {contractors && contractors.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            No contractors yet. Click "Add Contractor" to get started.
          </div>
        )}
      </div>
    </main>
  );
}
