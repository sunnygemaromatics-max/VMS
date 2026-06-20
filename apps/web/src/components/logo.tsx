'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getBrand } from '@/lib/brand';

interface Props {
  size?: number;
  showWordmark?: boolean;
  href?: string;
  className?: string;
}

export function Logo({ size = 36, showWordmark = true, href = '/', className = '' }: Props) {
  const brand = getBrand();
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={brand.logoSrc}
        alt={brand.tagline}
        width={size}
        height={size}
        priority
        className="rounded-lg"
      />
      {showWordmark && (
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-semibold text-white tracking-tight">
            {brand.shortName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {brand.tagline}
          </span>
        </span>
      )}
    </span>
  );

  if (href === '') return inner;
  return <Link href={href}>{inner}</Link>;
}
