'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Lock, CheckCircle2 } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-400">
          Loading…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!res.ok) {
        const body = await res.text();
        let msg = body;
        try { msg = JSON.parse(body).message ?? body; } catch {}
        throw new Error(msg || 'Reset failed');
      }
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-surface-950 relative">
      <div className="absolute top-6 left-6">
        <Logo size={36} />
      </div>

      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-semibold text-white mb-1">Reset password</h2>
        <p className="text-sm text-zinc-400 mb-6">
          {token ? 'Choose a new password for your account.' : 'No token in URL — request a fresh reset link.'}
        </p>

        {!token ? (
          <Link
            href="/auth/forgot"
            className="inline-block text-sm text-brand-400 hover:text-brand-300"
          >
            ← Back to forgot password
          </Link>
        ) : done ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Password reset. Redirecting to sign-in…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Field>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6)"
                required
                minLength={6}
                className="w-full bg-transparent pl-9 pr-3 py-3 text-white placeholder-zinc-500 focus:outline-none"
              />
            </Field>
            <Field>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                className="w-full bg-transparent pl-9 pr-3 py-3 text-white placeholder-zinc-500 focus:outline-none"
              />
            </Field>
            <button
              type="submit"
              disabled={busy || !newPassword || !confirm}
              className="w-full py-3 rounded-xl bg-brand-gradient text-white font-medium hover:-translate-y-0.5 transition-transform hover:shadow-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/30">
      <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
      {children}
    </div>
  );
}
