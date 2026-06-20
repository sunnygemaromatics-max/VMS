'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { LogOut, User, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { NavMenu } from '@/components/nav-menu';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-1 shadow-sm">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <Logo />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-2 border border-border-subtle">
              <Globe className="w-3.5 h-3.5 text-text-tertiary" />
              <button
                onClick={() => setLang('en')}
                className={`px-2 text-xs font-medium transition-colors ${
                  lang === 'en' ? 'text-brand-400' : 'text-text-tertiary hover:text-text-primary'
                }`}
                title="English"
              >
                EN
              </button>
              <span className="text-text-disabled">·</span>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 text-xs font-medium transition-colors ${
                  lang === 'hi' ? 'text-brand-400' : 'text-text-tertiary hover:text-text-primary'
                }`}
                title="हिन्दी"
              >
                हि
              </button>
            </div>

            <ThemeToggle />

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-text-primary leading-tight">{user.fullName}</p>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{user.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shadow-brand-glow">
              <User className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-danger/15 hover:text-danger text-text-secondary transition-colors text-sm font-medium"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <NavMenu />
      </div>
    </header>
  );
}
