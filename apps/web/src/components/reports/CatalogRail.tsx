'use client';

import { useState } from 'react';
import {
  Users,
  HardHat,
  Building2,
  UserCog,
  Package,
  ShieldAlert,
  ScrollText,
  Car,
  DoorOpen,
  ChevronDown,
  Search,
  type LucideIcon,
} from 'lucide-react';

export interface CatalogReport {
  key: string;
  label: string;
  description: string;
  icon: string;
}
export interface CatalogSection {
  key: string;
  label: string;
  reports: CatalogReport[];
}

const ICONS: Record<string, LucideIcon> = {
  Users,
  HardHat,
  Building2,
  UserCog,
  Package,
  ShieldAlert,
  ScrollText,
  Car,
  DoorOpen,
};

interface Props {
  sections: CatalogSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * Left-rail category navigation. Renders the catalog as collapsible
 * accordion groups, with a filter input at the top so the user can
 * find a report by name. All sections default to expanded so the full
 * surface is one click away.
 */
export function CatalogRail({ sections, activeKey, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');

  const filter = (r: CatalogReport) =>
    !q.trim() ||
    r.label.toLowerCase().includes(q.toLowerCase()) ||
    r.description.toLowerCase().includes(q.toLowerCase());

  return (
    <aside className="w-full lg:w-64 shrink-0 rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
      <div className="p-3 border-b border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-semibold mb-2">
          Report catalog
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a report…"
            className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-text-primary placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
          />
        </div>
      </div>

      <nav className="py-2 max-h-[640px] overflow-y-auto">
        {sections.map((s) => {
          const isCollapsed = !!collapsed[s.key];
          const matching = s.reports.filter(filter);
          if (q.trim() && matching.length === 0) return null;
          return (
            <div key={s.key} className="px-2 py-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [s.key]: !c[s.key] }))}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-text-tertiary hover:text-text-primary"
              >
                <span>{s.label}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {!isCollapsed && (
                <ul className="mt-0.5">
                  {matching.map((r) => {
                    const Icon = ICONS[r.icon] || Users;
                    const isActive = r.key === activeKey;
                    return (
                      <li key={r.key}>
                        <button
                          type="button"
                          data-tab={r.key}
                          data-active={isActive}
                          onClick={() => onSelect(r.key)}
                          className={`group w-full flex items-start gap-2.5 px-2 py-2 rounded-md text-left text-xs transition-colors ${
                            isActive
                              ? 'bg-brand-500/10 text-text-primary ring-1 ring-brand-500/30'
                              : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              isActive ? 'text-brand-400' : 'text-text-tertiary group-hover:text-text-secondary'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium truncate">{r.label}</span>
                            <span className="block text-[10px] text-text-tertiary leading-snug line-clamp-2">
                              {r.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
