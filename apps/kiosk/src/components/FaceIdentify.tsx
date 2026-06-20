"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// face-api.js + models loaded from a CDN at runtime so we don't have to
// bundle / host 6 MB of weights in the kiosk repo.
const FACE_API_CDN = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

type State =
  | { kind: "idle" }
  | { kind: "loading-models" }
  | { kind: "ready" }
  | { kind: "scanning" }
  | { kind: "match"; name: string; distance: number; kindOfPerson: string; meta?: any }
  | { kind: "no-match"; reason?: string; bestDistance?: number }
  | { kind: "error"; message: string };

declare global {
  interface Window {
    faceapi?: any;
  }
}

export function FaceIdentify() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function loadModels() {
    setState({ kind: "loading-models" });
    try {
      if (!window.faceapi) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = FACE_API_CDN;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Could not load face-api.js from CDN"));
          document.head.appendChild(s);
        });
      }
      const fa = window.faceapi;
      await fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      await fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setState({ kind: "ready" });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Failed to load models" });
    }
  }

  async function startCamera() {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch {}
        }
      });
    } catch (e: any) {
      setState({
        kind: "error",
        message:
          e?.name === "NotAllowedError"
            ? "Camera permission denied."
            : e?.name === "NotFoundError"
            ? "No camera found."
            : e?.message || "Could not start camera",
      });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function scan() {
    if (!videoRef.current || !window.faceapi) return;
    setState({ kind: "scanning" });
    try {
      const fa = window.faceapi;
      const result = await fa
        .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!result?.descriptor) {
        setState({ kind: "no-match", reason: "No face detected — try again" });
        return;
      }

      const embedding = Array.from(result.descriptor) as number[];
      const res = await fetch(`${API_URL}/face/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });
      const data = await res.json();
      if (data.matched) {
        setState({
          kind: "match",
          name: data.name,
          distance: data.distance,
          kindOfPerson: data.kind,
          meta: data.meta,
        });
      } else {
        setState({
          kind: "no-match",
          reason: data.reason ?? "No match",
          bestDistance: data.bestDistance,
        });
      }
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Scan failed" });
    }
  }

  const buttonRow = (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={scan}
        disabled={state.kind === "loading-models" || state.kind === "scanning"}
        className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 font-semibold disabled:opacity-50"
      >
        {state.kind === "scanning" ? "Scanning…" : "Identify"}
      </button>
      <button
        type="button"
        onClick={() => {
          setState({ kind: "ready" });
        }}
        className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2.5"
      >
        Clear
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur space-y-4">
      {state.kind === "idle" && (
        <>
          <p className="text-sm text-slate-300">
            Face recognition uses face-api.js loaded from a CDN. Models (~6 MB) are downloaded
            once on first activate.
          </p>
          <button
            onClick={async () => {
              await loadModels();
              await startCamera();
            }}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 font-semibold"
          >
            Enable face scanner
          </button>
        </>
      )}

      {state.kind === "loading-models" && (
        <p className="text-sm text-blue-300 text-center py-4">
          Downloading face models from CDN…
        </p>
      )}

      {(state.kind === "ready" ||
        state.kind === "scanning" ||
        state.kind === "match" ||
        state.kind === "no-match") && (
        <>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              className="w-full h-full object-cover bg-black"
            />
          </div>
          {buttonRow}
          {state.kind === "match" && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <p className="text-green-300 font-semibold">
                ✓ {state.name}{" "}
                <span className="text-xs text-green-400">
                  ({state.kindOfPerson}, distance {state.distance})
                </span>
              </p>
              {state.meta?.contractor && (
                <p className="text-xs text-zinc-400 mt-1">{state.meta.contractor}</p>
              )}
              {state.meta?.isBlacklisted && (
                <p className="text-xs text-red-300 mt-1">⚠ Blacklisted</p>
              )}
            </div>
          )}
          {state.kind === "no-match" && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200 text-sm">
              ✗ {state.reason}
              {state.bestDistance !== undefined && (
                <span className="text-xs"> (closest: {state.bestDistance})</span>
              )}
            </div>
          )}
        </>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          ✗ {state.message}
        </div>
      )}
    </div>
  );
}
