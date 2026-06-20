'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { UserPlus, ShieldCheck, ShieldOff, Building2, Users as UsersIcon } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Branch { id: string; name: string }
interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  branchId: string;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: string;
  branch: { name: string };
}

const ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'HR_MANAGER',
  'SECURITY_GUARD',
  'RECEPTIONIST',
  'CONTRACTOR_SUPERVISOR',
  'EMPLOYEE',
];

export default function AdminUsersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'EMPLOYEE',
    branchId: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      const [u, b] = await Promise.all([
        apiGet<User[]>('/admin/users'),
        apiGet<Branch[]>('/admin/branches'),
      ]);
      setUsers(u);
      setBranches(b.map((x: any) => ({ id: x.id, name: x.name })));
      if (b.length === 1 && !form.branchId) {
        setForm((f) => ({ ...f, branchId: b[0].id }));
      }
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
      await apiPost('/admin/hosts', form); // existing endpoint creates users
      setForm({ ...form, email: '', fullName: '', password: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await apiPut(`/admin/users/${u.id}/active`, { isActive: !u.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
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

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <UsersIcon className="w-7 h-7 text-brand-400" />
              <h2 className="text-3xl font-bold text-white">{t('adminUsers.title')}</h2>
              {users && (
                <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-sm">
                  {users.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">{t('adminUsers.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            <UserPlus className="w-4 h-4" /> {t('adminUsers.add')}
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
              placeholder={t('adminUsers.fullName')}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <input
              required
              type="email"
              placeholder={t('common.email')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <input
              required
              type="password"
              placeholder="Initial password (min 6)"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <select
              required
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
            >
              <option value="">— {t('common.branch')} —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="md:col-span-2 px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? t('common.loading') : t('adminUsers.add')}
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

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!users && <div className="p-6 text-zinc-500">{t('common.loading')}</div>}
          {users && users.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">{t('adminUsers.empty')}</div>
          )}
          {users && users.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="text-left p-4">{t('common.name')}</th>
                  <th className="text-left p-4">{t('common.email')}</th>
                  <th className="text-left p-4">{t('adminUsers.role')}</th>
                  <th className="text-left p-4">{t('adminUsers.branch')}</th>
                  <th className="text-left p-4">{t('adminUsers.twoFA')}</th>
                  <th className="text-left p-4">{t('common.status')}</th>
                  <th className="text-left p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-white/5 ${!u.isActive ? 'opacity-50' : ''}`}>
                    <td className="p-4 text-white">{u.fullName}</td>
                    <td className="p-4 text-zinc-300 font-mono text-xs">{u.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 text-xs font-mono">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-300">{u.branch.name}</td>
                    <td className="p-4">
                      {u.totpEnabled ? (
                        <span className="text-green-400 text-xs">✓ on</span>
                      ) : (
                        <span className="text-zinc-500 text-xs">off</span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-300 text-xs">
                          <ShieldCheck className="w-3 h-3" /> {t('common.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-500/15 text-zinc-400 text-xs">
                          <ShieldOff className="w-3 h-3" /> {t('common.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${
                          u.isActive
                            ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300'
                            : 'bg-green-500/15 hover:bg-green-500/25 text-green-300'
                        }`}
                      >
                        {u.isActive ? t('adminUsers.deactivate') : t('adminUsers.activate')}
                      </button>
                    </td>
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
