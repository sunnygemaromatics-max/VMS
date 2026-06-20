'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Plus, Star, Trash2, Loader2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';

export interface Template {
  id: string;
  name: string;
  report: string;
  groupBy: string | null;
  branchId: string | null;
  contractorId: string | null;
  rangePreset: string;
  columns: string | null;
  isFavorite: boolean;
  updatedAt: string;
}

interface Props {
  /** Apply a template — restores its filters / columns into the workspace. */
  onApply: (t: Template) => void;
  /** When the user clicks "Save view as…", returns the current snapshot. */
  buildSnapshot: () => Omit<Template, 'id' | 'isFavorite' | 'updatedAt'>;
}

/**
 * Right-rail panel for user-saved report templates. Lets the user save
 * the current report view (filters + group-by + selected columns),
 * favorite frequently-used ones, and apply with one click.
 */
export function TemplatesPanel({ onApply, buildSnapshot }: Props) {
  const [items, setItems] = useState<Template[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiGet<Template[]>('/reports/templates/list').then(setItems).catch(() => setItems([]));
  }
  useEffect(load, []);

  async function save() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setBusy('create');
    try {
      const snap = buildSnapshot();
      await apiPost('/reports/templates', { ...snap, name: name.trim() });
      setName('');
      setCreating(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setBusy(null);
    }
  }

  async function toggleFav(t: Template) {
    setBusy(t.id);
    try {
      await apiPost(`/reports/templates/${t.id}/favorite`, {});
      load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Delete saved view "${t.name}"?`)) return;
    setBusy(t.id);
    try {
      await apiDelete(`/reports/templates/${t.id}`);
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-text-primary">Saved views</h3>
        </div>
        <button
          type="button"
          onClick={() => { setCreating((c) => !c); setError(null); }}
          className="p-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary border border-border-subtle"
          aria-label="Save current view"
          title="Save current view"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {creating && (
        <div className="px-4 py-3 border-b border-border-subtle bg-surface-2/40">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly contractor hours"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setCreating(false); }}
            className="w-full bg-surface-1 border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
          />
          {error && <p className="text-[10px] text-red-300 mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={save}
              disabled={busy === 'create'}
              className="flex-1 px-2.5 py-1.5 rounded-md bg-brand-gradient text-white text-xs font-medium disabled:opacity-60"
            >
              {busy === 'create' ? 'Saving…' : 'Save view'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs border border-border-subtle"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="p-6 text-center text-text-tertiary text-xs">Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-6 text-center text-text-tertiary text-xs">
          No saved views yet. Set up the filters / columns you like, then click
          <span className="inline-flex items-center gap-1 mx-1"><Plus className="w-3 h-3" /></span>
          above to save them.
        </div>
      ) : (
        <ul className="max-h-96 overflow-y-auto py-1">
          {items.map((t) => (
            <li key={t.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-surface-2 transition-colors">
              <button
                type="button"
                onClick={() => toggleFav(t)}
                disabled={busy === t.id}
                className="mt-0.5 text-text-tertiary hover:text-amber-400"
                aria-label={t.isFavorite ? 'Unfavorite' : 'Favorite'}
              >
                <Star className={`w-3.5 h-3.5 ${t.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onApply(t)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-xs font-medium text-text-primary truncate">{t.name}</div>
                <div className="text-[10px] text-text-tertiary truncate">
                  {t.report}{t.groupBy ? ` · ${t.groupBy}` : ''} · {t.rangePreset}
                </div>
              </button>
              <button
                type="button"
                onClick={() => remove(t)}
                disabled={busy === t.id}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                aria-label="Delete"
              >
                {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
