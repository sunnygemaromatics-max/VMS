'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, History, Clock, CheckCircle2, XCircle, Hourglass, AlertCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Visit {
  id: string;
  status: string;
  purpose: string;
  expectedEntry: string;
  actualEntry: string | null;
  actualExit: string | null;
  vehicleNumber: string | null;
  qrCodeToken: string;
  branch: { name: string; location: string };
  host: { fullName: string };
  passUrl: string;
}
interface LookupResponse {
  found: boolean;
  fullName: string | null;
  company?: string | null;
  blacklisted?: boolean;
  visits: Visit[];
}

const STATUS_META: Record<string, { color: string; icon: any }> = {
  PENDING: { color: 'text-yellow-300 bg-yellow-500/10', icon: Hourglass },
  APPROVED: { color: 'text-green-300 bg-green-500/10', icon: CheckCircle2 },
  CHECKED_IN: { color: 'text-blue-300 bg-blue-500/10', icon: Clock },
  CHECKED_OUT: { color: 'text-zinc-300 bg-zinc-500/10', icon: CheckCircle2 },
  REJECTED: { color: 'text-red-300 bg-red-500/10', icon: XCircle },
  BLACKLISTED: { color: 'text-red-300 bg-red-500/10', icon: XCircle },
};

export default function MyVisitsPage() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/public/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = t;
        try { msg = JSON.parse(t).message ?? t; } catch {}
        setError(msg || `Lookup failed (${res.status})`);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <History className="w-10 h-10 text-blue-400 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-white">My visits</h1>
          <p className="text-sm text-zinc-400">
            Look up your visits by the phone number you registered with.
          </p>
        </div>

        <form
          onSubmit={lookup}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-6"
        >
          <label className="block text-xs text-zinc-400 mb-2 uppercase">Phone</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+10000000001"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-950/50 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {loading ? '…' : 'Look up'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {result && !result.found && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-400">
            No visits found for that phone number.
          </div>
        )}

        {result && result.found && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 mb-4">
              <p className="text-xs text-zinc-500 uppercase">Visitor</p>
              <p className="text-white font-semibold text-lg">{result.fullName}</p>
              {result.company && <p className="text-sm text-zinc-400">{result.company}</p>}
              {result.blacklisted && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/15 text-red-300 text-sm">
                  <XCircle className="w-4 h-4" /> This visitor is currently blacklisted.
                </div>
              )}
            </div>

            <p className="text-sm text-zinc-400 mb-3">
              {result.visits.length} visit{result.visits.length === 1 ? '' : 's'} found.
            </p>

            <div className="space-y-3">
              {result.visits.map((v) => {
                const meta = STATUS_META[v.status] ?? STATUS_META.PENDING;
                const Icon = meta.icon;
                return (
                  <Link
                    key={v.id}
                    href={v.passUrl}
                    className="block rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {v.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(v.expectedEntry).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white">{v.purpose}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Host: {v.host?.fullName ?? '—'}
                      {v.branch?.name ? ` · ${v.branch.name}` : ''}
                      {v.branch?.location ? ` (${v.branch.location})` : ''}
                    </p>
                    {v.vehicleNumber && (
                      <p className="text-xs text-zinc-500 mt-1">Vehicle: {v.vehicleNumber}</p>
                    )}
                  </Link>
                );
              })}
            </div>

            {result.visits.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-zinc-500 text-sm">
                No visits yet for this number.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
