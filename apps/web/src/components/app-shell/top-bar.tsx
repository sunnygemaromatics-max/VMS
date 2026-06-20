'use client';

import { LogOut, Search, Globe, Activity, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Kbd } from '@vms/ui';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';

interface Props {
  onOpenCommand: () => void;
}

export function TopBar({ onOpenCommand }: Props) {
  const { user, logout } = useAuth();
  const { lang, setLang } = useI18n();
  const router = useRouter();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border-subtle bg-surface-1">
      <div className="h-full px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        {/* Branch chip — placeholder; wired to real data later */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 h-8 rounded-md bg-surface-2 border border-border-subtle text-sm text-text-secondary">
          <span className="text-text-tertiary text-xs uppercase tracking-wider">Branch</span>
          <span className="font-medium text-text-primary">HQ</span>
        </div>

        {/* Command palette trigger */}
        <button
          onClick={onOpenCommand}
          className="flex-1 max-w-md flex items-center gap-2 h-8 px-3 rounded-md bg-surface-2 border border-border-subtle hover:bg-surface-3 text-sm text-text-tertiary transition-colors duration-fast"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left truncate">Search or jump to…</span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex-1 sm:flex-none" />

        {/* Live indicator */}
        <Badge tone="success" variant="soft" dot className="hidden md:inline-flex">
          <Activity className="w-3 h-3" />
          LIVE
        </Badge>

        {/* Language toggle */}
        <div className="hidden sm:flex items-center gap-0.5 px-1 h-8 rounded-md bg-surface-2 border border-border-subtle">
          <Globe className="w-3.5 h-3.5 text-text-tertiary ml-1.5" />
          <button
            onClick={() => setLang('en')}
            className={`px-1.5 text-xs font-medium ${
              lang === 'en' ? 'text-brand-300' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            EN
          </button>
          <span className="text-text-tertiary text-xs">·</span>
          <button
            onClick={() => setLang('hi')}
            className={`px-1.5 text-xs font-medium ${
              lang === 'hi' ? 'text-brand-300' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            हि
          </button>
        </div>

        {/* User chip */}
        <div className="hidden md:flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-medium text-text-primary leading-tight">{user.fullName}</p>
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{user.role}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout();
            router.push('/auth/login');
          }}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
