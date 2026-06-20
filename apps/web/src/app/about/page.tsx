'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard-header';
import { Logo } from '@/components/logo';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Health = 'unknown' | 'ok' | 'down';

export default function AboutPage() {
  const { t } = useI18n();
  const [api, setApi] = useState<Health>('unknown');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const t = performance.now();
    fetch(`${API_URL}/health`)
      .then((r) => {
        setApi(r.ok ? 'ok' : 'down');
        setLatency(Math.round(performance.now() - t));
      })
      .catch(() => setApi('down'));
  }, []);

  return (
    <main className="min-h-screen">
      <DashboardHeader />
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Logo size={56} showWordmark={false} href="" />
          <div>
            <h2 className="text-3xl font-bold text-white">VMS</h2>
            <p className="text-zinc-400">
              The Studio Infinito · Visitor &amp; Workforce Management
            </p>
          </div>
        </div>

        <Section title={t('about.apiStatus')}>
          <StatusRow
            label="API"
            href={API_URL}
            status={api}
            note={latency != null ? `${latency}ms` : '—'}
          />
          <StatusRow label="Real-time (Socket.io)" status="ok" note="see top-right toasts" />
          <StatusRow label="Web" status="ok" note="Vercel (this page is live)" />
        </Section>

        <Section title="About">
          <p className="text-zinc-300 text-sm leading-relaxed">
            VMS is an enterprise visitor &amp; contract-workforce management platform.
            It runs across a web dashboard, gate kiosk, and Expo-based mobile app, with
            real-time WebSocket dashboards, multi-tenant isolation, face recognition,
            audit logs, two-factor auth, shifts + payroll computation, and exportable
            reports.
          </p>
          <p className="text-zinc-300 text-sm leading-relaxed mt-3">
            Built by{' '}
            <a
              href="https://thestudioinfinito.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300"
            >
              Personify Crafters for The Studio Infinito
            </a>
            .
          </p>
        </Section>

        <Section title={t('about.stack')}>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
            <Item label="Web" value="Next.js 14 · Tailwind · Framer Motion" />
            <Item label="Mobile" value="Expo SDK 54 · React Native" />
            <Item label="API" value="NestJS 10 · Prisma 5 · Socket.io" />
            <Item label="Database" value="Postgres (Neon)" />
            <Item label="Hosting" value="Vercel + Render" />
            <Item label="Face recognition" value="face-api.js (browser)" />
            <Item label="Email (optional)" value="Resend" />
            <Item label="Notifications (optional)" value="Telegram Bot API" />
          </ul>
        </Section>

        <Section title={t('about.quickLinks')}>
          <div className="flex flex-wrap gap-2">
            <PillLink href={`${API_URL}/docs`}>API docs (Swagger)</PillLink>
            <PillLink href="/help">In-app help</PillLink>
            <PillLink href="/admin/users">Manage users</PillLink>
            <PillLink href="/admin/branches">Manage branches</PillLink>
            <PillLink href="/audit">Audit log</PillLink>
            <PillLink href="/reports">Reports</PillLink>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function StatusRow({
  label,
  status,
  note,
  href,
}: {
  label: string;
  status: Health;
  note?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
      <div className="flex items-center gap-3">
        {status === 'ok' ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : status === 'down' ? (
          <AlertCircle className="w-5 h-5 text-red-400" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
        )}
        <div>
          <p className="text-white text-sm">{label}</p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-400 hover:underline font-mono"
            >
              {href}
            </a>
          )}
        </div>
      </div>
      <span className="text-xs text-zinc-400">{note ?? status}</span>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.05]">
      <p className="text-[10px] uppercase text-zinc-500">{label}</p>
      <p className="text-zinc-200">{value}</p>
    </li>
  );
}

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http');
  const cls =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 text-xs font-medium';
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children} <ExternalLink className="w-3 h-3" />
    </a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}
