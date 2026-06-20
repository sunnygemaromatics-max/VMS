'use client';

import { ReactNode, useMemo, useState } from 'react';
import { cn } from '../utils/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export type ColumnType =
  | 'text'
  | 'mono'
  | 'number'
  | 'percent'
  | 'timestamp'
  | 'relativeTime'
  | 'badge'
  | 'avatar'
  | 'actions'
  | 'custom';

export interface Column<Row = any> {
  /** Column id and default header label */
  key: string;
  header?: ReactNode;
  type?: ColumnType;
  /** Accessor — defaults to row[key] */
  accessor?: (row: Row) => unknown;
  /** Custom cell renderer; overrides type */
  cell?: (row: Row) => ReactNode;
  /** Visual priority: 1 always visible, 2 collapses mid, 3 hidden on mobile */
  priority?: 1 | 2 | 3;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Adds a sortable header */
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<Row> {
  rows: Row[] | null | undefined;
  columns: Column<Row>[];
  rowKey?: (row: Row) => string | number;
  onRowClick?: (row: Row) => void;
  density?: 'compact' | 'default' | 'comfort';
  loading?: boolean;
  /** Slot above the table — search/filter chips */
  toolbar?: ReactNode;
  /** Rendered when rows.length === 0. Defaults to a generic EmptyState. */
  empty?: ReactNode;
  /** Multi-select; emits selected keys */
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Bulk action bar shown when selection is non-empty */
  bulkActions?: ReactNode;
  /** Sticky header on overflow scroll */
  sticky?: boolean;
  className?: string;
  /** Max-height for the scrollable region */
  maxHeight?: string;
}

const DENSITY_PADDING: Record<NonNullable<DataTableProps<any>['density']>, string> = {
  compact: 'h-8 px-3 text-sm',
  default: 'h-10 px-3 text-sm',
  comfort: 'h-12 px-4 text-base',
};

const PRIO_HIDE: Record<NonNullable<Column['priority']>, string> = {
  1: '',
  2: 'hidden md:table-cell',
  3: 'hidden lg:table-cell',
};

function defaultCell(row: any, col: Column): ReactNode {
  const v = col.accessor ? col.accessor(row) : row[col.key];
  if (col.cell) return col.cell(row);
  switch (col.type) {
    case 'mono':
      return <span className="font-mono text-xs text-text-secondary">{String(v ?? '—')}</span>;
    case 'number':
    case 'percent':
      return (
        <span className="font-mono tabular-nums">
          {v == null ? '—' : col.type === 'percent' ? `${(Number(v) * 100).toFixed(1)}%` : String(v)}
        </span>
      );
    case 'timestamp':
      return (
        <span className="font-mono text-xs text-text-tertiary">
          {v ? new Date(v as any).toLocaleString() : '—'}
        </span>
      );
    case 'relativeTime':
      return (
        <span className="text-xs text-text-tertiary">
          {v ? relative(new Date(v as any)) : '—'}
        </span>
      );
    case 'text':
    default:
      return <span>{v == null || v === '' ? <span className="text-text-tertiary">—</span> : String(v)}</span>;
  }
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  return `${day}d ago`;
}

export function DataTable<Row extends object>({
  rows,
  columns,
  rowKey,
  onRowClick,
  density = 'compact',
  loading,
  toolbar,
  empty,
  selectable,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  sticky = true,
  className,
  maxHeight,
}: DataTableProps<Row>) {
  const [internalSelection, setInternalSelection] = useState<Set<string | number>>(new Set());
  const selection = selectedKeys ?? internalSelection;
  const setSelection = onSelectionChange ?? setInternalSelection;
  const keyOf = (r: Row, i: number) => (rowKey ? rowKey(r) : (r as any).id ?? i);

  const allSelected = useMemo(
    () => rows && rows.length > 0 && rows.every((r, i) => selection.has(keyOf(r, i))),
    [rows, selection],
  );

  function toggleAll() {
    if (!rows) return;
    if (allSelected) {
      setSelection(new Set());
    } else {
      setSelection(new Set(rows.map(keyOf)));
    }
  }
  function toggleRow(k: string | number) {
    const next = new Set(selection);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelection(next);
  }

  return (
    <div className={cn('relative flex flex-col bg-surface-2 border border-border-subtle rounded-lg overflow-hidden', className)}>
      {toolbar && (
        <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2 flex-wrap">
          {toolbar}
        </div>
      )}
      <div
        className="overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full text-sm">
          <thead
            className={cn(
              'text-xs uppercase tracking-wider text-text-tertiary bg-surface-1 border-b border-border-subtle',
              sticky && 'sticky top-0 z-10',
            )}
          >
            <tr>
              {selectable && (
                <th className="w-9 px-3">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="rounded border-border-strong bg-surface-2 text-brand-600 focus:ring-brand-500"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'h-8 px-3 text-left font-medium',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.priority && PRIO_HIDE[c.priority],
                    c.className,
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header ?? c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`s${i}`} className="border-b border-border-subtle">
                    {selectable && (
                      <td className="w-9 px-3">
                        <Skeleton h="h-4" w="16px" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(DENSITY_PADDING[density], c.priority && PRIO_HIDE[c.priority])}
                      >
                        <Skeleton h="h-3" w="80%" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows && rows.length > 0
              ? rows.map((row, i) => {
                  const k = keyOf(row, i);
                  const isSelected = selection.has(k);
                  return (
                    <tr
                      key={k}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'border-b border-border-subtle/60 transition-colors duration-fast',
                        onRowClick && 'cursor-pointer',
                        isSelected
                          ? 'bg-brand-500/10 border-l-2 border-l-brand-500'
                          : 'hover:bg-surface-3',
                      )}
                    >
                      {selectable && (
                        <td className="w-9 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(k)}
                            aria-label="Select row"
                            className="rounded border-border-strong bg-surface-2 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            DENSITY_PADDING[density],
                            'text-text-primary',
                            c.align === 'right' && 'text-right',
                            c.align === 'center' && 'text-center',
                            c.priority && PRIO_HIDE[c.priority],
                            c.className,
                          )}
                        >
                          {defaultCell(row, c)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
        {!loading && rows && rows.length === 0 && (
          empty ?? <EmptyState title="No data" description="Nothing matches the current filter." />
        )}
      </div>

      {selectable && selection.size > 0 && bulkActions && (
        <div className="px-3 py-2 border-t border-border-subtle bg-surface-1 flex items-center justify-between gap-3 animate-slide-up">
          <span className="text-xs text-text-secondary">
            {selection.size} selected
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}
    </div>
  );
}
