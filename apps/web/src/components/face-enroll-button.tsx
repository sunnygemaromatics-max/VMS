'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanFace, CheckCircle2, X } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { describeFace, loadFaceApi } from '@/lib/face-api-loader';

interface Props {
  kind: 'visitor' | 'worker';
  id: string;
  /** Label override for the trigger button. */
  label?: string;
  /** Called after successful enrollment. */
  onEnrolled?: () => void;
  /** Open the camera immediately on mount; renders no trigger button. */
  autoStart?: boolean;
  /** Called when the modal closes (used with autoStart for one-step flows). */
  onClose?: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'capturing' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export function FaceEnrollButton({ kind, id, label, onEnrolled, autoStart, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function start() {
    setOpen(true);
    setState({ kind: 'loading' });
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ kind: 'error', message: 'Camera not supported (needs HTTPS).' });
      return;
    }
    // Open the camera FIRST so the viewfinder appears even if face-api CDN is
    // slow. Face models load in the background; capture() waits for them.
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setState({ kind: 'ready' });
      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch {}
        }
      });
      // Warm the face models in the background.
      loadFaceApi().catch(() => {});
    } catch (e: any) {
      setState({
        kind: 'error',
        message:
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied — allow camera in browser settings.'
            : e?.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : e?.name === 'NotReadableError'
            ? 'Camera in use by another app — close it and retry.'
            : e?.message || 'Could not start camera',
      });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function close() {
    stopCamera();
    setOpen(false);
    setState({ kind: 'idle' });
    onClose?.();
  }

  async function capture() {
    if (!videoRef.current) return;
    setState({ kind: 'capturing' });
    try {
      const embedding = await describeFace(videoRef.current);
      if (!embedding) {
        setState({ kind: 'error', message: 'No face detected — try again.' });
        return;
      }
      setState({ kind: 'submitting' });
      await apiPost(`/face/enroll/${kind}/${id}`, { embedding });
      setState({ kind: 'done' });
      onEnrolled?.();
      // Auto-close shortly after success
      setTimeout(close, 1500);
    } catch (e: any) {
      setState({ kind: 'error', message: e?.message ?? 'Enrollment failed' });
    }
  }

  if (!open) {
    // In autoStart mode we render no trigger button — the modal opens itself.
    if (autoStart) return null;
    return (
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-purple-600/80 hover:bg-purple-600 text-white"
        title="Capture face for recognition"
      >
        <ScanFace className="w-3.5 h-3.5" />
        {label ?? 'Enroll face'}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <ScanFace className="w-4 h-4 text-purple-300" />
            Enroll face
          </h3>
          <button onClick={close} className="p-1 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="aspect-square w-full bg-black rounded-lg overflow-hidden mb-3 flex items-center justify-center">
          {state.kind === 'loading' ? (
            <p className="text-xs text-zinc-400">Loading face models…</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              className="w-full h-full object-cover bg-black"
            />
          )}
        </div>

        {state.kind === 'error' && (
          <p className="text-xs text-red-300 mb-3">✗ {state.message}</p>
        )}
        {state.kind === 'done' && (
          <p className="text-xs text-green-300 mb-3 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Face enrolled.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={capture}
            disabled={state.kind !== 'ready' && state.kind !== 'error'}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {state.kind === 'capturing'
              ? 'Detecting…'
              : state.kind === 'submitting'
              ? 'Saving…'
              : 'Capture'}
          </button>
          <button
            onClick={close}
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
