'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Trash2, AlertTriangle, Info, Plus } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { apiGet, apiPost, apiDelete, API_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Branch { id: string; name: string }
interface Notice {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'urgent';
  branchId: string | null;
  authorName: string;
  expiresAt: string | null;
  createdAt: string;
}

const POSTING_ROLES = new Set(['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER']);

export default function NoticesPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    level: 'info' as Notice['level'],
    branchId: '',
    expiresAt: '',
  });

  const canPost = !!user && POSTING_ROLES.has(user.role);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      const [list, b] = await Promise.all([
        apiGet<Notice[]>('/notices'),
        apiGet<Branch[]>('/admin/branches').catch(() => []),
      ]);
      setNotices(list);
      setBranches(b.map((x: any) => ({ id: x.id, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  // Live updates: pick up new notices and removals as they happen.
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('notice_new', (n: Notice) => {
      setNotices((prev) => (prev ? [n, ...prev.filter((x) => x.id !== n.id)] : [n]));
    });
    socket.on('notice_removed', ({ id }: { id: string }) => {
      setNotices((prev) => prev?.filter((x) => x.id !== id) ?? prev);
    });
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/notices', {
        title: form.title,
        body: form.body,
        level: form.level,
        branchId: form.branchId || null,
        expiresAt: form.expiresAt || null,
      });
      setForm({ title: '', body: '', level: 'info', branchId: '', expiresAt: '' });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this notice?')) return;
    try {
      await apiDelete(`/notices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        {t('common.loading')}
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
              <Megaphone className="w-7 h-7 text-brand-400" />
              <h2 className="text-3xl font-bold text-white">{t('notices.title')}</h2>
              {notices && (
                <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-sm">
                  {notices.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">{t('notices.subtitle')}</p>
          </div>
          {canPost && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
            >
              <Plus className="w-4 h-4" /> {t('notices.new')}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && canPost && (
          <form
            onSubmit={create}
            className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              required
              placeholder={t('notices.titlePlaceholder')}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
              className="md:col-span-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <textarea
              required
              placeholder={t('notices.bodyPlaceholder')}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              maxLength={2000}
              rows={4}
              className="md:col-span-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500"
            />
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as Notice['level'] })}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
            >
              <option value="info">{t('notices.levelInfo')}</option>
              <option value="warning">{t('notices.levelWarning')}</option>
              <option value="urgent">{t('notices.levelUrgent')}</option>
            </select>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white"
            >
              <option value="">{t('notices.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <label className="md:col-span-2 text-xs text-zinc-400 flex flex-col gap-1">
              {t('notices.expiresAt')}
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? t('common.loading') : t('notices.post')}
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

        <div className="space-y-3">
          {!notices && <p className="text-zinc-500">{t('common.loading')}</p>}
          {notices && notices.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-500 text-sm">
              {t('notices.empty')}
            </div>
          )}
          {notices?.map((n) => (
            <NoticeCard key={n.id} n={n} onDelete={canPost ? () => remove(n.id) : undefined} t={t} />
          ))}
        </div>
      </div>
    </main>
  );
}

function NoticeCard({ n, onDelete, t }: { n: Notice; onDelete?: () => void; t: (k: string) => string }) {
  const tone =
    n.level === 'urgent'
      ? 'border-red-500/40 bg-red-500/10'
      : n.level === 'warning'
      ? 'border-amber-500/40 bg-amber-500/10'
      : 'border-brand-500/30 bg-brand-500/5';
  const Icon = n.level === 'urgent' || n.level === 'warning' ? AlertTriangle : Info;
  const iconColor = n.level === 'urgent' ? 'text-red-300' : n.level === 'warning' ? 'text-amber-300' : 'text-brand-300';

  return (
    <div className={`rounded-2xl border ${tone} backdrop-blur-xl p-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold">{n.title}</h3>
          <p className="text-zinc-200 text-sm mt-2 whitespace-pre-wrap">{n.body}</p>
          <p className="text-[10px] text-zinc-500 mt-3 font-mono">
            {n.authorName} · {new Date(n.createdAt).toLocaleString()}
            {n.expiresAt && ` · ${t('notices.expires')} ${new Date(n.expiresAt).toLocaleString()}`}
          </p>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-300 hover:bg-red-500/10"
            title={t('action.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
