'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { getBrand } from '@/lib/brand';

export function BrandFooter() {
  const brand = getBrand();
  return (
    <footer className="relative z-10 border-t border-border-subtle mt-16 py-7 text-xs text-text-tertiary bg-surface-1">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Logo size={26} showWordmark={false} href="" />
        <p className="text-center md:text-left">{brand.productName}</p>
        <div className="text-center md:text-right">
          Built by{' '}
          <span className="text-brand-400 font-medium">Personify Crafters</span>{' '}
          for{' '}
          <Link
            href="https://thestudioinfinito.com"
            className="text-brand-400 hover:text-brand-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Studio Infinito
          </Link>
        </div>
      </div>
    </footer>
  );
}
