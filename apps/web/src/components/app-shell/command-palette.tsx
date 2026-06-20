'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, User, HardHat, Building2, CornerDownLeft } from 'lucide-react';
import { cn, Kbd } from '@vms/ui';
import { useI18n } from '@/lib/i18n';
import { apiGet } from '@/lib/api';
import { ALL_NAV_LEAVES } from './nav-config';

interface SearchHit {
  kind: 'visitor' | 'worker' | 'contractor';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cmd+K palette. Searches: routes (always), visitors/workers via API
 * (when backend search ships), actions (approve/blacklist/etc when RBAC
 * surfaces them). Today: routes only.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFocused(0);
      setHits([]);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Debounced entity search against the API (visitors / workers / contractors).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => {
      apiGet<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`)
        .then(setHits)
        .catch(() => setHits([]));
    }, 120);
    return () => clearTimeout(id);
  }, [query]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const routes = ALL_NAV_LEAVES.map((leaf) => ({
      type: 'route' as const,
      key: `route:${leaf.href}`,
      label: t(leaf.i18nKey),
      hint: leaf.href,
      onSelect: () => router.push(leaf.href),
    }));
    const routeMatches = !q
      ? routes
      : routes
          .map((item) => ({
            ...item,
            score:
              item.label.toLowerCase().startsWith(q) ? 3 :
              item.label.toLowerCase().includes(q) ? 2 :
              item.hint.toLowerCase().includes(q) ? 1 : 0,
          }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);

    // Entity hits rank above routes when searching.
    const entityItems = hits.map((h) => ({
      type: h.kind,
      key: `${h.kind}:${h.id}`,
      label: h.label,
      hint: h.sublabel ?? '',
      badge: h.badge,
      onSelect: () => router.push(h.href),
    }));

    return q ? [...entityItems, ...routeMatches] : routeMatches;
  }, [query, t, router, hits]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((f) => Math.min(items.length - 1, f + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((f) => Math.max(0, f - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[focused];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items, focused, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 sm:pt-24 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-surface-2 border border-border-subtle rounded-xl shadow-op-3 overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border-subtle">
          <Search className="w-4 h-4 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocused(0);
            }}
            placeholder="Search routes, visitors, actions…"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-text-tertiary">No results</li>
          ) : (
            items.map((item, i) => {
              const Icon =
                item.type === 'visitor' ? User :
                item.type === 'worker' ? HardHat :
                item.type === 'contractor' ? Building2 : ArrowRight;
              return (
                <li
                  key={item.key}
                  onMouseEnter={() => setFocused(i)}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-4 h-9 cursor-pointer text-sm',
                    i === focused ? 'bg-surface-3 text-text-primary' : 'text-text-secondary',
                  )}
                >
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      i === focused ? 'text-brand-400' : 'text-text-tertiary',
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span className="text-[10px] uppercase tracking-wider text-brand-300">{item.badge}</span>
                  )}
                  <span className="font-mono text-[10px] text-text-tertiary truncate max-w-[40%]">{item.hint}</span>
                </li>
              );
            })
          )}
        </ul>
        <footer className="px-4 h-9 flex items-center justify-end gap-3 border-t border-border-subtle text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
        </footer>
      </div>
    </div>
  );
}
