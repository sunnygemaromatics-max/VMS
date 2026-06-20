'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { PASSWORD_RESET_ENABLED } from '@/lib/auth-features';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!PASSWORD_RESET_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-surface-950 relative">
        <div className="absolute top-6 left-6">
          <Logo size={36} />
        </div>
        <div className="w-full max-w-sm text-center">
          <h2 className="text-2xl font-semibold text-white mb-1">Password reset disabled</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Ask your administrator to reset your password for this environment.
          </p>
          <Link href="/auth/login" className="text-brand-300 hover:text-brand-200 text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.text();
        let msg = body;
        try { msg = JSON.parse(body).message ?? body; } catch {}
        throw new Error(msg || 'Request failed');
      }
      const data = await res.json();
      setSent(true);
      // If email is not configured, the API returns the token so we can show
      // a clickable reset link instead of leaving the user stuck.
      if (data.token) setResetToken(data.token);
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
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>

        <h2 className="text-2xl font-semibold text-white mb-1">Forgot password</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Enter your account email — we'll send you a reset link.
        </p>

        {sent ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                If <strong>{email}</strong> is registered, a reset link is on its way.
                The link expires in 30 minutes.
              </p>
            </div>
            {resetToken && (
              <div className="pt-2 border-t border-green-500/20">
                <p className="text-xs text-green-300 mb-1">
                  ⚡ Email isn't configured — use this direct link:
                </p>
                <Link
                  href={`/auth/reset?token=${resetToken}`}
                  className="text-xs underline break-all text-white hover:text-green-200"
                >
                  /auth/reset?token={resetToken.slice(0, 20)}…
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-300">{error}</p>
            )}
            <div className="relative rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/30">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-transparent pl-9 pr-3 py-3 text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !email}
              className="w-full py-3 rounded-xl bg-brand-gradient text-white font-medium hover:-translate-y-0.5 transition-transform hover:shadow-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
