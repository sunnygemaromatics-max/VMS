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
  const imageWidth = showWordmark ? Math.round(size * 3.3) : Math.round(size * 1.25);
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={brand.logoSrc}
        alt={`${brand.tagline} logo`}
        width={imageWidth}
        height={size}
        priority
        className="h-auto w-auto object-contain"
      />
    </span>
  );

  if (href === '') return inner;
  return <Link href={href}>{inner}</Link>;
}
