'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Siren, X } from 'lucide-react';
import { API_URL, apiPost } from '@/lib/api';

interface SosEvent {
  actorEmail: string;
  actorName: string;
  branchName?: string;
  message?: string;
  ts: string;
}

export function SosBanner() {
  const [event, setEvent] = useState<SosEvent | null>(null);

  useEffect(() => {
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('sos', (e: SosEvent) => setEvent(e));
    socket.on('sos_clear', () => setEvent(null));
    return () => {
      socket.disconnect();
    };
  }, []);

  if (!event) return null;

  const minutes = Math.max(0, Math.round((Date.now() - new Date(event.ts).getTime()) / 60_000));

  return (
    <div
      className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white shadow-2xl animate-in slide-in-from-top"
      role="alert"
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
        <Siren className="w-5 h-5 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            🚨 SOS triggered by {event.actorName}
            {event.branchName && ` at ${event.branchName}`}
          </p>
          <p className="text-xs opacity-90 truncate">
            {event.message || 'No additional message.'} ·{' '}
            {minutes === 0 ? 'just now' : `${minutes} min ago`} · {event.actorEmail}
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              await apiPost('/sos/clear', {});
            } catch {
              setEvent(null);
            }
          }}
          className="px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 text-sm font-medium flex items-center gap-1"
        >
          Acknowledge & clear
        </button>
        <button
          onClick={() => setEvent(null)}
          className="p-1 opacity-70 hover:opacity-100"
          title="Dismiss locally"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
