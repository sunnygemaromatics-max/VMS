'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bell, X, UserPlus, Check, LogIn, LogOut } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Notice {
  id: string;
  kind: 'walk-in' | 'approval' | 'check-in' | 'check-out';
  title: string;
  body?: string;
  visitId?: string;
  ts: string;
}

const ICONS = {
  'walk-in': UserPlus,
  approval: Check,
  'check-in': LogIn,
  'check-out': LogOut,
};

const COLORS = {
  'walk-in': 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100',
  approval: 'border-green-500/30 bg-green-500/10 text-green-100',
  'check-in': 'border-blue-500/30 bg-blue-500/10 text-blue-100',
  'check-out': 'border-zinc-500/30 bg-zinc-500/10 text-zinc-100',
};

export function NotificationToaster() {
  const [toasts, setToasts] = useState<Notice[]>([]);

  useEffect(() => {
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('notification', (payload: Omit<Notice, 'id'>) => {
      const n: Notice = { ...payload, id: crypto.randomUUID() };
      setToasts((prev) => [n, ...prev].slice(0, 5));
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== n.id));
      }, 8000);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind] ?? Bell;
        const color = COLORS[t.kind] ?? COLORS['walk-in'];
        return (
          <div
            key={t.id}
            className={`rounded-xl border ${color} backdrop-blur-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right`}
          >
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{t.title}</p>
              {t.body && <p className="text-xs opacity-80 mt-0.5">{t.body}</p>}
              <p className="text-[10px] opacity-50 mt-1 uppercase">{t.kind}</p>
            </div>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="p-1 opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
