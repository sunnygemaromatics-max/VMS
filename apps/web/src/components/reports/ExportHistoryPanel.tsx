'use client';

import { useEffect, useState } from 'react';
import { History, FileSpreadsheet, FileText, FileJson, FileCode2, Printer, Mail, Download, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface ExportRow {
  id: string;
  report: string;
  format: string;
  scope: string;
  rowCount: number;
  actorEmail: string | null;
  recipients: string | null;
  createdAt: string;
}

const ICONS: Record<string, any> = {
  xlsx: FileSpreadsheet,
  csv: Download,
  pdf: FileText,
  json: FileJson,
  xml: FileCode2,
  print: Printer,
  email: Mail,
};

function rel(date: string) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

/**
 * Right-rail audit panel: append-only log of every report export and
 * email out of the system. Backs into ReportExport in Postgres.
 * Refresh button + auto-refreshes every 30s while open.
 */
export function ExportHistoryPanel() {
  const [items, setItems] = useState<ExportRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setBusy(true);
    apiGet<ExportRow[]>('/reports/exports/list?take=30')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setBusy(false));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <details className="group rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-text-primary">Export history</span>
          {items && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-tertiary border border-border-subtle">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); load(); }}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Refresh"
          disabled={busy}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </summary>

      <div className="border-t border-border-subtle">
        {items === null ? (
          <div className="p-6 text-xs text-text-tertiary text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-xs text-text-tertiary text-center">
            No exports yet. Anything you download or email shows up here.
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto divide-y divide-border-subtle">
            {items.map((it) => {
              const Icon = ICONS[it.format] || Download;
              return (
                <li key={it.id} className="px-3 py-2 flex items-start gap-2 hover:bg-surface-2">
                  <div className="w-7 h-7 mt-0.5 rounded-md bg-surface-2 border border-border-subtle flex items-center justify-center text-text-secondary shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {it.report} · {it.format.toUpperCase()}
                      {it.scope && it.scope !== 'current' && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-surface-2 border border-border-subtle text-text-tertiary">
                          {it.scope}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-tertiary truncate">
                      {it.actorEmail || 'system'} · {it.rowCount} rows · {rel(it.createdAt)}
                    </div>
                    {it.recipients && (
                      <div className="text-[10px] text-brand-300 truncate" title={it.recipients}>
                        → {it.recipients}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
