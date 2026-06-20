'use client';

import { useEffect } from 'react';
import { X, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';
import { downloadXLSX } from '@/lib/xlsx';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  loading?: boolean;
  rows: any[];
  count?: number;
  onClose: () => void;
}

function humanize(s: string) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Side-drawer for the drill-down records behind a single grouped row.
 * Slides in from the right; closes on overlay click or Escape.
 */
export function DrillDrawer({ open, title, subtitle, loading, rows, count, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const headers = rows.length ? Object.keys(rows[0]) : [];

  function exportRows(fmt: 'csv' | 'xlsx') {
    if (!rows.length) return;
    const safe = title.replace(/[^A-Za-z0-9-_]+/g, '_').slice(0, 60);
    if (fmt === 'csv') downloadCSV(`${safe}.csv`, rows);
    else downloadXLSX(safe, [{ name: 'Records', rows }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drill-down"
      />
      <aside
        className="w-full sm:w-[640px] max-w-full bg-surface-1 border-l border-border-strong shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-border-subtle">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
              Drill-down
            </div>
            <h3 className="text-lg font-semibold text-text-primary truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportRows('csv')}
              disabled={!rows.length || loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-xs disabled:opacity-50"
              title="Export these records as CSV"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => exportRows('xlsx')}
              disabled={!rows.length || loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-xs disabled:opacity-50"
              title="Export these records as Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-surface-2 text-text-tertiary hover:text-text-primary flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading records…
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
              No underlying records.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-text-tertiary sticky top-0 bg-surface-2/95 backdrop-blur">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-medium whitespace-nowrap border-b border-border-subtle"
                    >
                      {humanize(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-secondary">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                        {r[h] === null || r[h] === undefined ? '—' : String(r[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {typeof count === 'number' && count >= 500 && (
          <footer className="px-5 py-2 border-t border-border-subtle text-[11px] text-text-tertiary text-center">
            Showing first 500 records. Narrow the date range to see more.
          </footer>
        )}
      </aside>
    </div>
  );
}
