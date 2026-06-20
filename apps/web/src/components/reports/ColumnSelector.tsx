'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns3, Check, RotateCcw } from 'lucide-react';

interface Props {
  /** All possible columns the active report can return. */
  available: string[];
  /** Subset currently selected — null/undefined means "all". */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}

function humanize(s: string) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Column selector with a chip-style summary and a popover for the full
 * checklist. Selecting nothing == all columns (so the picker can't
 * silently produce empty exports).
 */
export function ColumnSelector({ available, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  const isAll = !selected || selected.length === 0 || selected.length === available.length;
  const summary = isAll
    ? `All columns (${available.length})`
    : `${selected!.length} of ${available.length} columns`;

  function toggle(col: string) {
    const current = selected && selected.length ? selected : available;
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    onChange(next.length === available.length ? null : next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm transition-colors"
        title="Choose which columns appear in the table and exports"
      >
        <Columns3 className="w-4 h-4" />
        <span className="hidden sm:inline">{summary}</span>
        <span className="sm:hidden">Columns</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border-strong bg-surface-2 shadow-2xl shadow-black/40 z-40 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
              Show columns
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary uppercase tracking-wider"
              title="Reset to all columns"
            >
              <RotateCcw className="w-3 h-3" /> All
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {available.map((col) => {
              const checked = isAll || (selected ?? []).includes(col);
              return (
                <li key={col}>
                  <button
                    type="button"
                    onClick={() => toggle(col)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-xs hover:bg-surface-3 text-text-secondary"
                  >
                    <span className="text-text-primary truncate">{humanize(col)}</span>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-brand-500 border-brand-500 text-white' : 'border-border-strong'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
