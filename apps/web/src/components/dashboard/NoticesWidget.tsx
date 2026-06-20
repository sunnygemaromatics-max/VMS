'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { Megaphone, AlertTriangle, Info } from 'lucide-react';
import { API_URL, apiGet } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Notice {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'urgent';
  authorName: string;
  createdAt: string;
}

export function NoticesWidget() {
  const { t } = useI18n();
  const [notices, setNotices] = useState<Notice[] | null>(null);

  useEffect(() => {
    apiGet<Notice[]>('/notices')
      .then((list) => setNotices(list.slice(0, 3)))
      .catch(() => setNotices([]));

    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('notice_new', (n: Notice) =>
      setNotices((prev) => (prev ? [n, ...prev].slice(0, 3) : [n])),
    );
    socket.on('notice_removed', ({ id }: { id: string }) =>
      setNotices((prev) => prev?.filter((x) => x.id !== id) ?? prev),
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  if (notices === null) return null;
  if (notices.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-brand-500/20 bg-brand-500/5 backdrop-blur-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-white font-semibold">
          <Megaphone className="w-4 h-4 text-brand-400" /> {t('notices.title')}
        </h3>
        <Link
          href="/notices"
          className="text-xs text-brand-300 hover:text-brand-200"
        >
          {t('action.viewAll')} →
        </Link>
      </div>
      <ul className="space-y-2">
        {notices.map((n) => {
          const Icon = n.level === 'info' ? Info : AlertTriangle;
          const tone =
            n.level === 'urgent'
              ? 'text-red-300'
              : n.level === 'warning'
              ? 'text-amber-300'
              : 'text-brand-300';
          return (
            <li key={n.id} className="flex items-start gap-2 py-1">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate font-medium">{n.title}</p>
                <p className="text-xs text-zinc-400 truncate">{n.body}</p>
              </div>
              <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                {new Date(n.createdAt).toLocaleDateString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
