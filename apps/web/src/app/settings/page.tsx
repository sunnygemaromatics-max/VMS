'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { User, Building2, Lock, Server, ShieldCheck, CheckCircle2, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGet, apiPost, apiPut, API_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Me {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
  branch: { id: string; name: string; location: string };
  totpEnabled: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  // 2FA state
  const [totp, setTotp] = useState<null | { secret: string; otpauthUrl: string }>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [disablePw, setDisablePw] = useState('');
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<Me>('/auth/me')
      .then(setMe)
      .catch((e) => setMeError(e instanceof Error ? e.message : 'Failed'));
  }, [isAuthenticated]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (next !== confirm) {
      setPwError("New passwords don't match");
      return;
    }
    if (next.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    setPwBusy(true);
    try {
      await apiPut('/auth/password', { currentPassword: current, newPassword: next });
      setPwOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Change failed');
    } finally {
      setPwBusy(false);
    }
  }

  async function setupTotp() {
    setTotpError(null);
    setTotpBusy(true);
    try {
      const r = await apiPost<{ secret: string; otpauthUrl: string }>(
        '/auth/2fa/setup',
        {},
      );
      setTotp(r);
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setTotpBusy(false);
    }
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setTotpError(null);
    setTotpBusy(true);
    try {
      await apiPost('/auth/2fa/enable', { totp: totpCode });
      setTotp(null);
      setTotpCode('');
      // reload profile so the UI flips to "enabled"
      apiGet<Me>('/auth/me').then(setMe).catch(() => {});
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setTotpBusy(false);
    }
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault();
    setTotpError(null);
    setTotpBusy(true);
    try {
      await apiPost('/auth/2fa/disable', {
        currentPassword: disablePw,
        totp: disableCode,
      });
      setDisablePw('');
      setDisableCode('');
      apiGet<Me>('/auth/me').then(setMe).catch(() => {});
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Disable failed');
    } finally {
      setTotpBusy(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('settings.title')}</h2>
          <p className="text-zinc-400">{t('settings.subtitle')}</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Profile</h3>
          </div>
          {meError && (
            <p className="text-sm text-red-300 mb-3">Failed to load profile: {meError}</p>
          )}
          {!me && !meError && <p className="text-sm text-zinc-500">Loading…</p>}
          {me && (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Full name" value={me.fullName} />
              <Field label="Email" value={me.email} mono />
              <Field
                label="Role"
                value={
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-xs">
                    {me.role}
                  </span>
                }
              />
              <Field
                label="Branch"
                value={
                  <>
                    <Building2 className="inline w-3 h-3 mr-1" />
                    {me.branch.name} — {me.branch.location}
                  </>
                }
              />
              <Field label="User ID" value={me.id} mono />
              <Field
                label="Member since"
                value={new Date(me.createdAt).toLocaleDateString()}
              />
            </dl>
          )}
        </div>

        {/* Password change */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Change password</h3>
          </div>
          <form onSubmit={changePassword} className="space-y-3 max-w-md">
            <input
              type="password"
              placeholder="Current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="New password (min 6)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pwError && (
              <p className="text-sm text-red-300">{pwError}</p>
            )}
            {pwOk && (
              <p className="text-sm text-green-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Password updated.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={pwBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {pwBusy ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/auth/login');
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>

        {/* 2FA */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="w-5 h-5 text-brand-400" />
            <h3 className="text-lg font-semibold text-white">
              Two-factor authentication
            </h3>
            {me?.totpEnabled && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 text-xs font-medium">
                Enabled
              </span>
            )}
          </div>

          {totpError && (
            <p className="mb-3 text-sm text-red-300">{totpError}</p>
          )}

          {!me?.totpEnabled && !totp && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Add a 6-digit code from Google Authenticator / Authy on every sign-in.
              </p>
              <button
                onClick={setupTotp}
                disabled={totpBusy}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {totpBusy ? 'Generating…' : 'Set up 2FA'}
              </button>
            </div>
          )}

          {!me?.totpEnabled && totp && (
            <form onSubmit={enableTotp} className="space-y-4">
              <p className="text-sm text-zinc-300">
                1. Scan this QR with your authenticator app:
              </p>
              <div className="bg-white rounded-xl p-4 inline-block">
                <QRCodeSVG value={totp.otpauthUrl} size={180} level="M" includeMargin />
              </div>
              <p className="text-xs text-zinc-500 font-mono break-all">
                Or enter manually: <span className="text-zinc-300">{totp.secret}</span>
              </p>
              <p className="text-sm text-zinc-300">2. Enter the 6-digit code to confirm:</p>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-40 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={totpBusy || totpCode.length !== 6}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {totpBusy ? 'Verifying…' : 'Enable 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => { setTotp(null); setTotpCode(''); setTotpError(null); }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {me?.totpEnabled && (
            <form onSubmit={disableTotp} className="space-y-3 max-w-sm">
              <p className="text-sm text-zinc-300">
                To turn off 2FA, enter your password and a current code from the app:
              </p>
              <input
                type="password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                placeholder="Current password"
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                maxLength={6}
                className="w-40 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={totpBusy || !disablePw || disableCode.length !== 6}
                className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {totpBusy ? 'Disabling…' : 'Disable 2FA'}
              </button>
            </form>
          )}
        </div>

        {/* System info */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">System</h3>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="API URL" value={API_URL} mono />
            <Field
              label="Security"
              value={
                <>
                  <ShieldCheck className="inline w-3 h-3 mr-1 text-green-400" />
                  JWT auth, RBAC, rate-limited (10/s)
                </>
              }
            />
          </dl>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 uppercase mb-1">{label}</dt>
      <dd className={`text-zinc-100 ${mono ? 'font-mono text-sm break-all' : ''}`}>{value}</dd>
    </div>
  );
}
