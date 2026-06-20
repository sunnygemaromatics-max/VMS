'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Search, ShieldCheck, ShieldX, Star, Users, UserX } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Column,
  DataTable,
  EmptyState,
  Input,
  useToast,
} from '@vms/ui';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { FaceEnrollButton } from '@/components/face-enroll-button';
import { apiGet, apiPut } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { useI18n } from '@/lib/i18n';

interface Visitor {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  documentType: string;
  documentNumber: string;
  isBlacklisted: boolean;
  isVip: boolean;
  createdAt: string;
  _count: { visits: number };
}

type FilterKey = 'all' | 'active' | 'blacklisted' | 'vip';

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'blacklisted', label: 'Blacklisted' },
  { key: 'vip', label: 'VIP' },
];

export default function VisitorsListPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setVisitors(await apiGet<Visitor[]>('/admin/visitors'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visitors');
    }
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function toggleBlacklist(v: Visitor) {
    setBusyId(v.id);
    try {
      await apiPut(`/admin/visitors/${v.id}/blacklist`, { blacklist: !v.isBlacklisted });
      toast.success(
        v.isBlacklisted ? `${v.fullName} removed from blacklist` : `${v.fullName} blacklisted`,
      );
      await load();
    } catch (e) {
      toast.error('Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleVip(v: Visitor) {
    setBusyId(v.id);
    try {
      await apiPut(`/visitors/${v.id}/vip`, { isVip: !v.isVip });
      toast.success(v.isVip ? `${v.fullName} unmarked VIP` : `${v.fullName} marked VIP`);
      await load();
    } catch (e) {
      toast.error('Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!visitors) return [] as Visitor[];
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => {
      if (filter === 'active' && v.isBlacklisted) return false;
      if (filter === 'blacklisted' && !v.isBlacklisted) return false;
      if (filter === 'vip' && !v.isVip) return false;
      if (!q) return true;
      return (
        v.fullName.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.company && v.company.toLowerCase().includes(q)) ||
        v.documentNumber.toLowerCase().includes(q)
      );
    });
  }, [visitors, search, filter]);

  const columns: Column<Visitor>[] = [
    {
      key: 'visitor',
      header: 'Visitor',
      cell: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-text-primary font-medium truncate">{v.fullName}</span>
            {v.isVip && (
              <Star className="w-3.5 h-3.5 shrink-0 text-warning fill-warning" aria-label="VIP" />
            )}
          </div>
          <p className="text-xs text-text-tertiary truncate">
            <span className="font-mono">{v.phone}</span>
            {v.email && <span> · {v.email}</span>}
          </p>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      priority: 2,
      cell: (v) =>
        v.company ? (
          <span className="text-text-secondary">{v.company}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: 'document',
      header: 'Document',
      priority: 3,
      cell: (v) => (
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wider">{v.documentType}</p>
          <p className="text-xs font-mono text-text-secondary">{v.documentNumber}</p>
        </div>
      ),
    },
    {
      key: 'visits',
      header: 'Visits',
      align: 'center',
      width: '80px',
      cell: (v) => (
        <Badge tone="brand" mono>
          {v._count.visits}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (v) =>
        v.isBlacklisted ? (
          <Badge tone="danger" icon={<ShieldX />}>
            Blacklisted
          </Badge>
        ) : (
          <Badge tone="success" icon={<ShieldCheck />}>
            Active
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (v) => (
        <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <FaceEnrollButton kind="visitor" id={v.id} label="Face" />
          <Button
            variant={v.isVip ? 'secondary' : 'ghost'}
            size="sm"
            disabled={busyId === v.id}
            onClick={() => toggleVip(v)}
            leftIcon={<Star className={v.isVip ? 'fill-warning text-warning' : ''} />}
            className={v.isVip ? 'text-warning' : ''}
            title={v.isVip ? t('visitors.unmarkVip') : t('visitors.markVip')}
          >
            VIP
          </Button>
          <Button
            variant={v.isBlacklisted ? 'success' : 'danger'}
            size="sm"
            disabled={busyId === v.id}
            onClick={() => toggleBlacklist(v)}
          >
            {v.isBlacklisted ? t('visitors.unblacklist') : t('visitors.blacklist')}
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-tertiary text-sm">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-brand-400" />
              <h1 className="text-xl font-semibold text-text-primary">{t('visitors.title')}</h1>
              {visitors && (
                <Badge tone="brand" mono>
                  {visitors.length}
                </Badge>
              )}
            </div>
            <p className="text-sm text-text-tertiary mt-1">{t('visitors.subtitle')}</p>
          </div>
          {filtered.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Download />}
              onClick={() =>
                downloadCSV(
                  `aegis-visitors-${new Date().toISOString().slice(0, 10)}.csv`,
                  filtered as any,
                )
              }
            >
              Export CSV
            </Button>
          )}
        </div>

        {error && (
          <Alert tone="danger" onDismiss={() => setError(null)} className="mb-4">
            {error}
          </Alert>
        )}

        <DataTable<Visitor>
          rows={filtered}
          columns={columns}
          rowKey={(v) => v.id}
          density="compact"
          loading={!visitors}
          maxHeight="calc(100vh - 280px)"
          toolbar={
            <>
              <div className="flex-1 min-w-[240px] max-w-md">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, email, company, document…"
                  prefix={<Search className="w-3.5 h-3.5" />}
                />
              </div>
              <div className="flex items-center gap-1 bg-surface-1 border border-border-subtle rounded-md p-0.5">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`px-2.5 h-6 rounded text-xs font-medium transition-colors duration-fast ${
                      filter === opt.key
                        ? 'bg-brand-600 text-white'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          }
          empty={
            <EmptyState
              icon={search || filter !== 'all' ? <Search /> : <UserX />}
              title={search || filter !== 'all' ? 'No matches' : 'No visitors yet'}
              description={
                search || filter !== 'all'
                  ? 'Adjust your search or filter to see results.'
                  : 'Create one via the check-in flow or kiosk.'
              }
            />
          }
        />
      </div>
    </main>
  );
}
