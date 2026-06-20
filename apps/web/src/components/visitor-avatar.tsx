'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Props {
  visitorId: string;
  name: string;
  size?: number;
}

/**
 * Renders the visitor's stored photo or falls back to initials.
 * Photos come from the unauthenticated /public/visitor/:id/photo endpoint.
 */
export function VisitorAvatar({ visitorId, name, size = 96 }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300"
        style={{ width: size, height: size }}
      >
        <span className="font-semibold text-lg">
          {initials(name) || <User className="w-6 h-6" />}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${API_URL}/public/visitor/${visitorId}/photo`}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="rounded-full object-cover border-2 border-white/10"
      style={{ width: size, height: size }}
    />
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}
