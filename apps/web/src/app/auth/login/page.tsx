'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { PASSWORD_RESET_ENABLED, PUBLIC_SIGNUP_ENABLED } from '@/lib/auth-features';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const r = await login(email, password, needTotp ? totp : undefined);
      if (r.totpRequired) {
        setNeedTotp(true);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-gradient opacity-90" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_50%)]"
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.04%22%20d%3D%22M0%2039h40v1H0zM39%200v40h1V0z%22/%3E%3C/svg%3E')]" />
        <div className="relative z-10 m-auto px-12 max-w-md">
          <Logo size={56} />
          <h1 className="mt-10 text-4xl font-semibold text-white leading-tight">
            Enterprise visitor
            <br /> &amp; workforce platform
          </h1>
          <p className="mt-4 text-white/80">
            Real-time gate intelligence, contract workforce ops, compliance + audit,
            face recognition for Gem Aromatics Group.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 text-xs text-white/80">
            <Feat label="Real-time headcount" />
            <Feat label="Face recognition" />
            <Feat label="Approval workflow" />
            <Feat label="Multi-tenant" />
            <Feat label="Shifts + payroll" />
            <Feat label="EN + हिन्दी" />
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface-950 relative">
        <div className="lg:hidden absolute top-6 left-6">
          <Logo size={36} />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white">{t('auth.welcome')}</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {PUBLIC_SIGNUP_ENABLED ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <Link
                    href="/auth/signup"
                    className="text-brand-400 hover:text-brand-300 font-medium"
                  >
                    {t('auth.signupCta')}
                  </Link>
                </>
              ) : (
                'Contact your administrator for account access.'
              )}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldWithIcon icon={Mail}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('common.email')}
                disabled={isLoading}
                required
                className="w-full bg-transparent pl-9 pr-3 py-3 text-white placeholder-zinc-500 focus:outline-none"
              />
            </FieldWithIcon>
            <FieldWithIcon icon={Lock}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('common.password')}
                disabled={isLoading}
                required
                className="w-full bg-transparent pl-9 pr-3 py-3 text-white placeholder-zinc-500 focus:outline-none"
              />
            </FieldWithIcon>

            {needTotp && (
              <div>
                <label className="block text-xs text-zinc-400 uppercase mb-2">
                  Two-factor code
                </label>
                <input
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500/60"
                />
              </div>
            )}

            {PASSWORD_RESET_ENABLED ? (
              <div className="flex items-center justify-end">
                <Link
                  href="/auth/forgot"
                  className="text-xs text-zinc-400 hover:text-brand-300"
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || (needTotp && totp.length !== 6)}
              className="w-full py-3 rounded-xl bg-brand-gradient text-white font-medium transition-transform hover:-translate-y-0.5 hover:shadow-brand disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? t('common.loading') : (
                <>
                  {t('auth.signinCta')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

function FieldWithIcon({
  icon: Icon,
  children,
}: {
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/30 transition-colors">
      <Icon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
      {children}
    </div>
  );
}

function Feat({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1 h-1 rounded-full bg-white/80" />
      {label}
    </div>
  );
}
