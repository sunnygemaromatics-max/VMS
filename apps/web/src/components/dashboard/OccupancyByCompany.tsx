'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, HardHat, User } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Row {
  company: string;
  visitors: number;
  workers: number;
  total: number;
}

/**
 * Live occupancy grouped by contractor / company — fed by
 * /visitors/headcount-by-company. Auto-refreshes every 20 s.
 */
export function OccupancyByCompany({ branchId }: { branchId?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    try {
      const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      setRows(await apiGet<Row[]>(`/visitors/headcount-by-company${q}`));
    } catch {
      setRows([]);
    }
  }, [branchId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 20_000);
    return () => clearInterval(i);
  }, [load]);

  if (rows === null) return null;
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-white font-semibold">
          <Building2 className="w-4 h-4 text-brand-400" /> On-site by Company
        </h3>
        <span className="text-xs text-zinc-500 font-mono">{grandTotal} inside</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nobody is on-site right now.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.company} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-200 truncate">{r.company}</span>
                <span className="font-mono text-zinc-400 text-xs">
                  {r.workers > 0 && (
                    <span className="inline-flex items-center gap-0.5 mr-2 text-amber-300">
                      <HardHat className="w-3 h-3" /> {r.workers}
                    </span>
                  )}
                  {r.visitors > 0 && (
                    <span className="inline-flex items-center gap-0.5 mr-2 text-cyan-300">
                      <User className="w-3 h-3" /> {r.visitors}
                    </span>
                  )}
                  <span className="text-white">{r.total}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-brand-gradient rounded-full"
                  style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
