'use client';

import { useEffect, useState } from 'react';
import { Bot, X, ShieldAlert } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Anomaly {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  kind: string;
  title: string;
  detail: string;
}
interface Resp {
  total: number;
  bySeverity: { HIGH: number; MEDIUM: number; LOW: number };
  anomalies: Anomaly[];
}

export function AnomaliesBanner() {
  const [data, setData] = useState<Resp | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await apiGet<Resp>('/admin/anomalies');
        if (!cancelled) setData(r);
      } catch {
        /* silent */
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (dismissed || !data || data.total === 0) return null;

  const tone =
    data.bySeverity.HIGH > 0
      ? 'border-red-500/30 bg-red-500/10'
      : data.bySeverity.MEDIUM > 0
      ? 'border-orange-500/30 bg-orange-500/10'
      : 'border-yellow-500/30 bg-yellow-500/10';

  return (
    <div className={`mt-6 rounded-2xl border ${tone} p-5 backdrop-blur-xl flex items-start gap-4`}>
      <div className="shrink-0 mt-1">
        {data.bySeverity.HIGH > 0 ? (
          <ShieldAlert className="w-6 h-6 text-red-400" />
        ) : (
          <Bot className="w-6 h-6 text-orange-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {data.total} anomal{data.total === 1 ? 'y' : 'ies'} detected
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
          {data.bySeverity.HIGH > 0 && `${data.bySeverity.HIGH} high · `}
          {data.bySeverity.MEDIUM > 0 && `${data.bySeverity.MEDIUM} medium · `}
          {data.bySeverity.LOW > 0 && `${data.bySeverity.LOW} low`}
        </p>
        <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto text-xs">
          {data.anomalies.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 ${
                  a.severity === 'HIGH'
                    ? 'bg-red-500/20 text-red-300'
                    : a.severity === 'MEDIUM'
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'bg-yellow-500/20 text-yellow-200'
                }`}
              >
                {a.severity}
              </span>
              <div className="min-w-0">
                <p className="text-white truncate">{a.title}</p>
                <p className="text-zinc-500 truncate">{a.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
