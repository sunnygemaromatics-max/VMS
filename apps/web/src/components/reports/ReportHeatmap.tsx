'use client';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Row {
  dow?: number;
  hour?: number;
  totalEntries?: number;
  visitorEntries?: number;
  workerEntries?: number;
  [k: string]: any;
}

interface Props {
  rows: Row[];
  /** Which metric drives the cell intensity. */
  metric?: 'totalEntries' | 'visitorEntries' | 'workerEntries';
}

/**
 * 7×24 heatmap of activity by day-of-week × hour-of-day. The canonical
 * BI view for gate / footfall data — every cell is a one-hour bucket on
 * one weekday, shaded by intensity relative to the busiest cell.
 */
export function ReportHeatmap({ rows, metric = 'totalEntries' }: Props) {
  // Pivot the flat row list into a (dow, hour) -> value map.
  const grid = new Map<string, number>();
  let max = 0;
  for (const r of rows) {
    if (typeof r.dow !== 'number' || typeof r.hour !== 'number') continue;
    const v = Number(r[metric] ?? 0);
    grid.set(`${r.dow}:${r.hour}`, v);
    if (v > max) max = v;
  }

  const shade = (v: number): string => {
    if (v <= 0) return 'rgba(124,58,237,0.04)';
    const t = Math.min(1, v / max);
    // Soft purple gradient — works on both light and dark surfaces.
    const alpha = 0.12 + 0.78 * t;
    return `rgba(124,58,237,${alpha.toFixed(3)})`;
  };

  if (max === 0) {
    return (
      <div className="text-center text-text-tertiary text-sm py-12">
        No activity in this window — try a wider date range or a different metric.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/30 p-4 overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-3">
          {metric === 'totalEntries' ? 'All entries' : metric === 'visitorEntries' ? 'Visitor entries' : 'Worker entries'} · day × hour
        </div>

        <div className="flex items-end gap-1.5 mb-1 pl-12">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 text-[9px] text-text-tertiary text-center tabular-nums"
              style={{ minWidth: 22 }}
            >
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
        </div>

        {DOW.map((day, dow) => (
          <div key={day} className="flex items-center gap-1.5 mb-1">
            <div className="w-10 text-[10px] uppercase tracking-wider text-text-tertiary font-medium text-right pr-1">
              {day}
            </div>
            {HOURS.map((h) => {
              const v = grid.get(`${dow}:${h}`) ?? 0;
              return (
                <div
                  key={h}
                  title={`${day} ${String(h).padStart(2, '0')}:00 — ${v} entries`}
                  className="flex-1 h-7 rounded-sm border border-border-subtle"
                  style={{ background: shade(v), minWidth: 22 }}
                />
              );
            })}
          </div>
        ))}

        <div className="flex items-center justify-between mt-3 text-[10px] text-text-tertiary">
          <span>Each cell = 1 hour of activity on that weekday.</span>
          <div className="flex items-center gap-1.5">
            <span>0</span>
            <div
              className="w-32 h-2 rounded-sm border border-border-subtle"
              style={{
                background:
                  'linear-gradient(to right, rgba(124,58,237,0.04), rgba(124,58,237,0.9))',
              }}
            />
            <span>{max}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
