'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ScanFace, ShieldAlert, UserX, XCircle } from 'lucide-react';
import { Button } from '@vms/ui';
import { API_URL, apiPost } from '@/lib/api';
import { describeFace, loadFaceApi } from '@/lib/face-api-loader';

type Decision = {
  decision: 'granted' | 'denied' | 'unmatched' | 'override-granted';
  kind?: 'worker' | 'visitor';
  id?: string;
  name?: string;
  action?: string;
  reasons?: string[];
  canOverride?: boolean;
  reason?: string;
};

type Phase = 'loading' | 'ready' | 'scanning' | 'result';

export default function FaceGatePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [result, setResult] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  // Open camera FIRST (independent of face-api so the viewfinder shows even if
  // the CDN is slow), then load the models in the background.
  useEffect(() => {
    let cancelled = false;

    async function openCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported in this browser (needs HTTPS + getUserMedia).');
      }
      // Try the preferred front-camera + HD constraint first; fall back to "any
      // camera" so desktops without a labelled front cam still work.
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: { ideal: 'user' } } },
        { video: true },
      ];
      let lastErr: unknown;
      for (const c of attempts) {
        try {
          return await navigator.mediaDevices.getUserMedia(c);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error('No camera available');
    }

    (async () => {
      try {
        const stream = await openCamera();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // play() needs a user gesture on some browsers but works after
          // getUserMedia resolved on most. Swallow autoplay rejections.
          await videoRef.current.play().catch(() => {});
        }
        setPhase('ready');
      } catch (e: any) {
        const name = e?.name as string | undefined;
        const msg =
          name === 'NotAllowedError'
            ? 'Camera permission denied — allow camera access in your browser settings.'
            : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : name === 'NotReadableError'
            ? 'Camera is in use by another app — close it and refresh.'
            : e?.message || 'Camera unavailable';
        setError(msg);
        setPhase('ready');
      }

      // Load face models in the background — failure here doesn't block the
      // viewfinder; the scan button will surface the error on use.
      loadFaceApi().catch((e) => {
        if (cancelled) return;
        setError((prev) => prev ?? (e?.message || 'Face engine failed to load'));
      });
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setOverrideReason('');
    setPhase('ready');
  }, []);

  const scan = useCallback(async () => {
    if (!videoRef.current) return;
    setPhase('scanning');
    setError(null);
    try {
      const embedding = await describeFace(videoRef.current);
      if (!embedding) {
        setError('No face detected — center your face and try again.');
        setPhase('ready');
        return;
      }
      const r = await fetch(`${API_URL}/gate/face-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedding, gateId: 'face-gate-kiosk' }),
      });
      const data: Decision = await r.json();
      setResult(data);
      setPhase('result');
      // auto-reset on terminal outcomes
      if (data.decision === 'granted' || data.decision === 'override-granted' || data.decision === 'unmatched') {
        setTimeout(reset, 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setPhase('ready');
    }
  }, [reset]);

  async function approveOverride() {
    if (!result?.id || !result.kind) return;
    if (!overrideReason.trim()) {
      setError('A reason is required to override.');
      return;
    }
    setOverriding(true);
    try {
      const res = await apiPost<Decision>('/gate/face-entry/override', {
        kind: result.kind,
        id: result.id,
        gateId: 'face-gate-kiosk',
        reason: overrideReason,
      });
      setResult(res);
      setTimeout(reset, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed (gateman must be logged in)');
    } finally {
      setOverriding(false);
    }
  }

  const granted = result?.decision === 'granted' || result?.decision === 'override-granted';

  return (
    <main className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-4 text-text-tertiary">
          <ScanFace className="w-5 h-5 text-brand-400" />
          <h1 className="text-sm uppercase tracking-[0.2em]">Face Gate</h1>
        </div>

        {/* Camera viewfinder */}
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-1 border border-border-strong">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
          {/* scan ring */}
          <div
            className={`absolute inset-8 rounded-full border-2 transition-colors ${
              phase === 'scanning' ? 'border-brand-400 animate-pulse' : 'border-white/20'
            }`}
          />
          {/* result overlay */}
          {phase === 'result' && result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-md bg-black/55 p-4 text-center">
              {granted ? (
                <>
                  <CheckCircle2 className="w-16 h-16 text-success mb-2" />
                  <p className="text-2xl font-bold text-white">{result.name}</p>
                  <p className="text-success text-sm uppercase tracking-wider mt-1">
                    {result.action === 'checked-out' ? 'Checked out' : 'Entry granted'}
                  </p>
                </>
              ) : result.decision === 'unmatched' ? (
                <>
                  <UserX className="w-16 h-16 text-text-tertiary mb-2" />
                  <p className="text-xl font-semibold text-white">Not recognized</p>
                  <p className="text-text-secondary text-sm mt-1">Please register at the front desk.</p>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-14 h-14 text-warning mb-2" />
                  <p className="text-xl font-semibold text-white">{result.name ?? 'Entry denied'}</p>
                  <ul className="text-sm text-warning mt-2 space-y-0.5">
                    {result.reasons?.map((r) => <li key={r}>• {r}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-center text-sm text-danger mt-3">{error}</p>}

        {/* Controls */}
        <div className="mt-5">
          {phase === 'loading' && (
            <p className="text-center text-text-tertiary text-sm">Starting camera + face engine…</p>
          )}
          {(phase === 'ready' || phase === 'scanning') && (
            <Button variant="primary" size="lg" className="w-full" loading={phase === 'scanning'} onClick={scan}>
              <ScanFace className="w-5 h-5" /> Scan face
            </Button>
          )}

          {phase === 'result' && result && !granted && result.decision !== 'unmatched' && result.canOverride && (
            <div className="space-y-2">
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Gateman override reason (required)…"
                className="w-full h-10 px-3 rounded-md bg-surface-1 border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={reset}>Cancel</Button>
                <Button variant="success" className="flex-1" loading={overriding} onClick={approveOverride}>
                  Approve &amp; let in
                </Button>
              </div>
            </div>
          )}

          {phase === 'result' && result && (granted || result.decision === 'unmatched' || (!result.canOverride && !granted)) && (
            <Button variant="secondary" size="lg" className="w-full" onClick={reset}>
              Next person
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-text-tertiary mt-4">
          Auto-grants compliant matches · denials need a gateman&apos;s approval
        </p>
      </div>
    </main>
  );
}
