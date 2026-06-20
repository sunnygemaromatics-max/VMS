'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Eye, Plus, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import {
  Badge,
  Button,
  Column,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@vms/ui';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface Watchlist {
  id: string;
  name: string;
  description: string | null;
  kind: 'block' | 'flag' | 'escort' | 'silent_notify';
  severity: number;
  isActive: boolean;
  orgId: string | null;
  _count?: { entries: number };
}
interface Entry {
  id: string;
  reason: string;
  addedByName: string | null;
  expiresAt: string | null;
  createdAt: string;
  visitor: { id: string; fullName: string; phone: string; company: string | null };
}
interface VisitorLite { id: string; fullName: string; phone: string }

const KIND_TONE: Record<Watchlist['kind'], 'critical' | 'warning' | 'info' | 'neutral'> = {
  block: 'critical',
  flag: 'warning',
  escort: 'info',
  silent_notify: 'neutral',
};

export default function WatchlistsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [lists, setLists] = useState<Watchlist[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', kind: 'flag', severity: 3 });

  const [openList, setOpenList] = useState<Watchlist | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [visitors, setVisitors] = useState<VisitorLite[]>([]);
  const [addForm, setAddForm] = useState({ visitorId: '', reason: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      setLists(await apiGet<Watchlist[]>('/watchlists'));
    } catch (e) {
      toast.error('Failed to load watchlists', e instanceof Error ? e.message : undefined);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiPost('/watchlists', { ...form, severity: Number(form.severity) });
      toast.success('Watchlist created');
      setShowCreate(false);
      setForm({ name: '', description: '', kind: 'flag', severity: 3 });
      await load();
    } catch (e) {
      toast.error('Create failed', e instanceof Error ? e.message : undefined);
    } finally {
      setCreating(false);
    }
  }

  async function openEntries(wl: Watchlist) {
    setOpenList(wl);
    setEntries(null);
    setAddForm({ visitorId: '', reason: '' });
    try {
      const [es, vs] = await Promise.all([
        apiGet<Entry[]>(`/watchlists/${wl.id}/entries`),
        apiGet<VisitorLite[]>('/admin/visitors').catch(() => [] as VisitorLite[]),
      ]);
      setEntries(es);
      setVisitors(vs.map((v) => ({ id: v.id, fullName: v.fullName, phone: v.phone })));
    } catch (e) {
      toast.error('Failed to load entries', e instanceof Error ? e.message : undefined);
    }
  }

  async function addEntry() {
    if (!openList || !addForm.visitorId || !addForm.reason.trim()) {
      toast.error('Pick a visitor and give a reason');
      return;
    }
    setAdding(true);
    try {
      await apiPost(`/watchlists/${openList.id}/entries`, addForm);
      toast.success('Added to watchlist');
      setAddForm({ visitorId: '', reason: '' });
      setEntries(await apiGet<Entry[]>(`/watchlists/${openList.id}/entries`));
      await load();
    } catch (e) {
      toast.error('Add failed', e instanceof Error ? e.message : undefined);
    } finally {
      setAdding(false);
    }
  }

  async function removeEntry(entryId: string) {
    if (!openList) return;
    try {
      await apiDelete(`/watchlists/${openList.id}/entries/${entryId}`);
      setEntries((es) => es?.filter((e) => e.id !== entryId) ?? es);
      await load();
    } catch (e) {
      toast.error('Remove failed', e instanceof Error ? e.message : undefined);
    }
  }

  const columns: Column<Watchlist>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Watchlist',
        cell: (w) => (
          <div>
            <p className="text-text-primary font-medium">{w.name}</p>
            {w.description && <p className="text-xs text-text-tertiary truncate">{w.description}</p>}
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'Kind',
        width: '130px',
        cell: (w) => (
          <Badge tone={KIND_TONE[w.kind]} icon={w.kind === 'block' ? <Ban /> : <ShieldAlert />}>
            {w.kind.replace('_', ' ')}
          </Badge>
        ),
      },
      { key: 'severity', header: 'Sev', align: 'center', width: '60px', cell: (w) => <Badge tone="brand" mono>{w.severity}</Badge> },
      { key: 'entries', header: 'Members', align: 'center', width: '90px', cell: (w) => <Badge tone="neutral" mono>{w._count?.entries ?? 0}</Badge> },
      {
        key: 'scope',
        header: 'Scope',
        width: '90px',
        priority: 2,
        cell: (w) => <span className="text-xs text-text-tertiary">{w.orgId ? 'Org' : 'Global'}</span>,
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (w) => (
          <Button size="sm" variant="ghost" leftIcon={<Eye />} onClick={() => openEntries(w)}>
            Members
          </Button>
        ),
      },
    ],
    [],
  );

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center text-text-tertiary text-sm">Loading…</div>;
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-brand-400" />
              <h1 className="text-xl font-semibold text-text-primary">Watchlists</h1>
              {lists && <Badge tone="brand" mono>{lists.length}</Badge>}
            </div>
            <p className="text-sm text-text-tertiary mt-1">
              Named, graded lists. A visitor on any active <strong>block</strong> list is auto-blacklisted at the gate.
            </p>
          </div>
          <Button variant="primary" leftIcon={<Plus />} onClick={() => setShowCreate(true)}>
            New watchlist
          </Button>
        </div>

        <DataTable<Watchlist>
          rows={lists}
          columns={columns}
          rowKey={(w) => w.id}
          loading={!lists}
          onRowClick={(w) => openEntries(w)}
          empty={<EmptyState icon={<ShieldAlert />} title="No watchlists yet" description="Create one to start flagging or blocking visitors." />}
        />
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} size="sm" title="New watchlist"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={(e) => create(e as any)}>Create</Button>
          </>
        }
      >
        <form onSubmit={create} className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Terminated staff" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="block">Block (deny entry)</option>
                <option value="flag">Flag (alert only)</option>
                <option value="escort">Escort required</option>
                <option value="silent_notify">Silent notify</option>
              </Select>
            </Field>
            <Field label="Severity (1–5)">
              <Select value={String(form.severity)} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* Entries drawer */}
      <Drawer
        open={!!openList}
        onClose={() => setOpenList(null)}
        width={560}
        title={openList?.name}
        subtitle={openList ? `${openList.kind.replace('_', ' ')} · severity ${openList.severity}` : undefined}
      >
        {openList && (
          <div className="space-y-5">
            <div className="rounded-md border border-border-subtle bg-surface-1 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Add a visitor</p>
              <Select value={addForm.visitorId} onChange={(e) => setAddForm({ ...addForm, visitorId: e.target.value })}>
                <option value="">— Select visitor —</option>
                {visitors.map((v) => <option key={v.id} value={v.id}>{v.fullName} · {v.phone}</option>)}
              </Select>
              <Textarea rows={2} value={addForm.reason} onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} placeholder="Reason (required)…" />
              <Button size="sm" variant="primary" leftIcon={<UserPlus />} loading={adding} onClick={addEntry} className="w-full">
                Add to {openList.name}
              </Button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-text-tertiary mb-2">
                Members {entries ? `(${entries.length})` : ''}
              </p>
              {!entries ? (
                <p className="text-sm text-text-tertiary">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-text-tertiary">No one on this list yet.</p>
              ) : (
                <ul className="space-y-2">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 p-2.5 rounded-md bg-surface-1 border border-border-subtle">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{e.visitor.fullName}</p>
                        <p className="text-xs text-text-secondary">{e.reason}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          {e.addedByName ? `by ${e.addedByName} · ` : ''}{new Date(e.createdAt).toLocaleDateString()}
                          {e.expiresAt ? ` · expires ${new Date(e.expiresAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <button onClick={() => removeEntry(e.id)} className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-danger/10" title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </main>
  );
}
