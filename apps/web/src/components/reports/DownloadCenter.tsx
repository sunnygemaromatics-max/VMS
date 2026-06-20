'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  FileCode2,
  Printer,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';

export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'json' | 'xml' | 'print';
export type ExportScope = 'current' | 'full' | 'summary';

interface Props {
  busy?: boolean;
  onExport: (fmt: ExportFormat, scope: ExportScope, opts: { withCharts: boolean }) => void;
  /** Default scope when the menu opens. */
  defaultScope?: ExportScope;
}

const FORMATS: { key: ExportFormat; label: string; sub: string; icon: any }[] = [
  { key: 'xlsx', label: 'Excel workbook', sub: '.xlsx · Summary + Data sheets', icon: FileSpreadsheet },
  { key: 'csv', label: 'CSV', sub: '.csv · flat data', icon: Download },
  { key: 'pdf', label: 'PDF report', sub: '.pdf · branded header + footer', icon: FileText },
  { key: 'json', label: 'JSON', sub: '.json · machine-readable', icon: FileJson },
  { key: 'xml', label: 'XML', sub: '.xml · machine-readable', icon: FileCode2 },
  { key: 'print', label: 'Print preview', sub: 'system print sheet — save as PDF or print', icon: Printer },
];

const SCOPES: { key: ExportScope; label: string; sub: string }[] = [
  { key: 'current', label: 'Current view', sub: 'Selected columns only' },
  { key: 'full', label: 'Full dataset', sub: 'Every column the report returns' },
  { key: 'summary', label: 'Summary only', sub: 'Totals + KPIs, no row data' },
];

/**
 * The Download Center button: replaces the three "CSV / Excel / PDF"
 * buttons with a structured dropdown — pick a scope (Current view, Full
 * dataset, Summary only), then a format. Six formats + an option for
 * charts. Closes on outside click and Escape.
 */
export function DownloadCenter({ busy, onExport, defaultScope = 'current' }: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [withCharts, setWithCharts] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium shadow-brand-glow hover:-translate-y-px transition-transform disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download Center
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl border border-border-strong bg-surface-2 shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {/* Scope picker */}
          <div className="p-3 border-b border-border-subtle">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-2">
              Export scope
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SCOPES.map((s) => {
                const isOn = scope === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setScope(s.key)}
                    title={s.sub}
                    className={`px-2 py-2 rounded-lg text-[11px] font-medium leading-tight border transition-colors ${
                      isOn
                        ? 'bg-brand-500/15 border-brand-500/40 text-text-primary'
                        : 'bg-surface-1 border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-3'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-text-tertiary">
              {SCOPES.find((s) => s.key === scope)?.sub}
            </p>
          </div>

          {/* Chart toggle (only relevant for PDF + Print) */}
          <button
            type="button"
            onClick={() => setWithCharts((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-text-secondary hover:bg-surface-3 border-b border-border-subtle"
          >
            <span>Include charts (PDF / Print)</span>
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center ${
                withCharts ? 'bg-brand-500 border-brand-500 text-white' : 'border-border-strong'
              }`}
            >
              {withCharts && <Check className="w-3 h-3" />}
            </span>
          </button>

          {/* Format list */}
          <div className="py-1">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    onExport(f.key, scope, { withCharts });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-surface-1 border border-border-subtle flex items-center justify-center text-text-secondary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-text-primary">{f.label}</div>
                    <div className="text-[10px] text-text-tertiary truncate">{f.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
