'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Point {
  date: string;
  total: number;
  approved: number;
  checkedIn: number;
}

export function VisitsChart() {
  const [data, setData] = useState<Point[] | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    apiGet<Point[]>(`/visitors/analytics?days=${days}`)
      .then(setData)
      .catch(() => setData([]));
  }, [days]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl h-56 flex items-center justify-center text-zinc-500 text-sm">
        Loading chart…
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.total));
  const W = 800;
  const H = 180;
  const padX = 32;
  const padTop = 16;
  const padBottom = 28;
  const innerH = H - padTop - padBottom;
  const barW = (W - padX * 2) / data.length;
  const gap = Math.max(2, barW * 0.15);
  const innerBarW = barW - gap;

  const total = data.reduce((s, d) => s + d.total, 0);
  const peakDay = data.reduce((a, b) => (a.total >= b.total ? a : b), data[0]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Visit volume</h3>
        </div>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 || total === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No visit data in the selected range yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Metric label="Total visits" value={total} icon={TrendingUp} />
            <Metric
              label="Avg / day"
              value={(total / data.length).toFixed(1)}
            />
            <Metric
              label="Peak day"
              value={`${peakDay.total} on ${peakDay.date.slice(5)}`}
            />
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-44"
            preserveAspectRatio="none"
          >
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <line
                key={p}
                x1={padX}
                x2={W - padX}
                y1={padTop + innerH * p}
                y2={padTop + innerH * p}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            ))}
            {/* Bars */}
            {data.map((d, i) => {
              const x = padX + barW * i + gap / 2;
              const totalH = (d.total / max) * innerH;
              const approvedH = (d.approved / max) * innerH;
              const checkedH = (d.checkedIn / max) * innerH;
              return (
                <g key={d.date}>
                  {/* total (background) */}
                  <rect
                    x={x}
                    y={padTop + innerH - totalH}
                    width={innerBarW}
                    height={totalH}
                    fill="rgba(59,130,246,0.25)"
                    rx={2}
                  />
                  {/* approved (mid) */}
                  <rect
                    x={x}
                    y={padTop + innerH - approvedH}
                    width={innerBarW}
                    height={approvedH}
                    fill="rgba(59,130,246,0.55)"
                    rx={2}
                  />
                  {/* checked-in (strong) */}
                  <rect
                    x={x}
                    y={padTop + innerH - checkedH}
                    width={innerBarW}
                    height={checkedH}
                    fill="rgb(59,130,246)"
                    rx={2}
                  />
                  {/* date label */}
                  <text
                    x={x + innerBarW / 2}
                    y={H - 8}
                    fill="rgba(255,255,255,0.45)"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {d.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
            <LegendDot color="rgba(59,130,246,0.25)" label="Total" />
            <LegendDot color="rgba(59,130,246,0.55)" label="Approved+" />
            <LegendDot color="rgb(59,130,246)" label="Checked in" />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: any;
}) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-[10px] uppercase text-zinc-500 mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
