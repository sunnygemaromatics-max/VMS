'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Zap, X } from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

interface Alert {
  workerId: string;
  fullName: string;
  contractor: string;
  skillCategory: string;
  medicalExpiry: string;
  daysUntilExpiry: number;
  policeVerified: boolean;
  severity: 'EXPIRED' | 'CRITICAL' | 'WARNING';
}

export function ComplianceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiGet<Alert[]>('/compliance/alerts')
      .then(setAlerts)
      .catch(() => {});
    const t = setInterval(
      () => apiGet<Alert[]>('/compliance/alerts').then(setAlerts).catch(() => {}),
      60_000,
    );
    return () => clearInterval(t);
  }, []);

  if (dismissed || alerts.length === 0) return null;

  const expired = alerts.filter((a) => a.severity === 'EXPIRED').length;
  const critical = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const total = alerts.length;

  return (
    <div
      className={`mt-6 rounded-2xl border p-5 backdrop-blur-xl flex items-start gap-4 ${
        expired > 0
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-yellow-500/30 bg-yellow-500/10'
      }`}
    >
      <div className="shrink-0 mt-1">
        {expired > 0 ? (
          <Zap className="w-6 h-6 text-red-400" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-yellow-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {expired > 0
              ? `${expired} worker${expired === 1 ? '' : 's'} with expired medical clearance`
              : `${total} worker${total === 1 ? '' : 's'} need attention`}
          </h3>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-zinc-400 hover:text-white"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-zinc-300 mt-1">
          {critical > 0 && `${critical} expiring within 7 days. `}
          {total - expired - critical > 0 &&
            `${total - expired - critical} expiring within 30 days.`}
        </p>
        <ul className="mt-3 space-y-1 max-h-32 overflow-y-auto text-xs text-zinc-300">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.workerId} className="flex items-center gap-2">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                  a.severity === 'EXPIRED'
                    ? 'bg-red-500/20 text-red-300'
                    : a.severity === 'CRITICAL'
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'bg-yellow-500/20 text-yellow-200'
                }`}
              >
                {a.severity}
              </span>
              <span className="text-white">{a.fullName}</span>
              <span className="text-zinc-500">·</span>
              <span>{a.contractor}</span>
              <span className="text-zinc-500">·</span>
              <span>
                {a.daysUntilExpiry < 0
                  ? `expired ${-a.daysUntilExpiry}d ago`
                  : `in ${a.daysUntilExpiry}d`}
              </span>
            </li>
          ))}
        </ul>
        {alerts.length > 6 && (
          <Link
            href="/workers"
            className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300"
          >
            View all {alerts.length} workers →
          </Link>
        )}
      </div>
    </div>
  );
}
