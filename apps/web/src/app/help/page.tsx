'use client';

import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard-header';
import { useI18n } from '@/lib/i18n';
import {
  BookOpen,
  Users,
  HardHat,
  Clock,
  ParkingCircle,
  Hourglass,
  ShieldCheck,
  Activity,
  Package,
  Bell,
  QrCode,
  FileText,
  Shield,
} from 'lucide-react';

interface Section {
  icon: any;
  title: string;
  body: React.ReactNode;
  links?: { href: string; label: string }[];
}

const SECTIONS: Section[] = [
  {
    icon: Hourglass,
    title: 'Approval workflow',
    body: (
      <>
        Every new visit starts as <strong>PENDING</strong>. Hosts (HR / Org Admin)
        review on the <Link href="/approvals" className="text-blue-400 underline">Approvals</Link> page
        or in the mobile app. Approving sets the QR token live; rejecting blocks it.
        <br />Use <strong>Select all → Approve selected</strong> for batches.
      </>
    ),
    links: [{ href: '/approvals', label: 'Open Approvals' }],
  },
  {
    icon: QrCode,
    title: 'Visitor check-in (QR + walk-in)',
    body: (
      <>
        At the gate, scan the visitor's QR with the <strong>Kiosk</strong> camera tab,
        or paste the token. Walk-in visitors who didn't pre-register can self-register
        from the kiosk's <strong>Walk-in</strong> tab — the host gets notified.
      </>
    ),
    links: [{ href: '/check-in', label: 'Pre-register a visit' }],
  },
  {
    icon: HardHat,
    title: 'Contract workforce',
    body: (
      <>
        Manage contractor companies under <Link href="/contractors" className="text-blue-400 underline">Contractors</Link>,
        and their workers under <Link href="/workers" className="text-blue-400 underline">Workers</Link>.
        Security guards can add a new worker on the spot from the mobile app and mark
        them on-site. The gate refuses workers without police verification or with an
        expired medical certificate.
      </>
    ),
    links: [
      { href: '/contractors', label: 'Contractors' },
      { href: '/workers', label: 'Workers' },
    ],
  },
  {
    icon: Clock,
    title: 'Shifts',
    body: (
      <>
        Define per-branch shifts (Morning, Evening, Night…) under <Link href="/shifts" className="text-blue-400 underline">Shifts</Link>.
        Assign workers to a shift; one worker can belong to multiple shifts. Useful for
        planning and reporting.
      </>
    ),
    links: [{ href: '/shifts', label: 'Open Shifts' }],
  },
  {
    icon: ParkingCircle,
    title: 'Parking',
    body: (
      <>
        Register parking slots per branch under <Link href="/parking" className="text-blue-400 underline">Parking</Link>.
        Each visit can be assigned a slot via the visit-detail flow. Occupied slots are
        coloured red, available green.
      </>
    ),
  },
  {
    icon: Users,
    title: 'Visitors directory',
    body: (
      <>
        <Link href="/visitors-list" className="text-blue-400 underline">Visitors</Link> shows every
        person who has ever visited, with visit count + blacklist toggle. Visitors can
        look themselves up by phone at <code className="text-blue-300">/my-visits</code> — a
        public, no-login page.
      </>
    ),
  },
  {
    icon: Package,
    title: 'Material gate pass',
    body: (
      <>
        Log items entering or leaving with a visitor under{' '}
        <Link href="/material-pass" className="text-blue-400 underline">Materials</Link>. Useful for
        returnable equipment, samples, sealed parcels. Direction (IN / OUT) + quantity
        + optional serial number. CSV export ready.
      </>
    ),
  },
  {
    icon: Bell,
    title: 'Real-time notifications',
    body: (
      <>
        Walk-ins, approvals, rejections push a toast to every open dashboard tab
        instantly via WebSocket. Live headcount updates the same way.
      </>
    ),
  },
  {
    icon: Activity,
    title: 'Analytics & anomalies',
    body: (
      <>
        Dashboard shows volume over 7/14/30 days, a hour-of-day × day-of-week heatmap,
        and a rule-based <strong>anomaly</strong> banner that flags frequency spikes,
        after-hours entries, repeat rejections, and blacklisted attempts.
      </>
    ),
  },
  {
    icon: FileText,
    title: 'Reports',
    body: (
      <>
        <Link href="/reports" className="text-blue-400 underline">Reports</Link> page exports
        Visits, Attendance, Compliance, Contractors and Workers as CSV or PDF. Use the
        <strong> Preview</strong> button to see the first 25 rows before downloading.
      </>
    ),
  },
  {
    icon: Shield,
    title: 'Audit log',
    body: (
      <>
        Every non-GET request is captured under{' '}
        <Link href="/audit" className="text-blue-400 underline">Audit</Link> (SUPER_ADMIN /
        ORG_ADMIN only) — actor, method, path, status, IP, duration. CSV export available.
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant isolation',
    body: (
      <>
        Every read and write is scoped to your organization. SUPER_ADMIN sees everything;
        ORG_ADMIN and lower see only their own org. Cross-org writes (e.g. assigning a
        worker to another org's contractor) are refused with 403 / 404.
      </>
    ),
  },
];

export default function HelpPage() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen">
      <DashboardHeader />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-blue-400" />
            <h2 className="text-3xl font-bold text-white">{t('help.title')}</h2>
          </div>
          <p className="text-zinc-400 mt-2">
            {t('help.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{s.body}</p>
                {s.links && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="text-xs px-3 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                      >
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
          <p className="mb-2 text-white font-semibold">API docs</p>
          <p>
            Every endpoint is documented with Swagger UI at{' '}
            <code className="text-blue-300">/docs</code> on the API. Use the
            <strong> Authorize</strong> button to paste your JWT and try requests live.
          </p>
        </div>
      </div>
    </main>
  );
}
