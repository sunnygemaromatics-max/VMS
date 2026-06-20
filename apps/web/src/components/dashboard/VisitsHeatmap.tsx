'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Cell {
  dow: number; // 0=Sun
  hour: number;
  count: number;
}
interface Resp {
  days: number;
  cells: Cell[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function VisitsHeatmap() {
  const [data, setData] = useState<Resp | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    apiGet<Resp>(`/admin/heatmap?days=${days}`)
      .then(setData)
      .catch(() => setData({ days, cells: [] }));
  }, [days]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 h-48 flex items-center justify-center text-zinc-500 text-sm">
        Loading heatmap…
      </div>
    );
  }

  const max = Math.max(1, ...data.cells.map((c) => c.count));
  const peak = data.cells.reduce((a, b) => (a.count >= b.count ? a : b), data.cells[0]);

  function intensity(c: number) {
    if (c === 0) return 'rgba(255,255,255,0.04)';
    const ratio = c / max;
    // Blue gradient from 0.15 → 0.95 alpha
    const alpha = 0.15 + ratio * 0.8;
    return `rgba(59,130,246,${alpha.toFixed(2)})`;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">When visits happen</h3>
        </div>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                days === d ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {peak && peak.count > 0 ? (
        <p className="text-xs text-zinc-400 mb-3">
          Peak: <strong className="text-white">{peak.count}</strong> visits on{' '}
          {DAY_LABELS[peak.dow]} at {String(peak.hour).padStart(2, '0')}:00 UTC
        </p>
      ) : (
        <p className="text-xs text-zinc-500 mb-3">No visits in window.</p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour header */}
          <div className="flex">
            <div className="w-10 shrink-0" />
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="w-5 text-[9px] text-zinc-500 text-center"
              >
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {DAY_LABELS.map((label, dow) => (
            <div key={dow} className="flex items-center">
              <div className="w-10 shrink-0 text-[10px] text-zinc-500 pr-2 text-right">
                {label}
              </div>
              {Array.from({ length: 24 }).map((_, h) => {
                const cell = data.cells.find((c) => c.dow === dow && c.hour === h);
                const count = cell?.count ?? 0;
                return (
                  <div
                    key={h}
                    title={`${label} ${String(h).padStart(2, '0')}:00 — ${count} visit${
                      count === 1 ? '' : 's'
                    }`}
                    className="w-5 h-5 m-px rounded-sm cursor-default"
                    style={{ background: intensity(count) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-500">
        <span>Less</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((r, i) => (
          <span
            key={i}
            className="inline-block w-3 h-3 rounded-sm"
            style={{
              background:
                r === 0
                  ? 'rgba(255,255,255,0.04)'
                  : `rgba(59,130,246,${(0.15 + r * 0.8).toFixed(2)})`,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
