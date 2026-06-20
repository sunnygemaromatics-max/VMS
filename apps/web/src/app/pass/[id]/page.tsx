'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Hourglass,
  MapPin,
  Phone,
  User,
  XCircle,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { VisitorAvatar } from '@/components/visitor-avatar';

interface PassData {
  visitId: string;
  qrCodeToken: string;
  status: string;
  purpose: string;
  expectedEntry: string;
  actualEntry: string | null;
  actualExit: string | null;
  vehicleNumber: string | null;
  visitorId?: string;
  visitor: { fullName: string; company: string | null; phone: string };
  host: { fullName: string; email: string };
  branch: { name: string; location: string };
}

const STATUS_META: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  PENDING: { color: 'text-yellow-300', bg: 'bg-yellow-500/15', icon: Hourglass, label: 'Awaiting host approval' },
  APPROVED: { color: 'text-green-300', bg: 'bg-green-500/15', icon: CheckCircle2, label: 'Approved — show this QR at the gate' },
  CHECKED_IN: { color: 'text-blue-300', bg: 'bg-blue-500/15', icon: Clock, label: 'Checked in — welcome!' },
  CHECKED_OUT: { color: 'text-zinc-300', bg: 'bg-zinc-500/15', icon: CheckCircle2, label: 'Checked out' },
  REJECTED: { color: 'text-red-300', bg: 'bg-red-500/15', icon: XCircle, label: 'Rejected by host' },
  BLACKLISTED: { color: 'text-red-300', bg: 'bg-red-500/15', icon: XCircle, label: 'Entry denied' },
};

export default function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pass, setPass] = useState<PassData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/pass/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? 'Pass not found' : `Error ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPass(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error');
      }
    }
    load();
    // Auto-refresh every 10s so status updates appear when host approves/rejects
    const t = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white mb-2">{error}</h1>
          <p className="text-sm text-zinc-400">
            The pass link is invalid or has been removed. Contact your host.
          </p>
        </div>
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Loading pass…
      </div>
    );
  }

  const meta = STATUS_META[pass.status] ?? STATUS_META.PENDING;
  const Icon = meta.icon;
  const showQR = pass.status === 'APPROVED' || pass.status === 'CHECKED_IN';

  return (
    <main className="min-h-screen flex items-start md:items-center justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Visitor Pass</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Status banner */}
          <div className={`${meta.bg} px-6 py-4 flex items-center gap-3 border-b border-white/5`}>
            <Icon className={`w-6 h-6 ${meta.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-zinc-400">{pass.status.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {/* Photo + QR */}
          <div className="p-6 flex flex-col items-center gap-4">
            {pass.visitorId && (
              <VisitorAvatar visitorId={pass.visitorId} name={pass.visitor.fullName} />
            )}
            {showQR ? (
              <div className="bg-white rounded-2xl p-5 flex items-center justify-center mx-auto" style={{ width: 'fit-content' }}>
                <QRCodeSVG value={pass.qrCodeToken} size={200} level="M" includeMargin />
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-white/10 p-10 text-center text-zinc-500 w-full">
                <p className="text-sm">QR code appears once your host approves the visit.</p>
                <p className="text-xs mt-2 font-mono">{pass.qrCodeToken}</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="px-6 pb-6 space-y-4 text-sm">
            <Row icon={User} label="Visitor" value={pass.visitor.fullName} sub={pass.visitor.company ?? undefined} />
            <Row icon={Phone} label="Phone" value={pass.visitor.phone} mono />
            <Row icon={User} label="Host" value={pass.host.fullName} sub={pass.host.email} />
            <Row icon={MapPin} label="Location" value={pass.branch.name} sub={pass.branch.location} />
            <Row icon={Calendar} label="Expected entry" value={new Date(pass.expectedEntry).toLocaleString()} />
            {pass.vehicleNumber && (
              <Row icon={Car} label="Vehicle" value={pass.vehicleNumber} mono />
            )}
            {pass.actualEntry && (
              <Row icon={Clock} label="Checked in at" value={new Date(pass.actualEntry).toLocaleString()} />
            )}
            {pass.actualExit && (
              <Row icon={Clock} label="Checked out at" value={new Date(pass.actualExit).toLocaleString()} />
            )}
            <div className="pt-2">
              <p className="text-xs text-zinc-500 uppercase mb-1">Purpose</p>
              <p className="text-zinc-200">{pass.purpose}</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-500 text-center">
          Keep this page open for entry. <Link href="/" className="text-blue-400 hover:underline">Dashboard</Link>
        </p>
      </div>
    </main>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  sub,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`text-zinc-100 ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
