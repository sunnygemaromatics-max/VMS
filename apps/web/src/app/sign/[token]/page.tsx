'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, FileSignature, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@vms/ui';
import { API_URL } from '@/lib/api';

interface DocView {
  id: string;
  status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED';
  signerName: string;
  signedAt: string | null;
  template: {
    name: string;
    kind: string;
    bodyMarkdown: string;
    requiresFields?: { name: string; label: string; type?: string; required?: boolean }[] | null;
  };
}

// Minimal, dependency-free markdown: headings, bold, line breaks.
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  return esc(md)
    .replace(/^### (.*)$/gm, '<h3 class="text-base font-semibold text-text-primary mt-4 mb-1">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="text-lg font-semibold text-text-primary mt-5 mb-2">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-xl font-bold text-text-primary mt-2 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<DocView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'signed' | 'declined' | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    fetch(`${API_URL}/sign/${token}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Document not found');
        return r.json();
      })
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [token]);

  // Canvas signature pad — pointer events, no dependency.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#F3F5FA';
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    };
    const down = (e: PointerEvent) => { drawing.current = true; hasInk.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const up = () => { drawing.current = false; };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [doc?.status]);

  function clearPad() {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }

  async function submit() {
    if (!hasInk.current) {
      setError('Please sign in the box before submitting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signatureData = canvasRef.current!.toDataURL('image/png');
      const r = await fetch(`${API_URL}/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, filledFields: fields }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Signing failed');
      setDone('signed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await fetch(`${API_URL}/sign/${token}/decline`, { method: 'POST' });
      setDone('declined');
    } finally {
      setBusy(false);
    }
  }

  // ── States ──────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">{children}</div>
    </main>
  );

  if (error && !doc) {
    return (
      <Shell>
        <div className="text-center py-16">
          <XCircle className="w-12 h-12 text-danger mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-text-primary">Link not valid</h1>
          <p className="text-sm text-text-tertiary mt-1">{error}</p>
        </div>
      </Shell>
    );
  }
  if (!doc) {
    return <Shell><p className="text-center text-text-tertiary py-16">Loading…</p></Shell>;
  }

  if (done === 'signed' || doc.status === 'SIGNED') {
    return (
      <Shell>
        <div className="text-center py-16">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-text-primary">Signed — thank you</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Your agreement to <strong className="text-text-secondary">{doc.template.name}</strong> is on record.
          </p>
        </div>
      </Shell>
    );
  }
  if (done === 'declined' || doc.status === 'DECLINED') {
    return (
      <Shell>
        <div className="text-center py-16">
          <XCircle className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-text-primary">Declined</h1>
          <p className="text-sm text-text-tertiary mt-1">You declined this document. You may close this page.</p>
        </div>
      </Shell>
    );
  }
  if (doc.status === 'EXPIRED') {
    return (
      <Shell>
        <div className="text-center py-16">
          <XCircle className="w-12 h-12 text-warning mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-text-primary">Link expired</h1>
          <p className="text-sm text-text-tertiary mt-1">Please ask your host to re-send the document.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="bg-surface-2 border border-border-subtle rounded-xl overflow-hidden shadow-op-2">
        <header className="px-6 py-4 border-b border-border-subtle flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center">
            <FileSignature className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-md font-semibold text-text-primary">{doc.template.name}</h1>
            <p className="text-xs text-text-tertiary">For {doc.signerName}</p>
          </div>
        </header>

        <div className="px-6 py-5 max-h-[40vh] overflow-y-auto text-sm text-text-secondary leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.template.bodyMarkdown) }} />
        </div>

        {doc.template.requiresFields?.length ? (
          <div className="px-6 pb-4 space-y-3">
            {doc.template.requiresFields.map((f) => (
              <label key={f.name} className="block">
                <span className="text-xs uppercase tracking-wider text-text-tertiary">{f.label}</span>
                <input
                  type={f.type || 'text'}
                  value={fields[f.name] || ''}
                  onChange={(e) => setFields((s) => ({ ...s, [f.name]: e.target.value }))}
                  className="mt-1 block w-full h-9 px-3 rounded-md bg-surface-1 border border-border-subtle text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="px-6 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs uppercase tracking-wider text-text-tertiary">Sign below</span>
            <button onClick={clearPad} className="text-xs text-text-tertiary hover:text-text-primary">Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            width={760}
            height={180}
            className="w-full h-[180px] rounded-md bg-surface-1 border border-border-strong touch-none cursor-crosshair"
          />
        </div>

        {error && <p className="px-6 text-xs text-danger">{error}</p>}

        <footer className="px-6 py-4 border-t border-border-subtle flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-tertiary flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Signature is recorded with a tamper-evident hash.
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={decline} disabled={busy}>Decline</Button>
            <Button variant="primary" onClick={submit} loading={busy}>Agree &amp; sign</Button>
          </div>
        </footer>
      </div>
    </Shell>
  );
}
