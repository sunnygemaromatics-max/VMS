'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { CommandPalette } from './command-palette';
import { SideRail } from './side-rail';
import { TopBar } from './top-bar';

const STORAGE_KEY = 'aegis_sidebar_expanded';

/**
 * Aegis app shell — collapsible left rail + top bar + command palette.
 * Wraps page routes; pages render inside the main scroll region.
 *
 * VMS (legacy) brand keeps using DashboardHeader; this shell is opt-in
 * per page during the migration, then made global once parity is reached.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Persist sidebar state per user
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved != null) setExpanded(saved === '1');
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
  }, [expanded]);

  // Bounce to login if unauthenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  // Global Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-tertiary text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <SideRail expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      <div
        style={{ paddingLeft: 'var(--rail-w)' }}
        className="transition-[padding] duration-normal"
        // eslint-disable-next-line react/no-unknown-property
      >
        <style jsx>{`
          div {
            --rail-w: ${expanded ? '15rem' : '4rem'};
          }
          @media (max-width: 767px) {
            div {
              --rail-w: 0;
            }
          }
        `}</style>
        <TopBar onOpenCommand={() => setPaletteOpen(true)} />
        <main className="px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
