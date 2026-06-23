'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Crosshair, Download, RefreshCw, X } from 'lucide-react';
import {
  createStampedCapture,
  formatCaptureDate,
  getLocationText,
  readFileAsDataUrl,
  saveCaptureLocally,
  snapshotVideo,
} from '@/lib/capture';

interface Props {
  onCapture: (dataUrl: string) => void;
  initialDataUrl?: string | null;
  moduleName?: string;
  label?: string;
}

export function WebcamCapture({
  onCapture,
  initialDataUrl,
  moduleName = 'Visitor Check-In',
  label = 'Visitor Photo',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(initialDataUrl ?? null);
  const [locationText, setLocationText] = useState('Location unavailable');
  const [geoLoading, setGeoLoading] = useState(false);

  async function refreshGeo() {
    setGeoLoading(true);
    try {
      setLocationText(await getLocationText());
    } finally {
      setGeoLoading(false);
    }
  }

  async function startCamera() {
    setError(null);
    try {
      await refreshGeo();
      // Try preferred constraints, fall back if device can't honour them
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setActive(true);
      // Wait one tick so the <video> ref exists, then attach
      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // autoplay attribute on the element will pick it up
          }
        }
      });
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow access in your browser settings.'
          : e?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : e?.message || 'Could not access the camera',
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function snapshot() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const raw = snapshotVideo(video, 'image/jpeg', 0.9);
      const stamped = await createStampedCapture(raw, {
        moduleName,
        label,
        locationText,
      });
      setPhoto(stamped.dataUrl);
      onCapture(stamped.dataUrl);
      saveCaptureLocally({
        moduleName,
        label,
        filename: stamped.filename,
        dataUrl: stamped.dataUrl,
        locationText: stamped.locationText,
        capturedAt: stamped.capturedAt.toISOString(),
      });
      stopCamera();
    } catch (e: any) {
      setError(e?.message || 'Could not capture photo');
    }
  }

  function retake() {
    setPhoto(null);
    onCapture('');
    startCamera();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await readFileAsDataUrl(file);
      const stamped = await createStampedCapture(raw, {
        moduleName,
        label,
        locationText,
      });
      setPhoto(stamped.dataUrl);
      onCapture(stamped.dataUrl);
      saveCaptureLocally({
        moduleName,
        label,
        filename: stamped.filename,
        dataUrl: stamped.dataUrl,
        locationText: stamped.locationText,
        capturedAt: stamped.capturedAt.toISOString(),
      });
    } catch (e: any) {
      setError(e?.message || 'Could not use uploaded image');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <div className="aspect-square w-full bg-black flex items-center justify-center relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Captured" className="w-full h-full object-cover" />
        ) : active ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            disablePictureInPicture
            className="w-full h-full object-cover bg-black"
          />
        ) : (
          <div className="text-center text-zinc-500 p-6">
            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No photo captured</p>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-500/10 border-t border-red-500/20">
          {error}
        </div>
      )}

      <div className="px-4 py-2 text-xs text-zinc-400 border-t border-white/10 bg-slate-950/30">
        Stamp: {formatCaptureDate()} • {locationText}
      </div>

      <div className="flex gap-2 p-3 border-t border-white/10 bg-slate-950/40">
        {!active && !photo && (
          <>
            <button
              type="button"
              onClick={startCamera}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <Camera className="w-4 h-4" /> Start camera
            </button>
            <label className="flex-1 flex cursor-pointer items-center justify-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm">
              <Download className="w-4 h-4" /> Upload image
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
            </label>
            <button
              type="button"
              onClick={refreshGeo}
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </>
        )}
        {active && (
          <>
            <button
              type="button"
              onClick={snapshot}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <Camera className="w-4 h-4" /> Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {photo && (
          <>
            <button
              type="button"
              onClick={retake}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Retake
            </button>
            <button
              type="button"
              onClick={refreshGeo}
              disabled={geoLoading}
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-60"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
