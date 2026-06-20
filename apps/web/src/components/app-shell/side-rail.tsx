'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@vms/ui';
import { Logo } from '@/components/logo';
import { useI18n } from '@/lib/i18n';
import { FOOTER_ITEMS, NAV_SECTIONS } from './nav-config';

interface Props {
  expanded: boolean;
  onToggle: () => void;
}

export function SideRail({ expanded, onToggle }: Props) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside
      data-expanded={expanded}
      className={cn(
        'hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border-subtle bg-surface-1 transition-[width] duration-normal ease-standard',
        expanded ? 'w-60' : 'w-16',
      )}
    >
      {/* Top: logo */}
      <div className="h-14 flex items-center px-3 border-b border-border-subtle">
        {expanded ? (
          <Logo size={28} showWordmark />
        ) : (
          <Logo size={28} showWordmark={false} />
        )}
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_SECTIONS.map((section) => (
          <Section
            key={section.i18nKey}
            section={section}
            expanded={expanded}
            pathname={pathname}
            t={t}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle py-2">
        {FOOTER_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} expanded={expanded} t={t} />
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-surface-2 border border-border-subtle text-text-tertiary hover:text-text-primary hover:bg-surface-3 flex items-center justify-center shadow-op-1 transition-all duration-fast"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  );
}

function Section({
  section,
  expanded,
  pathname,
  t,
}: {
  section: (typeof NAV_SECTIONS)[number];
  expanded: boolean;
  pathname: string | null;
  t: (k: string) => string;
}) {
  const Icon = section.icon;
  const sectionLabel = t(section.i18nKey);
  return (
    <div className="mb-2">
      {expanded && (
        <p className="px-3 mt-3 mb-1 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
          {sectionLabel}
        </p>
      )}
      {!expanded && (
        <div className="mx-3 my-2 h-px bg-border-subtle/60" aria-hidden />
      )}
      <ul className="space-y-0.5 px-2">
        {section.items.map((item) => (
          <li key={item.href}>
            <NavLink
              item={{ ...item, icon: item.icon ?? Icon }}
              active={pathname === item.href}
              expanded={expanded}
              t={t}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLink({
  item,
  active,
  expanded,
  t,
}: {
  item: (typeof NAV_SECTIONS)[number]['items'][number];
  active: boolean;
  expanded: boolean;
  t: (k: string) => string;
}) {
  const Icon = item.icon;
  const label = t(item.i18nKey);
  return (
    <Link
      href={item.href}
      title={!expanded ? label : undefined}
      className={cn(
        'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm relative',
        'transition-colors duration-fast',
        active
          ? 'text-text-primary bg-surface-3'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-3',
        !expanded && 'justify-center',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-500" aria-hidden />
      )}
      {Icon && (
        <Icon
          className={cn(
            'shrink-0 w-4 h-4',
            active ? 'text-brand-400' : 'text-text-tertiary group-hover:text-text-secondary',
          )}
        />
      )}
      {expanded && <span className="truncate">{label}</span>}
    </Link>
  );
}
