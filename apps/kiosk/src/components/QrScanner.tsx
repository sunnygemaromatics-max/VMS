"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (token: string) => void;
  active: boolean;
}

/**
 * Wrapper around html5-qrcode that mounts/unmounts cleanly with React.
 * Imported dynamically because the library touches `document` at import time.
 */
export function QrScanner({ onScan, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    let cancelled = false;
    let stopped = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const id = containerRef.current!.id;
        const scanner = new Html5Qrcode(id, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (!stopped) {
              stopped = true;
              onScan(decoded);
            }
          },
          () => {
            /* per-frame failures are noise; ignore */
          },
        );
      } catch (e: any) {
        setError(
          e?.message?.includes("Permission")
            ? "Camera permission denied."
            : e?.message || "Could not start camera",
        );
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => {})
          .then(() => s.clear?.());
      }
    };
  }, [active, onScan]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
      <div id="kiosk-qr-reader" ref={containerRef} className="w-full aspect-square" />
      {error && (
        <p className="text-red-300 text-xs p-3 border-t border-red-500/20 bg-red-500/10">
          {error}
        </p>
      )}
    </div>
  );
}
