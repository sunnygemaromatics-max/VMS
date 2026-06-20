'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Building2, Plus } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Branch {
  id: string;
  name: string;
  location: string;
  organizationId: string;
}

export default function AdminBranchesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setBranches(await apiGet<Branch[]>('/admin/branches'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }
  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/admin/branches', form);
      setForm({ name: '', location: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Building2 className="w-7 h-7 text-brand-400" />
              <h2 className="text-3xl font-bold text-white">{t('adminBranches.title')}</h2>
              {branches && (
                <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-sm">
                  {branches.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">{t('adminBranches.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            <Plus className="w-4 h-4" /> {t('adminBranches.new')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={create}
            className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              required
              placeholder={`${t('common.name')} (e.g. HQ, Plant 1)`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <input
              required
              placeholder={t('adminBranches.location')}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? t('common.loading') : t('action.save')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                {t('action.cancel')}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!branches && <p className="text-zinc-500">{t('common.loading')}</p>}
          {branches && branches.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-500 text-sm md:col-span-2">
              {t('adminBranches.empty')}
            </div>
          )}
          {branches?.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-brand-400" />
                <h3 className="text-white font-semibold">{b.name}</h3>
              </div>
              <p className="text-sm text-zinc-400">{b.location}</p>
              <p className="text-[10px] text-zinc-600 mt-2 font-mono break-all">
                {b.id}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
